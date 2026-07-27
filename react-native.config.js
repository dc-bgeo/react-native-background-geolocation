// Auto-detect both platforms:
//  - iOS: globs the root for `RNBackgroundGeolocation.podspec`.
//  - Android: the bridge namespace is com.bgeo.rn (the closed AAR owns com.bgeo)
//    and the ReactPackage (BackgroundGeolocationPackage) lives in that same
//    package, so autolinking derives com.bgeo.rn.BackgroundGeolocationPackage
//    correctly without an override (which is unreliable on this RN version).
module.exports = {};
