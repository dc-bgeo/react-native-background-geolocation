# BGeo SDK — License Agreement

Copyright (c) BGeo. All rights reserved.

This package contains proprietary closed-source binary components (the
`BGeoCore.xcframework` for iOS and the `com.bgeo:bgeo-android` AAR under
`android/libs`, collectively the "Binaries") together with open bridge source
(TypeScript under `src`/`lib` and the thin native bridge files under `ios`/
`android/src`, collectively the "Bridge").

## 1. Grant

Subject to a valid, current license key issued by BGeo and to these terms, BGeo
grants you a non-exclusive, non-transferable license to install and use the SDK
in applications you develop and distribute.

- **Development / evaluation.** Debuggable builds and the iOS simulator run
  without a license key for evaluation.
- **Production.** A release build requires a valid license key bound to your
  application identifier (and signing certificate on Android / Team ID on iOS).
  Without one, the SDK refuses to start and returns a `LICENSE_*` error.

A license key is valid for one year. Applications built with an SDK version
released during your license term keep working after the term ends; renewing
grants access to SDK versions released after it.

## 2. Restrictions

You may NOT: (a) decompile, disassemble, reverse-engineer, or otherwise attempt
to derive the source of the Binaries; (b) redistribute, sublicense, rent, or
resell the Binaries except as embedded in your own applications; (c) remove or
circumvent the license mechanism or any binding to your application; (d) share
a license key across applications not covered by it.

The Bridge source is provided for integration and debugging. It may be modified
locally for your own use but not redistributed as a competing SDK.

## 3. No Warranty

THE SDK IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
BGEO IS NOT LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY ARISING FROM THE
USE OF THE SDK.

## 4. Termination

This license terminates automatically if you breach these terms. On termination
you must stop using and distributing the Binaries.

---

For commercial licensing and support: https://bgeo.dev  (placeholder)
