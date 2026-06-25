const { expo } = require('./app.json');
const fs = require('node:fs');

const GOOGLE_TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const GOOGLE_TEST_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const GOOGLE_SERVICES_JSON = './google-services.json';
const GOOGLE_SERVICE_INFO_PLIST = './GoogleService-Info.plist';

function withOptionalFileConfig(config, platform, key, path) {
  if (!fs.existsSync(path)) {
    return config;
  }

  return {
    ...config,
    [platform]: {
      ...(config[platform] ?? {}),
      [key]: path,
    },
  };
}

module.exports = () => {
  const configWithFirebaseFiles = withOptionalFileConfig(
    withOptionalFileConfig(expo, 'android', 'googleServicesFile', GOOGLE_SERVICES_JSON),
    'ios',
    'googleServicesFile',
    GOOGLE_SERVICE_INFO_PLIST,
  );

  return {
    ...configWithFirebaseFiles,
    plugins: [
      ...(configWithFirebaseFiles.plugins ?? []),
      '@react-native-firebase/app',
      '@react-native-firebase/analytics',
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: process.env.ADMOB_ANDROID_APP_ID || GOOGLE_TEST_ANDROID_APP_ID,
          iosAppId: process.env.ADMOB_IOS_APP_ID || GOOGLE_TEST_IOS_APP_ID,
          optimizeAdLoading: true,
          optimizeInitialization: true,
        },
      ],
    ],
  };
};
