/**
 * Hand-written TypeScript types
 * `react-native-background-geolocation` shapes the app consumes. These restore
 * the type-safety lost by passing `UnsafeObject` across the codegen boundary.
 *
 * Only the fields the app (and backend) actually rely on are typed strictly;
 * everything else is permissive so the loose native payload validates.
 */

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  altitude_accuracy?: number;
  speed?: number;
  speed_accuracy?: number;
  heading?: number;
  heading_accuracy?: number;
  ellipsoidal_altitude?: number;
}

export interface MotionActivity {
  type: 'still' | 'on_foot' | 'walking' | 'running' | 'on_bicycle' | 'in_vehicle' | 'unknown';
  confidence: number;
}

export interface Battery {
  level: number;
  is_charging: boolean;
}

export interface Location {
  uuid: string;
  timestamp: string;
  age?: number;
  odometer: number;
  coords: Coords;
  activity: MotionActivity;
  battery: Battery;
  /**
   * `null` while a cold-started session's first fixes are still in the
   * "unconfirmed MOVING" probing window — up to `stopTimeout` minutes
   * (default 5) after `start()`. The engine sends `NSNull` here by design so
   * the server falls back to speed rather than a phantom "started moving"
   * being fabricated (`core/ios/Sources/BGGeoEngine.mm:2826`). Treat `null`
   * the same as `false`.
   */
  is_moving: boolean | null;
  sample?: boolean;
  event?: string;
  /** Arbitrary passthrough — the app sets { heartBeat | watch | getCurrentPosition }. */
  extras?: { [key: string]: any };
}

export interface ProviderChangeEvent {
  /** AUTHORIZATION_STATUS_* — 3 === Always. */
  status: number;
  enabled: boolean;
  gps: boolean;
  network: boolean;
  accuracyAuthorization?: number;
}

export interface MotionChangeEvent {
  isMoving: boolean;
  /**
   * The location that triggered (or accompanies) the transition. Absent on
   * Android / `null` on iOS for the first `motionchange` of a tracking session —
   * the initial `enterMoving` probe fires from `startTracking` before any fix
   * exists. Guard before dereferencing.
   */
  location?: Location | null;
}

export interface GeofenceEvent {
  identifier: string;
  action: 'ENTER' | 'EXIT' | 'DWELL';
  location: Location;
  extras?: { [key: string]: any };
}

export interface State {
  enabled: boolean;
  trackingActive?: boolean;
  authorization?: number;
  /** Seconds since the last raw fix (before filtering); null until one arrives. */
  lastRawFixAge?: number | null;
  /** Seconds since the last accepted fix (after filtering); null until one arrives. */
  lastAcceptedFixAge?: number | null;
  lastLocationError?: string | null;
  locationFailureCount?: number;
  backgroundRearmCount?: number;
  watchdogRecoveryCount?: number;
  wakeRearmCount?: number;
  stationaryRegionArmed?: boolean;
  monitoredWakeRegions?: number;
  lastWakeError?: string | null;
  trackingMode?: number;
  isMoving?: boolean;
  schedulerEnabled?: boolean;
  odometer?: number;
  geofenceCount?: number;
  lastGeofenceError?: string | null;
  /** Validated-internet connectivity (see ConnectivityChangeEvent). */
  connected?: boolean;
  [key: string]: any;
}

export interface Geofence {
  identifier: string;
  radius: number;
  latitude: number;
  longitude: number;
  notifyOnEntry?: boolean;
  notifyOnExit?: boolean;
  notifyOnDwell?: boolean;
  loiteringDelay?: number;
  extras?: { [key: string]: any };
}

export interface CurrentPositionOptions {
  persist?: boolean;
  samples?: number;
  timeout?: number;
  maximumAge?: number;
  desiredAccuracy?: number;
  extras?: { [key: string]: any };
}

export interface WatchPositionOptions {
  interval?: number;
  desiredAccuracy?: number;
  persist?: boolean;
  extras?: { [key: string]: any };
}

