package com.bgeo.rn

import com.bgeo.BGGeoHeadlessDispatcher

import android.content.Context
import android.content.Intent
import android.os.Bundle
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import org.json.JSONObject

/**
 * RN implementation of the engine's headless sink: starts [HeadlessTaskService]
 * (which boots the React context if needed and runs the registered JS task) and
 * grabs the standard headless wakelock. Registered programmatically by
 * [BackgroundGeolocationModule] and, for processes where RN never loads
 * (boot / geofence restart), via the manifest meta-data `com.bgeo.HEADLESS_DISPATCHER`
 * — so it must keep a public no-arg constructor.
 */
class RNHeadlessDispatcher : BGGeoHeadlessDispatcher {

  override fun dispatch(context: Context, event: String, payload: JSONObject) {
    val bundle: Bundle = Arguments.toBundle(payload.toWritableMap()) ?: Bundle()
    bundle.putString("name", event)
    val intent = Intent(context, HeadlessTaskService::class.java).putExtras(bundle)
    context.startService(intent)
    HeadlessJsTaskService.acquireWakeLockNow(context)
  }
}
