import { CONSTANTS } from './constants';
import { EventBridge } from './EventBridge';
import { registerHeadlessTask } from './HeadlessRegistry';
import NativeBackgroundGeolocation from './NativeBackgroundGeolocation';

import type {
  Config,
  ConnectivityChangeCallback,
  CurrentPositionOptions,
  FailureCallback,
  Geofence,
  GeofencesChangeCallback,
  HeadlessTask,
  HttpCallback,
  Location,
  LocationCallback,
  LocationErrorCallback,
  LogEntry,
  ProviderChangeCallback,
  MotionChangeCallback,
  GeofenceCallback,
  HeartbeatCallback,
  PowerSaveChangeCallback,
  State,
  Subscription,
  SuccessCallback,
  WatchPositionOptions,
} from './types';

export * from './types';
export * from './constants';

/**
 * Drop-in facade `react-native-background-geolocation`
 * static API surface the app depends on. All legacy callback/event signatures are
 * reconstructed here on top of the Promise + EventEmitter codegen TurboModule.
 *
 * Note on lifecycle methods (ready/setConfig/start/stop): matching Transistor,
 * when a `failure` callback is supplied the returned promise RESOLVES with the
 * error (after invoking `failure`) instead of rejecting; without `failure` it
 * rejects normally. Call the promise-only form if you want `.catch` to fire.
 */

// Native emits `locationerror` as { code, message }; reduce it to the numeric
// code the Transistor LocationErrorCallback contract expects.
function toErrorCode(error: any): number {
  if (error != null && typeof error === 'object') {
    return Number(error.code);
  }
  return Number(error);
}

// App-side log lines ride the same native queue as engine logs (src:"js").
// `tag` is the Android logcat category only ('' = engine default "BGGeo") — it is
// not persisted and never reaches the server; iOS ignores it.
function logWrite(level: number, message: string, data?: object, tag?: string): Promise<void> {
  return NativeBackgroundGeolocation.log(
    level, 'app', message, data ? JSON.stringify(data) : '', tag ?? '',
  ).catch(() => {}); // logging must never throw into app code
}

// ---- watchPosition plumbing -----------------------------------------------
let watchLocationSub: Subscription | null = null;
let watchErrorSub: Subscription | null = null;

function clearWatchSubscriptions() {
  watchLocationSub?.remove();
  watchErrorSub?.remove();
  watchLocationSub = null;
  watchErrorSub = null;
}