/** Permissive config — only the keys the app passes are documented here. */
export interface Config {
  // The license key is NOT a config option — set it in the app manifest:
  //   Android: <meta-data android:name="com.bgeo.license" android:value="BGEO1..."/>
  //   iOS:     Info.plist <key>BGeoLicense</key><string>BGEO1...</string>
  // Same mechanism for React Native / native / Flutter; read at launch before
  // JS runs. In a RELEASE build a bad key makes ready()/start() reject with a
  // LICENSE_* code; debuggable builds / the iOS simulator always run unlicensed
  // (evaluation), whatever the key state.
  locationAuthorizationRequest?: string;
  locationAuthorizationAlert?: { [key: string]: string };
  /** Suppress the Settings-nudge alert driven by `locationAuthorizationAlert`. Default false. */
  disableLocationAuthorizationAlert?: boolean;
  /** @unsupported No-op on iOS; Android uses the OS permission rationale flow. */
  backgroundPermissionRationale?: { [key: string]: string };
  desiredAccuracy?: number;
  distanceFilter?: number;
  /** Bypass the Kalman/accuracy/teleport filter entirely. Default false. */
  disableLocationFilter?: boolean;
  /** Reject fixes with accuracy worse than this (metres). Default 100. */
  locationFilterMaxAccuracy?: number;
  /** Teleport rejection: max implied speed between fixes (m/s). Default 60. */
  locationFilterMaxSpeed?: number;
  /** Filter decision phase: 'Conservative' (default — reject teleport fixes) |
   * 'Adjust' (cap teleports to the kinematic limit instead of dropping) |
   * 'PassThrough' (accuracy gate only; no teleport rejection, no Kalman
   * smoothing). Case-insensitive. Applied when the filter is (re)built at
   * tracking start/stop — not live on setConfig. */
  locationFilterPolicy?: string;
  /** Kalman tuning preset: 'DEFAULT' | 'AGGRESSIVE' (faster response, less lag)
   * | 'CONSERVATIVE' (maximum smoothing). Case-insensitive. Applied when the
   * filter is (re)built at tracking start/stop — not live on setConfig. */
  kalmanProfile?: string;
  /** Fixes with accuracy worse than this (metres) don't advance the odometer.
   * 0 = off (default; tracking/upload unaffected — odometer only). */
  odometerAccuracyThreshold?: number;
  /** Pin distanceFilter to its base value (no speed-elastic scaling). Default false. */
  disableElasticity?: boolean;
  /** Speed-elastic distanceFilter scaling intensity. Default 1.0. */
  elasticityMultiplier?: number;
  /** Accuracy tier for the stationary keep-alive stream: HIGH | BALANCED | LOW. Default BALANCED. */
  stationaryDesiredAccuracy?: string;
  /** @platform android Stationary fused request interval (ms). Default 30000. No-op on iOS. */
  stationaryLocationUpdateInterval?: number;
  /** CSV of activity names that count as "moving" (e.g. "in_vehicle,on_bicycle,walking,running,on_foot"). */
  triggerActivities?: string;
  /** Min activity-recognition confidence 0-100. Default 75 Android; 50 iOS (coarse 33/66/100 scale). */
  minimumActivityRecognitionConfidence?: number;
  /** @platform android Activity-recognition poll interval (ms). Default 10000. No-op on iOS. */
  activityRecognitionInterval?: number;
  /** Ignore motion-activity updates (motion machine falls back to speed + stationary geofence). Default false. */
  disableMotionActivityUpdates?: boolean;
  stopTimeout?: number;
  /** @platform ios Show the blue background-location pill under Always auth. false + Always also skips the session engine's CLBackgroundActivitySession to hide the pill (beta — needs field tests). No-op on Android. */
  showsBackgroundLocationIndicator?: boolean;
  stationaryRadius?: number;
  /** @platform ios Low-power continuous wake distance; independent of the larger region radius. No-op on Android. */
  stationaryDistanceFilter?: number;
  /** @platform ios Hold a background task while backgrounded+stationary. No-op on Android. */
  preventSuspend?: boolean;
  heartbeatInterval?: number;
  motionTriggerDelay?: number;
  /** @platform android Fused moving-request interval (ms). Default 1000. No-op on iOS. */
  locationUpdateInterval?: number;
  /** @unsupported No-op. The Android foreground service is always on while tracking. */
  foregroundService?: boolean;
  /** @platform android Foreground-service notification. No-op on iOS.
   * `priority` is Transistor NOTIFICATION_PRIORITY_*: -2 MIN (default) .. 2 MAX —
   * it also sets the channel importance, which Android freezes per channelId
   * (change channelId to change it). `smallIcon` = "drawable/name" | "mipmap/name";
   * `color` = "#RRGGBB". */
  notification?: {
    title?: string;
    text?: string;
    channelId?: string;
    channelName?: string;
    smallIcon?: string;
    color?: string;
    priority?: number;
  };
  stopOnTerminate?: boolean;
  startOnBoot?: boolean;
  /** Plays a one-shot debug sound cue per event (Android/iOS). Does NOT affect tracking. */
  debug?: boolean;
  /** Native log persistence gate: 0=OFF (default) .. 5=VERBOSE (LOG_LEVEL_* constants). */
  logLevel?: number;
  /** Days to retain native log rows. Default 3. */
  logMaxDays?: number;
  /** Absolute URL for native log batch upload ({events:[...]}); unset = local-only. */
  logUrl?: string;
  maxDaysToPersist?: number;
  url?: string;
  /** HTTP verb for uploads: POST (default) | PUT | PATCH. */
  method?: string;
  headers?: { [key: string]: string };
  /** Merged into the request body root alongside the location payload. */
  params?: { [key: string]: any };
  /** Merged into every uploaded record's `extras` (per-call extras win). */
  extras?: { [key: string]: any };
  /** Body key carrying the location(s); default "location". "." merges a single record into the root. */
  httpRootProperty?: string;
  /** Default true. */
  autoSync?: boolean;
  /** Defer AUTO-sync while on cellular (queue drains on Wi-Fi/ethernet arrival).
   * Explicit sync() always uploads. Default false. */
  disableAutoSyncOnCellular?: boolean;
  autoSyncThreshold?: number;
  batchSync?: boolean;
  maxBatchSize?: number;
  httpTimeoutMs?: number;
  maxRecordsToPersist?: number;
  /**
   * Native token refresh: on a 401/403 the uploader exchanges `refreshToken`
   * at `refreshUrl` (headers `refreshHeaders`, body `refreshPayload` with the
   * "{refreshToken}" placeholder substituted; default { refresh_token }) so
   * killed-app uploads survive an access-token expiry without a live JS
   * context. Outcomes surface via onAuthorization.
   */
  authorization?: {
    strategy?: 'JWT';
    accessToken?: string;
    refreshToken?: string;
    refreshUrl?: string;
    refreshPayload?: { [key: string]: any };
    refreshHeaders?: { [key: string]: string };
  };
  // Keep a low-power location request alive while stationary (fast wake source
  // on trip start). Default true; false restores fully-sleep-GPS (slower wake).
  stationaryKeepAlive?: boolean;
  // Upload a compact native diagnostic snapshot in every point's `extras`
  // (counters, app/motion state, manager config) — test devices only.
  diagnosticExtras?: boolean;
  // Session engine (iOS 17+): deliver via CLLocationUpdate.liveUpdates +
  // CLBackgroundActivitySession while moving instead of legacy
  // startUpdatingLocation (which iOS suspends between significant-change wakes).
  // Default true (since 2026-07-23); kept as a remote-config kill-switch.
  // iOS < 17 always uses the legacy path regardless of this flag.
  // Android: silently ignored (stored but unread) — iOS-only key.
  useSessionEngine?: boolean;
  // Proximity slicing for app-facing geofences: only the nearest N within this
  // radius (metres) of the last fix are registered with the OS. Default 1000.
  geofenceProximityRadius?: number;
  // Cap on OS-registered geofences after proximity filtering (platform budget:
  // 19 iOS / 99 Android). <=0 uses the platform budget as-is. Default -1.
  maxMonitoredGeofences?: number;
  // Requests a synthetic ENTER for geofences already-inside on registration
  // (iOS requestStateForRegion / Android INITIAL_TRIGGER_ENTER). Default true.
  geofenceInitialTriggerEntry?: boolean;
  [key: string]: any;
}

