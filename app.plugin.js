/**
 * Expo config plugin for @dc-bgeo/react-native-background-geolocation.
 *
 * Everything this writes lives in files that `expo prebuild` regenerates, so a
 * managed (CNG) app cannot configure the module by hand. It emits:
 *
 *   iOS      — location/motion usage strings, the `location` background mode,
 *              the optional temporary-full-accuracy purpose key, and BGeoLicense.
 *   Android  — ACCESS_BACKGROUND_LOCATION (the one permission the engine AAR
 *              deliberately leaves to the app, per Google Play policy), the
 *              com.bgeo.license meta-data, and the local Maven repo that holds
 *              the engine AAR shipped inside this package.
 *
 * No AppDelegate mod is needed: the iOS engine self-registers from a +load
 * UIApplicationDidFinishLaunchingNotification observer.
 *
 * Requires Expo SDK 54+ (compileSdk 36, New Architecture). Expo Go cannot run
 * this module — use a development build.
 */

const path = require('path');

const pkg = require('./package.json');

// `expo/config-plugins` is the modern entry point; older SDKs only expose the
// standalone package. Either way it is resolved from the app, never bundled here.
function loadConfigPlugins() {
  try {
    return require('expo/config-plugins');
  } catch (e) {
    return require('@expo/config-plugins');
  }
}

const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withInfoPlist,
  withProjectBuildGradle,
} = loadConfigPlugins();

const LICENSE_META_DATA_NAME = 'com.bgeo.license';
const GRADLE_MARKER = `// ${pkg.name} — engine AAR`;

const DEFAULTS = {
  locationWhenInUsePermission:
    'Allow $(PRODUCT_NAME) to use your location to show where you are.',
  locationAlwaysAndWhenInUsePermission:
    'Allow $(PRODUCT_NAME) to use your location in the background to keep tracking while the app is closed.',
  motionPermission:
    'Allow $(PRODUCT_NAME) to use motion activity to detect when you start and stop moving.',
};

function withBGeoInfoPlist(config, props) {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;

    plist.NSLocationWhenInUseUsageDescription =
      props.locationWhenInUsePermission ||
      plist.NSLocationWhenInUseUsageDescription ||
      DEFAULTS.locationWhenInUsePermission;

    plist.NSLocationAlwaysAndWhenInUseUsageDescription =
      props.locationAlwaysAndWhenInUsePermission ||
      plist.NSLocationAlwaysAndWhenInUseUsageDescription ||
      DEFAULTS.locationAlwaysAndWhenInUsePermission;

    plist.NSMotionUsageDescription =
      props.motionPermission ||
      plist.NSMotionUsageDescription ||
      DEFAULTS.motionPermission;

    // requestTemporaryFullAccuracy() resolves REDUCED without this key.
    if (props.fullAccuracyPurpose) {
      plist.NSLocationTemporaryUsageDescriptionDictionary = {
        ...(plist.NSLocationTemporaryUsageDescriptionDictionary || {}),
        DeliverFullAccuracy: props.fullAccuracyPurpose,
      };
    }

    if (props.licenseKey) {
      plist.BGeoLicense = props.licenseKey;
    }

    // expo-location / expo-task-manager write the same array — merge, don't clobber.
    const modes = new Set(plist.UIBackgroundModes || []);
    modes.add('location');
    if (props.isIosBackgroundFetchEnabled) {
      modes.add('fetch');
    }
    plist.UIBackgroundModes = Array.from(modes);

    return cfg;
  });
}

function withBGeoAndroidManifest(config, props) {
  let next = config;

  if (props.isAndroidBackgroundLocationEnabled !== false) {
    next = AndroidConfig.Permissions.withPermissions(next, [
      'android.permission.ACCESS_BACKGROUND_LOCATION',
    ]);
  }

  if (props.licenseKey) {
    next = withAndroidManifest(next, (cfg) => {
      const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
        cfg.modResults
      );
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        mainApplication,
        LICENSE_META_DATA_NAME,
        props.licenseKey
      );
      return cfg;
    });
  }

  return next;
}

/**
 * The closed engine ships as an AAR in a local Maven repo inside this package,
 * so the generated root project has to be pointed at it.
 */
function withBGeoMavenRepo(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        `${pkg.name}: cannot add the engine Maven repository to a ` +
          `${cfg.modResults.language} build.gradle. Add it manually:\n` +
          `  allprojects { repositories { maven { url("<path-to>/android/libs") } } }`
      );
    }

    if (cfg.modResults.contents.includes(GRADLE_MARKER)) {
      return cfg;
    }

    // __dirname is this package's root; make the URL relative to the generated
    // android/ dir (Gradle's $rootDir) so the file stays repo-portable.
    const libsDir = path.join(__dirname, 'android', 'libs');
    const relative = path
      .relative(cfg.modRequest.platformProjectRoot, libsDir)
      .split(path.sep)
      .join('/');
    const repo = `    maven { url("$rootDir/${relative}") } ${GRADLE_MARKER}`;

    // Insert into the existing allprojects.repositories block when there is one.
    const anchor = /allprojects\s*\{[\s\S]*?repositories\s*\{/;
    const match = cfg.modResults.contents.match(anchor);
    if (match) {
      const at = match.index + match[0].length;
      cfg.modResults.contents =
        cfg.modResults.contents.slice(0, at) +
        `\n${repo}` +
        cfg.modResults.contents.slice(at);
    } else {
      cfg.modResults.contents += `\n\nallprojects {\n  repositories {\n${repo}\n  }\n}\n`;
    }

    return cfg;
  });
}

const withBackgroundGeolocation = (config, props = {}) => {
  let next = withBGeoInfoPlist(config, props);
  next = withBGeoAndroidManifest(next, props);
  next = withBGeoMavenRepo(next);
  return next;
};

module.exports = createRunOncePlugin(
  withBackgroundGeolocation,
  pkg.name,
  pkg.version
);
