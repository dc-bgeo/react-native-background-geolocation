require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNBackgroundGeolocation"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.description  = package["description"]
  s.homepage     = "https://bgeo.dev/"
  # Dual: the bridge sources here are MIT, the vendored BGeoCore.xcframework is
  # proprietary. Both parts are spelled out in LICENSE.md.
  s.license      = { :type => "Commercial", :file => "LICENSE.md" }
  s.authors      = { "tracker" => "dmitry.chistik@gmail.com" }
  s.platforms    = { :ios => "15.5" }
  s.source       = { :path => "." }

  # Open TurboModule bridge only; the engine ships as the prebuilt closed
  # BGeoCore.xcframework (built from the private core repo by
  # core/tools/build-ios.sh). The engine API surface the bridge (and an app's
  # bridging header) compiles against is <BGeoCore/BGGeoEngine.h>.
  s.source_files = "ios/*.{h,mm}"
  s.vendored_frameworks = "ios/BGeoCore.xcframework"
  s.requires_arc = true

  # System frameworks used by the vendored engine (AudioToolbox plays the debug cues).
  s.frameworks = "CoreLocation", "CoreMotion", "UIKit", "AudioToolbox"

  # Pulls in React-Core / the generated codegen spec pod and configures the
  # New Architecture build flags. Required for the TurboModule + EventEmitter glue.
  install_modules_dependencies(s)
end