export interface GeofencesChangeEvent {
  on: Geofence[];
  off: Geofence[];
}

/** Fate of one location-sync HTTP request (one event per request). */
export interface HttpEvent {
  /** true when status is 2xx. */
  success: boolean;
  /** HTTP status code; 0 when the request never got a response (network error). */
  status: number;
  /** Response body (or the error message when status is 0), truncated to 1024 characters. */
  responseText: string;
}

/**
 * Network connectivity transition. `connected` = validated internet
 * (Android NET_CAPABILITY_VALIDATED / iOS NWPath satisfied) — captive-portal
 * Wi-Fi reports false. Fired on change; a new listener immediately receives
 * the current state.
 */
export interface ConnectivityChangeEvent {
  connected: boolean;
}

export type LocationCallback = (location: Location) => void;
export type LocationErrorCallback = (errorCode: number) => void;
export type ProviderChangeCallback = (event: ProviderChangeEvent) => void;
export type MotionChangeCallback = (event: MotionChangeEvent) => void;
export type GeofenceCallback = (event: GeofenceEvent) => void;
export type GeofencesChangeCallback = (event: GeofencesChangeEvent) => void;
export type HeartbeatCallback = (event: { [key: string]: any }) => void;
export type PowerSaveChangeCallback = (isPowerSaveMode: boolean) => void;
export type HttpCallback = (event: HttpEvent) => void;
export type ConnectivityChangeCallback = (event: ConnectivityChangeEvent) => void;
export type SuccessCallback<T> = (result: T) => void;
export type FailureCallback = (error: any) => void;

export interface Subscription {
  remove(): void;
}

export interface LogEntry {
  ts: string; // ISO-8601 UTC
  level: number; // 1=ERROR 2=WARN 3=INFO 4=DEBUG 5=VERBOSE
  src: 'native' | 'js';
  event: string;
  message?: string;
  data?: any;
}

export interface HeadlessEvent {
  /**
   * The event type. Matches the Android engine's headless dispatch set exactly —
   * high-frequency `location`/`locationerror` fixes are deliberately NOT
   * forwarded headlessly (they would spin up `HeadlessJsTaskService` + a wakelock
   * per fix); they stay durably queued and uploaded natively.
   */
  name: 'heartbeat' | 'motionchange' | 'geofence' | 'providerchange' | 'powersavechange' | 'http' | 'connectivitychange';
  /** The event's payload fields are flattened alongside `name` (there is no `params` wrapper). */
  [key: string]: any;
}

export type HeadlessTask = (event: HeadlessEvent) => Promise<void> | void;
