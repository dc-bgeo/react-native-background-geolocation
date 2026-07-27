# @dc-bgeo/react-native-background-geolocation

Reliable background geolocation for React Native — iOS & Android, New
Architecture (TurboModule), native offline HTTP upload, motion-based tracking
that survives app kill / reboot.

Closed-source engine (shipped as a prebuilt `BGeoCore.xcframework` + `bgeo-android`
AAR) behind an open TypeScript + native bridge. Requires a license key in
release builds — see [LICENSE.md](./LICENSE.md).

## Requirements

- React Native **≥ 0.76** (New Architecture only)
- iOS **≥ 15.5**, Android **minSdk 24**

## Install

```sh
npm install @dc-bgeo/react-native-background-geolocation
```

### Android

The closed engine ships as an AAR in a local Maven repo inside this package.
Add it to your project's `android/build.gradle`:

```gradle
allprojects {
  repositories {
    maven { url("$rootDir/../node_modules/@dc-bgeo/react-native-background-geolocation/android/libs") }
  }
}
```

Declare background location yourself (Google Play requires the *app* to own this
declaration + the Play Console disclosure) in `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

### iOS

```sh
cd ios && pod install
```

Add `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSMotionUsageDescription`,
and the `location` background mode (`UIBackgroundModes`) to your `Info.plist`.

## Usage

```ts
import BackgroundGeolocation from '@dc-bgeo/react-native-background-geolocation';

const sub = BackgroundGeolocation.onLocation(location => {
  console.log('[location]', location.coords);
});

// License key goes in the manifest / Info.plist (see License keys), not here.
await BackgroundGeolocation.ready({
  distanceFilter: 10,
  stopTimeout: 5,
  url: 'https://your-server.example/locations',
  autoSync: true,
});

await BackgroundGeolocation.requestPermission();
await BackgroundGeolocation.start();
```

Debuggable builds and the iOS simulator run without a license key (evaluation).

## License keys

A production key is bound to your `applicationId` + signing certificate
(Android) / bundle id + Team ID (iOS). Register the **Play App Signing**
certificate. In a **release** build an invalid/expired/mismatched key makes
`ready()` / `start()` reject with `LICENSE_MISSING | LICENSE_INVALID |
LICENSE_EXPIRED | LICENSE_APP_MISMATCH`; debuggable builds and the iOS simulator
never produce these codes — they run unlicensed (evaluation) whatever the key
state, so a key bound to your release signing cert can't block development.

Set the key in the manifest — the same mechanism for RN/native/Flutter, read at
launch before JS runs (there is no config option):

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<meta-data android:name="com.bgeo.license" android:value="BGEO1....YOUR_KEY" />
```

```xml
<!-- ios Info.plist -->
<key>BGeoLicense</key><string>BGEO1....YOUR_KEY</string>
```

## API

Transistorsoft-shaped: `ready`, `setConfig`, `start`, `stop`, `getState`,
`getCurrentPosition`, `watchPosition`, `stopWatchPosition`, `requestPermission`,
`getProviderState`, `setOdometer`, `getAuthState`, `sync`, `getLocations`,
`destroyLocations`, and `onLocation`/`onMotionChange`/`onHeartbeat`/
`onProviderChange`/`onGeofence`/`onAuthorization` event subscriptions.

See `src/types.ts` for the full `Config` reference.
