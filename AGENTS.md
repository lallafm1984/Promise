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
