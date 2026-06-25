Android local AAB build

Use this only when the Play upload keystore is available locally. Do not commit
the keystore or `android/keystore.properties`.

1. Put the upload keystore somewhere on this PC, for example:

   `android/app/whenbollae-upload.jks`

2. Copy `scripts/keystore.properties.example` to `android/keystore.properties`
   and fill the real values.

3. Confirm `.env` contains:

   `ADMOB_ANDROID_APP_ID`
   `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID`
   `EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID`

4. Build the Play-ready AAB:

   `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android-aab.ps1`

The output is written to `dist/android/whenbollae-local-release.aab`.