const BackgroundGeolocation = {
  ...CONSTANTS,

  // ---- lifecycle ----------------------------------------------------------
  ready(
    config: Config,
    success?: SuccessCallback<State>,
    failure?: FailureCallback,
  ): Promise<State> {
    return (NativeBackgroundGeolocation.ready(config) as Promise<State>)
      .then((state: State) => {
        success?.(state);
        return state;
      })
      .catch((error: any) => {
        if (failure) {
          failure(error);
          return error;
        }
        throw error;
      });
  },

  setConfig(
    config: Config,
    success?: SuccessCallback<State>,
    failure?: FailureCallback,
  ): Promise<State> {
    return (NativeBackgroundGeolocation.setConfig(config) as Promise<State>)
      .then((state: State) => {
        success?.(state);
        return state;
      })
      .catch((error: any) => {
        if (failure) {
          failure(error);
          return error;
        }
        throw error;
      });
  },

  start(success?: SuccessCallback<State>, failure?: FailureCallback): Promise<State> {
    return (NativeBackgroundGeolocation.start() as Promise<State>)
      .then((state: State) => {
        success?.(state);
        return state;
      })
      .catch((error: any) => {
        if (failure) {
          failure(error);
          return error;
        }
        throw error;
      });
  },

  stop(success?: SuccessCallback<State>, failure?: FailureCallback): Promise<State> {
    return (NativeBackgroundGeolocation.stop() as Promise<State>)
      .then((state: State) => {
        success?.(state);
        return state;
      })
      .catch((error: any) => {
        if (failure) {
          failure(error);
          return error;
        }
        throw error;
      });
  },

  getState(): Promise<State> {
    return NativeBackgroundGeolocation.getState() as Promise<State>;
  },

  /** Manually force the moving/stationary state; rejects DISABLED while stopped. */
  changePace(isMoving: boolean): Promise<void> {
    return NativeBackgroundGeolocation.changePace(isMoving);
  },

  // ---- single-shot / watch ------------------------------------------------
  getCurrentPosition(options: CurrentPositionOptions = {}): Promise<Location> {
    return NativeBackgroundGeolocation.getCurrentPosition(options) as Promise<Location>;
  },

  watchPosition(
    success: LocationCallback,
    failure?: LocationErrorCallback,
    options: WatchPositionOptions = {},
  ): void {
    // Re-arm: drop any previous watch wiring first.
    clearWatchSubscriptions();

    watchLocationSub = EventBridge.on('location', (location: Location) => {
      // Native flags watch fixes via the echoed options.extras.watch marker so
      // the continuous watch stream stays distinct from ambient onLocation.
      if (location?.extras?.watch) {
        success(location);
      }
    });

    if (failure) {
      // Native emits locationerror as { code, message }; the Transistor failure
      // callback expects a numeric error code, so unwrap it here.
      watchErrorSub = EventBridge.on('locationerror', (error: any) => failure(toErrorCode(error)));
    }

    NativeBackgroundGeolocation.watchPosition(options).catch((error: any) => {
      failure?.(toErrorCode(error));
    });
  },

  stopWatchPosition(): Promise<void> {
    clearWatchSubscriptions();
    return NativeBackgroundGeolocation.stopWatchPosition();
  },

  // ---- permission / provider ---------------------------------------------
  requestPermission(): Promise<number> {
    return NativeBackgroundGeolocation.requestPermission();
  },

  /** iOS 14+: ask for temporary Precise accuracy. `purpose` must be a key in the
   * app's NSLocationTemporaryUsageDescriptionDictionary. Resolves
   * ACCURACY_AUTHORIZATION_FULL (0) or ACCURACY_AUTHORIZATION_REDUCED (1).
   * CAUTION: if `purpose` is missing from that plist dictionary, iOS may never
   * invoke the completion and this promise never settles. */
  requestTemporaryFullAccuracy(purpose: string): Promise<number> {
    return NativeBackgroundGeolocation.requestTemporaryFullAccuracy(purpose);
  },

  getProviderState(): Promise<{ status: number; [key: string]: any }> {
    return NativeBackgroundGeolocation.getProviderState() as Promise<{
      status: number;
      [key: string]: any;
    }>;
  },

  /** Current OS battery-saver (Android) / Low Power Mode (iOS) state. */
  isPowerSaveMode(): Promise<boolean> {
    return NativeBackgroundGeolocation.isPowerSaveMode();
  },

  // ---- odometer -----------------------------------------------------------
  /** Current odometer reading in metres. */
  getOdometer(): Promise<number> {
    return NativeBackgroundGeolocation.getOdometer();
  },

  setOdometer(value: number): Promise<Location> {
    return NativeBackgroundGeolocation.setOdometer(value) as Promise<Location>;
  },

  /** Zero the odometer; resolves the current Location (Transistor semantics). */
  resetOdometer(): Promise<Location> {
    return NativeBackgroundGeolocation.setOdometer(0) as Promise<Location>;
  },

  // ---- upload queue ---------------------------------------------------------
  /** Manually drain the native upload queue; resolves with the queued records. */
  sync(): Promise<Location[]> {
    // Snapshot the queue first (Transistor resolves sync() with the records).
    return (NativeBackgroundGeolocation.getLocations() as Promise<{ locations: Location[] }>)
      .then(({ locations }) =>
        NativeBackgroundGeolocation.sync().then(() => locations ?? []),
      );
  },

  /** Records currently queued for upload, oldest-first. */
  getLocations(): Promise<Location[]> {
    return (NativeBackgroundGeolocation.getLocations() as Promise<{ locations: Location[] }>)
      .then(({ locations }) => locations ?? []);
  },

  /** Delete every queued record; resolves with how many were removed. */
  destroyLocations(): Promise<number> {
    return (NativeBackgroundGeolocation.destroyLocations() as Promise<{ count: number }>)
      .then(({ count }) => count ?? 0);
  },

  /** Number of records currently queued for upload. */
  getCount(): Promise<number> {
    return NativeBackgroundGeolocation.getCount();
  },

  /** Delete one queued record by uuid; rejects NOT_FOUND when absent. */
  destroyLocation(uuid: string): Promise<void> {
    return NativeBackgroundGeolocation.destroyLocation(uuid);
  },

  /** Manually enqueue a record through the normal persist path (autoSync applies). A record whose uuid is already queued is silently ignored (uuid dedup). */
  insertLocation(location: Partial<Location> & Record<string, unknown>): Promise<void> {
    return NativeBackgroundGeolocation.insertLocation(location);
  },

  // ---- auth ---------------------------------------------------------------
  // Tokens the native uploader currently holds. It may have refreshed them while
  // the app was killed (background HTTP 401 -> /auth/refresh), so the app should
  // prefer these over its persisted copy on foreground to avoid a stale token.
  getAuthState(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    return NativeBackgroundGeolocation.getAuthState() as Promise<{
      accessToken: string | null;
      refreshToken: string | null;
    }>;
  },

  // ---- logger -------------------------------------------------------------
  /**
   * App log lines persisted in bgeo.db and uploaded with the engine's own auth.
   * The optional `tag` sets the ANDROID logcat category for the line
   * (`adb logcat -s MyTag`); it is not persisted, never uploaded, and ignored on
   * iOS. Omitted/empty means the engine default "BGGeo".
   */
  logger: {
    error: (message: string, data?: object, tag?: string) => logWrite(1, message, data, tag),
    warn: (message: string, data?: object, tag?: string) => logWrite(2, message, data, tag),
    info: (message: string, data?: object, tag?: string) => logWrite(3, message, data, tag),
    debug: (message: string, data?: object, tag?: string) => logWrite(4, message, data, tag),
    verbose: (message: string, data?: object, tag?: string) => logWrite(5, message, data, tag),
  },

  /** Newest-first persisted log entries. */
  getLog(limit: number = 500): Promise<LogEntry[]> {
    return (NativeBackgroundGeolocation.getLog(limit) as Promise<{ entries: LogEntry[] }>)
      .then(r => r?.entries ?? []);
  },

  /** Delete all persisted log entries; resolves with rows removed. */
  destroyLog(): Promise<number> {
    return NativeBackgroundGeolocation.destroyLog();
  },

  /** Manually trigger a log upload; resolves with rows handed to the flusher. */
  uploadLog(): Promise<number> {
    return NativeBackgroundGeolocation.uploadLog();
  },

  // ---- events -------------------------------------------------------------
  onLocation(success: LocationCallback, _failure?: LocationErrorCallback): Subscription {
    const sub = EventBridge.on('location', success);
    return sub;
  },

  onProviderChange(callback: ProviderChangeCallback): Subscription {
    return EventBridge.on('providerchange', callback);
  },

  onPowerSaveChange(callback: PowerSaveChangeCallback): Subscription {
    // Native emits { isPowerSaveMode }; Transistor callbacks receive the bare boolean.
    return EventBridge.on('powersavechange', (e: any) => callback(Boolean(e?.isPowerSaveMode)));
  },

  onHttp(callback: HttpCallback): Subscription {
    return EventBridge.on('http', callback);
  },

  onConnectivityChange(callback: ConnectivityChangeCallback): Subscription {
    // Transistor parity: a new listener immediately receives the current state —
    // unless a real event beats the getState() round-trip or the listener is
    // already removed by then.
    let sawRealEvent = false;
    let removed = false;
    const sub = EventBridge.on('connectivitychange', (e: any) => {
      sawRealEvent = true;
      callback(e);
    });
    NativeBackgroundGeolocation.getState()
      .then((state: any) => {
        if (removed || sawRealEvent) return;
        try {
          callback({connected: Boolean(state?.connected)});
        } catch (err) {
          console.warn('[BackgroundGeolocation] connectivitychange listener threw', err);
        }
      })
      .catch(() => {});
    return {
      remove: () => {
        removed = true;
        sub.remove();
      },
    };
  },

  onHeartbeat(callback: HeartbeatCallback): Subscription {
    return EventBridge.on('heartbeat', callback);
  },

  onMotionChange(callback: MotionChangeCallback): Subscription {
    return EventBridge.on('motionchange', callback);
  },

  onGeofence(callback: GeofenceCallback): Subscription {
    return EventBridge.on('geofence', callback);
  },

  // ---- geofences ----------------------------------------------------------
  addGeofence(geofence: Geofence): Promise<void> {
    return NativeBackgroundGeolocation.addGeofence(geofence);
  },

  addGeofences(geofences: Geofence[]): Promise<void> {
    // Codegen UnsafeObject marshals as a map, not an array — wrap the list.
    return NativeBackgroundGeolocation.addGeofences({ geofences });
  },

  removeGeofence(identifier: string): Promise<void> {
    return NativeBackgroundGeolocation.removeGeofence(identifier);
  },

  /** Removes ALL geofences (Transistor semantics). */
  removeGeofences(): Promise<void> {
    return NativeBackgroundGeolocation.removeGeofences();
  },

  getGeofences(): Promise<Geofence[]> {
    return (NativeBackgroundGeolocation.getGeofences() as Promise<{ geofences: Geofence[] }>)
      .then(r => r?.geofences ?? []);
  },

  geofenceExists(identifier: string): Promise<boolean> {
    return NativeBackgroundGeolocation.geofenceExists(identifier);
  },

  onGeofencesChange(callback: GeofencesChangeCallback): Subscription {
    return EventBridge.on('geofenceschange', callback);
  },

  /** Native token-refresh outcomes (authorization config). */
  onAuthorization(callback: (event: any) => void): Subscription {
    return EventBridge.on('authorization', callback);
  },

  removeListeners(): void {
    clearWatchSubscriptions();
    EventBridge.removeAll();
  },

  // ---- headless -----------------------------------------------------------
  registerHeadlessTask(task: HeadlessTask): void {
    registerHeadlessTask(task);
  },
};

export default BackgroundGeolocation;
