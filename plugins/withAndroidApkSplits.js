const { withAppBuildGradle } = require('@expo/config-plugins');

const withAndroidApkSplits = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = applyApkSplits(config.modResults.contents);
    } else {
      throw new Error('Cannot add ABI splits because build.gradle is not groovy');
    }
    return config;
  });
};

function applyApkSplits(buildGradle) {
  if (buildGradle.includes('splits {') && buildGradle.includes('universalApk false')) {
    return buildGradle;
  }

  const splitsConfig = `
    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a"
            universalApk false
        }
    }`;
    
  // Inject exactly after the 'android {' block opens
  return buildGradle.replace(/android\s*\{/, `android {${splitsConfig}`);
}

module.exports = withAndroidApkSplits;
