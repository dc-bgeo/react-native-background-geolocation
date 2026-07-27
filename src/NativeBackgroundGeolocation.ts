import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

import type {
  EventEmitter,
  Int32,
  Double,
  UnsafeObject,
} from 'react-native/Libraries/Types/CodegenTypes';

/**
 * Codegen TurboModule spec for the background geolocation engine.
 *
 * Codegen forbids method overloading, optional positional callbacks and
 * arbitrary unions, so the native surface is intentionally Promise-only and
 * passes `config`/`location` as `UnsafeObject`. The legacy Transistor-shaped
 * callback/event API the app depends on is reconstructed entirely in JS
 * (see `index.ts` + `EventBridge.ts`). Native validates/normalizes the loose
 * objects.
 */
export interface Spec extends TurboModule {
  // ---- lifecycle ----------------------------------------------------------
  ready(config: UnsafeObject): Promise<UnsafeObject>; // resolves State
  setConfig(config: UnsafeObject): Promise<UnsafeObject>; // resolves State
  start(): Promise<UnsafeObject>; // resolves State
  stop(): Promise<UnsafeObject>; // resolves State
  getState(): Promise<UnsafeObject>;
  changePace(isMoving: boolean): Promise<void>; // manual moving/stationary override; rejects DISABLED

  // ---- single-shot / watch ------------------------------------------------
  getCurrentPosition(options: UnsafeObject): Promise<UnsafeObject>; // Location
  watchPosition(options: UnsafeObject): Promise<void>; // streams via onLocation
  stopWatchPosition(): Promise<void>;

  // ---- permission / provider ---------------------------------------------
  requestPermission(): Promise<Int32>; // numeric AUTHORIZATION_STATUS_*
  // iOS 14+: temporary Precise-accuracy request; resolves ACCURACY_AUTHORIZATION_*
  // (0 full / 1 reduced). Android + iOS<14 resolve 0.
  requestTemporaryFullAccuracy(purpose: string): Promise<Int32>;
  getProviderState(): Promise<UnsafeObject>; // { status, enabled, gps, network }
  isPowerSaveMode(): Promise<boolean>; // OS battery-saver / Low Power Mode state

  // ---- odometer -----------------------------------------------------------
  getOdometer(): Promise<Double>; // metres
  setOdometer(value: Double): Promise<UnsafeObject>; // resolves Location

  // ---- upload queue ---------------------------------------------------------
  sync(): Promise<UnsafeObject>; // { count } — pending records handed to the drain
  getLocations(): Promise<UnsafeObject>; // { locations: Location[] }
  destroyLocations(): Promise<UnsafeObject>; // { count } — records removed
  getCount(): Promise<Int32>; // records currently in the upload queue
  destroyLocation(uuid: string): Promise<void>; // rejects NOT_FOUND when absent
  insertLocation(location: UnsafeObject): Promise<void>; // normal persist path (autoSync/cap apply)

  // ---- auth ---------------------------------------------------------------
  // Tokens the native uploader currently holds (it may have refreshed them while
  // the app was killed); JS reconciles Redux against these on foreground.
  getAuthState(): Promise<UnsafeObject>; // { accessToken, refreshToken }

  // ---- logger -------------------------------------------------------------
  log(level: Double, event: string, message: string, dataJson: string): Promise<void>;
  getLog(limit: Double): Promise<UnsafeObject>; // { entries: LogEntry[] } newest-first
  destroyLog(): Promise<Int32>; // rows removed
  uploadLog(): Promise<Int32>; // rows handed to the flusher

  // ---- typed native event channels ---------------------------------------
  readonly onLocation: EventEmitter<UnsafeObject>;
  readonly onLocationError: EventEmitter<UnsafeObject>;
  readonly onProviderChange: EventEmitter<UnsafeObject>;
  readonly onHeartbeat: EventEmitter<UnsafeObject>;
  readonly onMotionChange: EventEmitter<UnsafeObject>;
  readonly onGeofence: EventEmitter<UnsafeObject>;
  // Native token refresh outcomes (authorization config): {success, accessToken,
  // refreshToken} or {success:false, status}.
  readonly onAuthorization: EventEmitter<UnsafeObject>;
  // OS battery-saver / Low Power Mode transitions: { isPowerSaveMode }.
  readonly onPowerSaveChange: EventEmitter<UnsafeObject>;
  // Location-sync HTTP responses: { success, status, responseText } (status 0 = network error).
  readonly onHttp: EventEmitter<UnsafeObject>;
  // Validated-internet connectivity transitions: { connected }.
  readonly onConnectivityChange: EventEmitter<UnsafeObject>;

  // ---- geofences ----------------------------------------------------------
  addGeofence(geofence: UnsafeObject): Promise<void>;
  addGeofences(geofences: UnsafeObject): Promise<void>;
  removeGeofence(identifier: string): Promise<void>;
  removeGeofences(): Promise<void>;
  getGeofences(): Promise<UnsafeObject>;
  geofenceExists(identifier: string): Promise<boolean>;
  readonly onGeofencesChange: EventEmitter<UnsafeObject>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNBackgroundGeolocation');
