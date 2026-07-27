package com.bgeo.rn

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Runs the JS task registered via `registerHeadlessTask('BackgroundGeolocation', ...)`
 * when the app/JS context has been torn down but the process is still alive (the
 * foreground service keeps it running). The engine dispatches events here when no
 * live JS emitter is present. The task data carries a top-level `name`
 * (e.g. "heartbeat") — `index.js` keys on `event.name === 'heartbeat'`.
 */
class HeadlessTaskService : HeadlessJsTaskService() {

  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras = intent?.extras ?: return null
    return HeadlessJsTaskConfig(
      "BackgroundGeolocation",
      Arguments.fromBundle(extras),
      30000, // task timeout (ms)
      true, // allowedInForeground
    )
  }
}
