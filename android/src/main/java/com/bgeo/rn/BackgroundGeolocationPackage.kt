package com.bgeo.rn

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class BackgroundGeolocationPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == BackgroundGeolocationModule.NAME) {
      BackgroundGeolocationModule(reactContext)
    } else {
      null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val isTurboModule = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      mapOf(
        BackgroundGeolocationModule.NAME to ReactModuleInfo(
          BackgroundGeolocationModule.NAME,
          BackgroundGeolocationModule.NAME,
          false, // canOverrideExistingModule
          true,  // needsEagerInit (engine + headless wiring should be live early)
          false, // isCxxModule
          isTurboModule,
        ),
      )
    }
  }
}
