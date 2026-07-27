# @dc-bgeo/react-native-background-geolocation

**Background geolocation for React Native that keeps tracking when the app is
backgrounded, killed, force-quit, or rebooted.** iOS & Android, New Architecture
(TurboModule), with a native offline queue and HTTP uploader — no JavaScript
runs in the background.

![BGeo — live device track in the web console](https://raw.githubusercontent.com/dc-bgeo/react-native-background-geolocation/main/preview.png)

## Why this one

- **It survives.** iOS uses the modern session engine (`CLBackgroundActivitySession`
  + `CLLocationUpdate.liveUpdates`) with a wake region and significant-change
  monitoring as backup; Android uses a foreground service with boot + task-removal
  restart. Device-verified: force-quit mid-drive resumes in ~1 s, a reboot relaunches
  tracking with no user interaction, an overnight OS eviction wakes on the morning
  departure.
- **Battery-sane.** Motion state machine with activity recognition, adaptive
  speed-elastic `distanceFilter`, and a coarse keep-alive while parked — GPS sleeps
  when the device does.
- **Uploads from native code.** Locations go into a SQLite queue and are POSTed by
  the engine itself, with batching, exponential backoff, JWT auth + token refresh,
  and poison-record handling. Offline points survive app death and are drained later;
  JS never has to be awake.
- **Clean fixes.** Kalman smoothing, accuracy gate, and teleport rejection before a
  point ever reaches your server.
- **Familiar API.** Transistorsoft-shaped (`ready`/`start`/`onLocation`/…), so
  existing integrations and docs knowledge carry over.
- **Geofences.** ENTER/EXIT/DWELL with proximity slicing, well past the OS region
  limits, riding the same offline upload queue.

## Web console

Every install can be linked to the console at **[bgeo.dev](https://bgeo.dev/)** —
manage licenses and registration codes, then watch a device live: map with route
polyline and geofences, raw coordinates, and a split view.

And because the logger is native, the console shows what the **engine** did — not
what your JS saw. Motion transitions, session start/stop, permission changes,
fix summaries, HTTP results — streamed off the device and filterable by level:

![BGeo web console — native engine logs streamed from the device](https://raw.githubusercontent.com/dc-bgeo/react-native-background-geolocation/main/web_console_logs.png)

That is the difference between guessing why a background track has a gap and
reading the line where the engine says so. Logs are buffered in SQLite and
uploaded on the same schedule as locations, so a killed app still reports.

Linking is a registration code plus `setConfig` — see
[`example/src/deviceLink.ts`](./example/src/deviceLink.ts). Your own server stays
the default target; the console is opt-in.

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

A runnable console app lives in [`example/`](./example) — settings screen for
every config key, live map, log viewer, geofence editor.

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

Transistorsoft-shaped:

- **Lifecycle** — `ready`, `setConfig`, `start`, `stop`, `getState`, `changePace`
- **Position** — `getCurrentPosition`, `watchPosition`, `stopWatchPosition`,
  `getOdometer`, `setOdometer`, `resetOdometer`
- **Queue / HTTP** — `sync`, `getLocations`, `getCount`, `insertLocation`,
  `destroyLocation`, `destroyLocations`, `getAuthState`
- **Geofences** — `addGeofence(s)`, `removeGeofence(s)`, `getGeofences`,
  `geofenceExists`
- **Permissions / device** — `requestPermission`, `requestTemporaryFullAccuracy`,
  `getProviderState`, `isPowerSaveMode`
- **Logger** — `logger.error/warn/info/debug/verbose`, `getLog`, `destroyLog`,
  `uploadLog`
- **Events** — `onLocation`, `onMotionChange`, `onHeartbeat`, `onProviderChange`,
  `onGeofence`, `onGeofencesChange`, `onHttp`, `onConnectivityChange`,
  `onPowerSaveChange`, `onAuthorization`
- **Android headless** — `registerHeadlessTask`

See [`src/types.ts`](./src/types.ts) for the full `Config` reference.

## License

Dual-licensed, see [LICENSE.md](./LICENSE.md):

- **Bridge** — MIT © BGeo (`src`, `lib`, `android/src`, `ios/RNBackgroundGeolocation.{h,mm}`,
  podspec, gradle glue).
- **Engine binaries** — proprietary (`ios/BGeoCore.xcframework`, the
  `com.bgeo:bgeo-android` AAR); a license key is required in release builds.
