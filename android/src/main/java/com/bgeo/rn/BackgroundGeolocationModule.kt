package com.bgeo.rn

import com.bgeo.BGGeoEngine
import com.bgeo.BGGeoCallback
import com.bgeo.BGGeoHttpStore
import com.bgeo.BGGeoLogger

import android.Manifest
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.CxxCallbackImpl
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import org.json.JSONObject

/**
 * Background geolocation TurboModule (Transistor drop-in).
 *
 * Phase 0 is a stub: every method resolves a safe default (or rejects with a
 * clear "not ready" error) so the app boots and the codegen + autolinking build
 * is validated. Real FusedLocationProvider behaviour and the motion state
 * machine land in later phases, driven by a process-singleton engine.
 */
@ReactModule(name = BackgroundGeolocationModule.NAME)
class BackgroundGeolocationModule(reactContext: ReactApplicationContext) :
  NativeBackgroundGeolocationSpec(reactContext), LifecycleEventListener {

  init {
    BGGeoEngine.init(reactContext)
    BGGeoEngine.headlessDispatcher = RNHeadlessDispatcher()
    reactContext.addLifecycleEventListener(this)
  }

  // App foreground is one of the log-flush piggyback triggers (no radio wakes
  // of its own — see the native-logger spec). While foreground, the logger also
  // debounce-flushes each line so a watching console is near-realtime.
  override fun onHostResume() {
    BGGeoLogger.foreground = true
    BGGeoHttpStore.flushLogs()
  }

  override fun onHostPause() {
    BGGeoLogger.foreground = false
  }
  override fun onHostDestroy() {}

  /** Adapt the engine's bridge-neutral callback to an RN Promise. */
  private fun promiseCallback(promise: Promise): BGGeoCallback = object : BGGeoCallback {
    override fun success(result: JSONObject?) {
      promise.resolve(result?.toWritableMap())
    }
    override fun error(code: String, message: String) {
      promise.reject(code, message)
    }
  }

  override fun getName(): String = NAME

  @DoNotStrip
  override fun setEventEmitterCallback(eventEmitterCallback: CxxCallbackImpl) {
    super.setEventEmitterCallback(eventEmitterCallback)
    // Subscribe to the engine only once the emit* callback exists. Doing this
    // in init{} crashed (NPE): the engine can already be tracking (service
    // restart) and fire a location on the main thread in the window between
    // the Java constructor and the JSI wrapper's configureEventEmitterCallback.
    BGGeoEngine.eventEmitter = { name, body -> dispatchEvent(name, body.toWritableMap()) }
  }

  override fun invalidate() {
    // JS context tearing down: drop the live emitter so the engine routes
    // subsequent events to the headless task instead.
    BGGeoEngine.eventEmitter = null
    reactApplicationContext.removeLifecycleEventListener(this)
    super.invalidate()
  }

  private fun dispatchEvent(name: String, body: WritableMap) {
    // mEventEmitterCallback is write-once; the null-check guards the (non-
    // volatile) visibility race between the emitting thread and module setup.
    if (mEventEmitterCallback == null) return
    when (name) {
      "location" -> emitOnLocation(body)
      "locationerror" -> emitOnLocationError(body)
      "providerchange" -> emitOnProviderChange(body)
      "heartbeat" -> emitOnHeartbeat(body)
      "motionchange" -> emitOnMotionChange(body)
      "geofence" -> emitOnGeofence(body)
      "geofenceschange" -> emitOnGeofencesChange(body)
      "authorization" -> emitOnAuthorization(body)
      "powersavechange" -> emitOnPowerSaveChange(body)
      "http" -> emitOnHttp(body)
      "connectivitychange" -> emitOnConnectivityChange(body)
    }
  }

  // ---- lifecycle -----------------------------------------------------------

  override fun ready(config: ReadableMap?, promise: Promise) {
    BGGeoEngine.applyConfig(config?.toJSONObject())
    // A release build with an invalid/missing license does not start: reject
    // ready() with the LICENSE_* code (debuggable builds run unlicensed).
    BGGeoEngine.licenseErrorCode()?.let {
      promise.reject(it, "BGeo license check failed ($it)")
      return
    }
    // Transistor semantics: ready() auto-resumes tracking when it was enabled.
    // Without this, an install whose start() ran before permissions were granted
    // has enabled=true persisted but nothing running — and the app never calls
    // start() again because state.enabled is already true.
    BGGeoEngine.resumeTrackingIfEnabled()
    promise.resolve(BGGeoEngine.stateMap().toWritableMap())
  }

  override fun setConfig(config: ReadableMap?, promise: Promise) {
    BGGeoEngine.applyConfig(config?.toJSONObject())
    promise.resolve(BGGeoEngine.stateMap().toWritableMap())
  }

  override fun start(promise: Promise) {
    BGGeoEngine.licenseErrorCode()?.let {
      promise.reject(it, "BGeo license check failed ($it)")
      return
    }
    BGGeoEngine.startTracking()
    promise.resolve(BGGeoEngine.stateMap().toWritableMap())
  }

  override fun stop(promise: Promise) {
    BGGeoEngine.stopTracking()
    promise.resolve(BGGeoEngine.stateMap().toWritableMap())
  }

  override fun getState(promise: Promise) {
    promise.resolve(BGGeoEngine.stateMap().toWritableMap())
  }

  override fun changePace(isMoving: Boolean, promise: Promise) {
    if (BGGeoEngine.changePace(isMoving)) {
      promise.resolve(null)
    } else {
      promise.reject("DISABLED", "Cannot changePace while tracking is disabled")
    }
  }

  // ---- single-shot / watch -------------------------------------------------

  override fun getCurrentPosition(options: ReadableMap?, promise: Promise) {
    BGGeoEngine.getCurrentPosition(options?.toJSONObject(), promiseCallback(promise))
  }

  override fun watchPosition(options: ReadableMap?, promise: Promise) {
    BGGeoEngine.startWatch(options?.toJSONObject())
    promise.resolve(null)
  }

  override fun stopWatchPosition(promise: Promise) {
    BGGeoEngine.stopWatch()
    promise.resolve(null)
  }

  // ---- permission / provider ----------------------------------------------

  private var pendingPermissionPromise: Promise? = null

  private val permissionListener: PermissionListener = PermissionListener { requestCode, _, grantResults ->
    when (requestCode) {
      FINE_REQUEST -> {
        val granted = grantResults.isNotEmpty() &&
          grantResults.any { it == PackageManager.PERMISSION_GRANTED }
        val activity = reactApplicationContext.currentActivity as? PermissionAwareActivity
        // Escalate to background ("Allow all the time") as a separate Android 10+ prompt.
        if (granted && BGGeoEngine.wantsAlways() &&
          Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
          !BGGeoEngine.hasBackground() && activity != null
        ) {
          activity.requestPermissions(
            arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION),
            BACKGROUND_REQUEST,
            this.permissionListener,
          )
        } else {
          requestActivityRecognitionOrFinish(activity)
        }
        true
      }
      BACKGROUND_REQUEST -> {
        requestActivityRecognitionOrFinish(reactApplicationContext.currentActivity as? PermissionAwareActivity)
        true
      }
      ACTIVITY_RECOGNITION_REQUEST -> {
        finishPermission()
        true
      }
      else -> false
    }
  }

  /**
   * Activity Recognition is a separate Android 10+ runtime permission. Request it
   * as the final step of the chain; if already granted (or pre-Q) just finish.
   */
  private fun requestActivityRecognitionOrFinish(activity: PermissionAwareActivity?) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
      !BGGeoEngine.hasActivityRecognition() && activity != null
    ) {
      activity.requestPermissions(
        arrayOf(Manifest.permission.ACTIVITY_RECOGNITION),
        ACTIVITY_RECOGNITION_REQUEST,
        permissionListener,
      )
    } else {
      finishPermission()
    }
  }

  private fun finishPermission() {
    // Permissions may have just been granted: if tracking was already requested
    // (enabled=true persisted by an earlier start() that bailed on the missing
    // permission), bring the service up now.
    BGGeoEngine.resumeTrackingIfEnabled()
    BGGeoEngine.emitProviderChange()
    maybeShowAuthorizationAlert()
    pendingPermissionPromise?.resolve(BGGeoEngine.numericStatus())
    pendingPermissionPromise = null
  }

  /**
   * Android counterpart of the iOS `locationAuthorizationAlert`: when the
   * permission flow ends with location services off or insufficient authorization,
   * show a dialog (same config strings) that routes the user to app Settings.
   * Honours `disableLocationAuthorizationAlert`.
   */
  private fun maybeShowAuthorizationAlert() {
    val alert = BGGeoEngine.locationAuthorizationAlert() ?: return
    if (BGGeoEngine.disableLocationAuthorizationAlert()) return
    val activity = reactApplicationContext.currentActivity ?: return

    val sufficient =
      if (BGGeoEngine.wantsAlways()) BGGeoEngine.hasBackground() else BGGeoEngine.hasFineOrCoarse()
    val servicesEnabled = BGGeoEngine.locationServicesEnabled()
    val title: String = if (!servicesEnabled) {
      alert["titleWhenOff"] as? String ?: "Location access required"
    } else if (!sufficient) {
      alert["titleWhenNotEnabled"] as? String ?: "Location access required"
    } else {
      return // authorization is adequate -> nothing to show
    }

    val message = alert["instructions"] as? String ?: ""
    val cancel = alert["cancelButton"] as? String ?: "Cancel"
    val settings = alert["settingsButton"] as? String ?: "Settings"

    AlertDialog.Builder(activity)
      .setTitle(title)
      .setMessage(message)
      .setNegativeButton(cancel) { d, _ -> d.dismiss() }
      .setPositiveButton(settings) { d, _ ->
        d.dismiss()
        runCatching {
          val intent = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", reactApplicationContext.packageName, null),
          ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          reactApplicationContext.startActivity(intent)
        }
      }
      .setCancelable(false)
      .show()
  }

  override fun requestPermission(promise: Promise) {
    // Resolve immediately only when EVERYTHING we need is granted — background
    // location AND activity recognition. (Resolving on background alone skipped
    // the ACTIVITY_RECOGNITION request, so the Physical Activity prompt never
    // appeared once location had been granted.)
    if (BGGeoEngine.hasBackground() && BGGeoEngine.hasActivityRecognition()) {
      BGGeoEngine.emitProviderChange()
      promise.resolve(BGGeoEngine.numericStatus())
      return
    }

    val activity = reactApplicationContext.currentActivity as? PermissionAwareActivity
    if (activity == null) {
      promise.reject("0", "Cannot request permission: current activity is null")
      return
    }

    pendingPermissionPromise = promise
    // Start the chain at the first missing step so we still reach the
    // ACTIVITY_RECOGNITION request even when location was already granted.
    when {
      !BGGeoEngine.hasFineOrCoarse() -> activity.requestPermissions(
        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
        FINE_REQUEST,
        permissionListener,
      )
      BGGeoEngine.wantsAlways() &&
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
        !BGGeoEngine.hasBackground() -> activity.requestPermissions(
        arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION),
        BACKGROUND_REQUEST,
        permissionListener,
      )
      else -> requestActivityRecognitionOrFinish(activity)
    }
  }

  override fun getProviderState(promise: Promise) {
    promise.resolve(BGGeoEngine.providerState().toWritableMap())
  }

  override fun isPowerSaveMode(promise: Promise) {
    promise.resolve(BGGeoEngine.isPowerSaveMode())
  }

  override fun requestTemporaryFullAccuracy(purpose: String, promise: Promise) {
    promise.resolve(0) // Android has no reduced-accuracy session API — always "full"
  }

  // ---- odometer ------------------------------------------------------------

  override fun getOdometer(promise: Promise) {
    promise.resolve(BGGeoEngine.currentOdometer())
  }

  override fun setOdometer(value: Double, promise: Promise) {
    BGGeoEngine.setOdometer(value, promiseCallback(promise))
  }

  // ---- upload queue ----------------------------------------------------------

  override fun sync(promise: Promise) {
    BGGeoEngine.sync(promiseCallback(promise))
  }

  override fun getLocations(promise: Promise) {
    BGGeoEngine.getLocations(promiseCallback(promise))
  }

  override fun destroyLocations(promise: Promise) {
    BGGeoEngine.destroyLocations(promiseCallback(promise))
  }

  override fun getCount(promise: Promise) {
    promise.resolve(BGGeoEngine.pendingCount())
  }

  override fun destroyLocation(uuid: String, promise: Promise) {
    if (BGGeoEngine.destroyLocation(uuid)) {
      promise.resolve(null)
    } else {
      promise.reject("NOT_FOUND", "No queued location with uuid $uuid")
    }
  }

  override fun insertLocation(location: ReadableMap?, promise: Promise) {
    if (location == null) {
      promise.reject("INVALID_LOCATION", "expected a location object")
      return
    }
    BGGeoEngine.insertLocation(location.toJSONObject(), promiseCallback(promise))
  }

  // ---- auth ----------------------------------------------------------------

  override fun getAuthState(promise: Promise) {
    promise.resolve(BGGeoEngine.authStateMap().toWritableMap())
  }

  // ---- logger ---------------------------------------------------------------
  // NOTE: `override` is added in the TS-surface task once codegen regenerates
  // the spec with the four logger methods.

  override fun log(
    level: Double, event: String, message: String, dataJson: String, tag: String, promise: Promise,
  ) {
    BGGeoLogger.log(
      level = level.toInt(),
      event = event.ifEmpty { "app" },
      message = message.ifEmpty { null },
      data = dataJson.ifEmpty { null },
      // Logcat category only (engine default "BGGeo"): not persisted, never uploaded.
      tag = tag.ifEmpty { "BGGeo" },
      src = "js",
    )
    promise.resolve(null)
  }

  override fun getLog(limit: Double, promise: Promise) {
    val rows = com.bgeo.BGGeoDb.newestLogs(limit.toInt().coerceIn(1, 5000))
    val iso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
      .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
    val entries = org.json.JSONArray()
    rows.forEach { row ->
      entries.put(
        JSONObject().apply {
          put("ts", iso.format(java.util.Date(row.tsMs)))
          put("level", row.level)
          put("src", row.src)
          put("event", row.event)
          row.message?.let { put("message", it) }
          row.data?.let { raw -> put("data", runCatching { JSONObject(raw) }.getOrNull() ?: raw) }
        },
      )
    }
    promise.resolve(JSONObject().put("entries", entries).toWritableMap())
  }

  override fun destroyLog(promise: Promise) {
    promise.resolve(com.bgeo.BGGeoDb.deleteAllLogs())
  }

  override fun uploadLog(promise: Promise) {
    val pending = BGGeoHttpStore.pendingLogCount()
    BGGeoHttpStore.flushLogs()
    promise.resolve(pending)
  }

  // ---- geofences ------------------------------------------------------------

  override fun addGeofence(geofence: ReadableMap?, promise: Promise) {
    if (geofence == null) {
      promise.reject("INVALID_GEOFENCE", "expected {geofences: [...]}")
      return
    }
    BGGeoEngine.addGeofences(org.json.JSONArray().put(geofence.toJSONObject()), promiseCallback(promise))
  }

  override fun addGeofences(geofences: ReadableMap?, promise: Promise) {
    // Codegen maps the spec's `UnsafeObject` param to ReadableMap (not ReadableArray) on
    // Android; mirror getGeofences()'s {"geofences":[...]} shape on the way in. getArray
    // throws on a non-array value, so type-gate it (RNJsonConverters convention) to keep
    // the reject in this module's {code, message} shape. The engine gates the license.
    if (geofences == null || !geofences.hasKey("geofences") ||
      geofences.getType("geofences") != com.facebook.react.bridge.ReadableType.Array
    ) {
      promise.reject("INVALID_GEOFENCE", "expected {geofences: [...]}")
      return
    }
    BGGeoEngine.addGeofences(geofences.getArray("geofences")?.toJSONArray(), promiseCallback(promise))
  }

  override fun removeGeofence(identifier: String, promise: Promise) {
    BGGeoEngine.removeGeofence(identifier, promiseCallback(promise))
  }

  override fun removeGeofences(promise: Promise) {
    BGGeoEngine.removeGeofences(promiseCallback(promise))
  }

  override fun getGeofences(promise: Promise) {
    BGGeoEngine.getGeofences(promiseCallback(promise))
  }

  override fun geofenceExists(identifier: String, promise: Promise) {
    BGGeoEngine.geofenceExists(identifier, object : BGGeoCallback {
      override fun success(result: JSONObject?) { promise.resolve(result?.optBoolean("exists") ?: false) }
      override fun error(code: String, message: String) { promise.reject(code, message) }
    })
  }

  companion object {
    const val NAME = "RNBackgroundGeolocation"
    private const val FINE_REQUEST = 0xB1
    private const val BACKGROUND_REQUEST = 0xB2
    private const val ACTIVITY_RECOGNITION_REQUEST = 0xB3
  }
}
