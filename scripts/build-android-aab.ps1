param(
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$AndroidDir = Join-Path $ProjectRoot "android"
$EnvFile = Join-Path $ProjectRoot ".env"
$KeystorePropertiesFile = Join-Path $AndroidDir "keystore.properties"
$SigningInitScript = Join-Path $ProjectRoot "scripts\promise-local-signing.gradle"

function Import-KeyValueFile {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return
    }

    foreach ($rawLine in Get-Content -Path $Path) {
        $line = $rawLine.Trim()
        if ($line.Length -eq 0 -or $line.StartsWith("#")) {
            continue
        }

        $separatorIndex = $line.IndexOf("=")
        if ($separatorIndex -lt 1) {
            continue
        }

        $name = $line.Substring(0, $separatorIndex).Trim()
        $value = $line.Substring($separatorIndex + 1).Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        if (-not [Environment]::GetEnvironmentVariable($name, "Process")) {
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

function Require-EnvValue {
    param([string]$Name)

    $value = [Environment]::GetEnvironmentVariable($Name, "Process")
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing required environment value: $Name"
    }
}

Import-KeyValueFile -Path $EnvFile

if (-not (Test-Path $KeystorePropertiesFile)) {
    throw "Missing android\keystore.properties. Copy scripts\keystore.properties.example to android\keystore.properties and fill it with the Play upload key values."
}

Import-KeyValueFile -Path $KeystorePropertiesFile

@(
    "ADMOB_ANDROID_APP_ID",
    "EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID",
    "EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID",
    "PROMISE_UPLOAD_STORE_FILE",
    "PROMISE_UPLOAD_STORE_PASSWORD",
    "PROMISE_UPLOAD_KEY_ALIAS",
    "PROMISE_UPLOAD_KEY_PASSWORD"
) | ForEach-Object { Require-EnvValue -Name $_ }

if ($env:EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID -eq $env:EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID) {
    Write-Warning "Banner and interstitial ad unit IDs are identical. Confirm this is intentional in AdMob before submitting to Play."
}

$storeFile = $env:PROMISE_UPLOAD_STORE_FILE
if (-not [System.IO.Path]::IsPathRooted($storeFile)) {
    $storeFile = Join-Path $AndroidDir $storeFile
}
if (-not (Test-Path $storeFile)) {
    throw "Upload keystore file was not found: $storeFile"
}
$storeFile = (Resolve-Path $storeFile).Path
[Environment]::SetEnvironmentVariable("PROMISE_UPLOAD_STORE_FILE", $storeFile, "Process")

Push-Location $AndroidDir
try {
    & .\gradlew.bat --init-script $SigningInitScript :app:bundleRelease
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle bundleRelease failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

$sourceAab = Join-Path $AndroidDir "app\build\outputs\bundle\release\app-release.aab"
if (-not (Test-Path $sourceAab)) {
    throw "Expected AAB output was not found: $sourceAab"
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputDir = Join-Path $ProjectRoot "dist\android"
    $OutputPath = Join-Path $OutputDir "whenbollae-local-release.aab"
} else {
    $OutputDir = Split-Path -Parent $OutputPath
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
Copy-Item -Path $sourceAab -Destination $OutputPath -Force

Write-Host "AAB created: $OutputPath"

$jarsigner = Get-Command jarsigner -ErrorAction SilentlyContinue
if ($jarsigner) {
    & $jarsigner.Source -verify -certs -verbose $OutputPath | Select-String -Pattern "jar verified|X.509|CN=|SHA-256" -Context 0,1
} else {
    Write-Warning "jarsigner was not found on PATH; skipped signature verification."
}
