#import <Foundation/Foundation.h>

#ifndef RCT_NEW_ARCH_ENABLED
#error "react-native-background-geolocation requires the New Architecture (RCT_NEW_ARCH_ENABLED=1)."
#endif

#import <RNBackgroundGeolocationSpec/RNBackgroundGeolocationSpec.h>

/**
 * Background geolocation TurboModule (Transistor drop-in).
 *
 * Subclasses the codegen-generated `NativeBackgroundGeolocationSpecBase` to
 * inherit the `emitOnLocation:`/`emitOnProviderChange:`/… event methods, and
 * conforms to `NativeBackgroundGeolocationSpec` for the Promise method surface.
 *
 * Phase 0 is a stub: every method resolves a safe default so the app boots and
 * the codegen + static-framework build is validated end-to-end. Real
 * CoreLocation behaviour lands in later phases (forwarded to a Swift engine).
 */
@interface RNBackgroundGeolocation : NativeBackgroundGeolocationSpecBase <NativeBackgroundGeolocationSpec>
@end
