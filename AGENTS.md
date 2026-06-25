# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Android Test Device

When testing app changes on Android, build the APK and install it wirelessly with ADB so the user can verify on the physical device.

Use this tested wireless install flow:

```powershell
cd E:\LimProjects\Promise\mobile
npm run typecheck
npm test -- data/supabaseProfile.test.ts lib/appNotifications.test.ts lib/notifications.test.ts lib/notificationStatus.test.ts lib/cardMenu.test.ts lib/scheduleCalendar.test.ts lib/friends.test.ts lib/storageMode.test.ts lib/supabaseAuth.test.ts
if ((subst) -notmatch '^P:\\:') { subst P: E:\LimProjects\Promise }
cd P:\mobile\android
.\gradlew.bat :app:assembleRelease

$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$serial = "192.168.0.20:5555"
$apk = "P:\mobile\android\app\build\outputs\apk\release\app-release.apk"

& $adb devices -l
& $adb -s $serial install -r --no-streaming $apk
& $adb -s $serial shell monkey -p com.lim.whenbollae -c android.intent.category.LAUNCHER 1
& $adb -s $serial shell dumpsys window | Select-String -Pattern "mCurrentFocus|mFocusedApp"
```

Success means `install` prints `Success` and `mCurrentFocus` or `mFocusedApp` contains `com.lim.whenbollae/.MainActivity`.

If the wireless device is missing:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb connect 192.168.0.20:5555
& $adb devices -l
```

If wireless ADB still does not appear, connect USB once and re-enable TCP mode:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb tcpip 5555
& $adb connect 192.168.0.20:5555
& $adb devices -l
```

Known Android package name: `com.lim.whenbollae`.

# Android Production AAB

Default to local AAB builds for production Android releases. Do not start an EAS
cloud build for AAB unless the user explicitly asks for EAS.

Local signing files are already intentionally ignored by Git:

- `android/app/whenbollae-upload.jks`
- `android/keystore.properties`
- `@lallafm__when-bollae.jks` if the EAS download copy remains in the repo root

Never commit these files and never print keystore passwords in chat, logs, docs,
or commit messages.

Use this local AAB build flow:

```powershell
cd E:\LimProjects\Promise\mobile
npm run typecheck
npm test -- lib/appNotifications.test.ts lib/interstitialAdPolicy.test.ts
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-android-aab.ps1
```

The script automatically maps the project through a short temporary drive path
on Windows before running Gradle, so native builds avoid the 260-character path
limit.

Expected local output:

```text
E:\LimProjects\Promise\mobile\dist\android\whenbollae-local-release.aab
```

Verify the AAB before giving it to the user or uploading to Play:

```powershell
jarsigner -verify -certs -verbose dist\android\whenbollae-local-release.aab | Select-String -Pattern "jar verified|Signed by|SHA-256" -Context 0,1
keytool -printcert -jarfile dist\android\whenbollae-local-release.aab | Select-String -Pattern "SHA1|SHA256"
```

Expected upload-key fingerprints:

```text
SHA1: 36:7D:6D:BE:66:0F:DA:C9:10:3C:13:FA:92:2E:97:9D:82:D5:1D:A9
SHA256: 6E:A3:F8:C3:CB:79:13:8D:62:B2:5F:7D:49:75:19:78:56:B0:D3:05:7A:F5:73:3B:60:65:C9:E6:83:8A:4C:9F
```

The JKS-to-PKCS12 warning from `keytool` is not a release blocker. Keep the
existing JKS upload key unless the user explicitly requests a signing-key
migration.

Current Android AdMob IDs:

```text
ADMOB_ANDROID_APP_ID=ca-app-pub-9163944262143117~3653063299
EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID=ca-app-pub-9163944262143117/4798624009
EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID=ca-app-pub-9163944262143117/9961420962
```
