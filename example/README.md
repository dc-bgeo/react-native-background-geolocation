# BGeo Example

Demo / CI consumer of the `react-native-background-geolocation` package (symlinked as
`node_modules/react-native-background-geolocation -> ../..`, see `metro.config.js`).
The screen offers start/stop tracking, getCurrentPosition and a live event log
(location / motionchange / heartbeat / providerchange).

## Running

```sh
npm install

# Android
npm run android

# iOS
cd ios && pod install && cd ..
npm run ios
```

`android/local.properties` (sdk.dir) is not in git — create it locally.

## Compile check without a device

```sh
cd android && ./gradlew :app:assembleDebug        # codegen + Kotlin bridge and engine
cd ios && pod install                              # podspec integration
xcodebuild -workspace ios/BGeoExample.xcworkspace -scheme BGeoExample \
  -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
```
