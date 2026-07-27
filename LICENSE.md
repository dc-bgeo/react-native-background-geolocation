# BGeo SDK — License

Copyright (c) 2026 BGeo.

This package is licensed in two parts:

| Part | Files | License |
| --- | --- | --- |
| **Bridge** (open) | `src/`, `lib/`, `android/src/`, `android/build.gradle`, `ios/RNBackgroundGeolocation.{h,mm}`, `RNBackgroundGeolocation.podspec`, `react-native.config.js` | MIT — Part A |
| **Binaries** (closed) | `ios/BGeoCore.xcframework`, `android/libs/` (the `com.bgeo:bgeo-android` AAR) | Proprietary — Part B |

Because the package as distributed contains both, its npm `license` field is
`SEE LICENSE IN LICENSE.md` rather than `MIT`.

---

## Part A — Bridge (MIT License)

Copyright (c) 2026 BGeo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

This MIT grant covers the Bridge only. It does not grant any right in the
Binaries, which remain governed by Part B — the Bridge on its own does not
function without them.

---

## Part B — Binaries (Proprietary License Agreement)

Copyright (c) 2026 BGeo. All rights reserved.

This Part governs the closed-source binary components: the
`BGeoCore.xcframework` for iOS and the `com.bgeo:bgeo-android` AAR under
`android/libs` (collectively the "Binaries").

### 1. Grant

Subject to a valid, current license key issued by BGeo and to these terms, BGeo
grants you a non-exclusive, non-transferable license to install and use the
Binaries in applications you develop and distribute.

- **Development / evaluation.** Debuggable builds and the iOS simulator run
  without a license key for evaluation.
- **Production.** A release build requires a valid license key bound to your
  application identifier (and signing certificate on Android / Team ID on iOS).
  Without one, the SDK refuses to start and returns a `LICENSE_*` error.

A license key is valid for one year. Applications built with an SDK version
released during your license term keep working after the term ends; renewing
grants access to SDK versions released after it.

### 2. Restrictions

You may NOT: (a) decompile, disassemble, reverse-engineer, or otherwise attempt
to derive the source of the Binaries; (b) redistribute, sublicense, rent, or
resell the Binaries except as embedded in your own applications; (c) remove or
circumvent the license mechanism or any binding to your application; (d) share
a license key across applications not covered by it.

### 3. No Warranty

THE BINARIES ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED. BGEO IS NOT LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY ARISING
FROM THEIR USE.

### 4. Termination

This Part terminates automatically if you breach its terms. On termination you
must stop using and distributing the Binaries. The MIT grant in Part A is
unaffected.

---

For commercial licensing and support: https://bgeo.dev
