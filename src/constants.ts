/**
 * Numeric constants `react-native-background-geolocation`
 * exactly. The app passes these straight through to native and compares
 * `onProviderChange.status` against `AUTHORIZATION_STATUS_ALWAYS` (3), so the
 * values MUST match the original library and the native engines must interpret
 * them identically.
 */

// ---- desiredAccuracy -------------------------------------------------------
export const DESIRED_ACCURACY_NAVIGATION = -2;
export const DESIRED_ACCURACY_HIGH = -1;
export const DESIRED_ACCURACY_MEDIUM = 10;
export const DESIRED_ACCURACY_LOW = 100;
export const DESIRED_ACCURACY_VERY_LOW = 1000;
export const DESIRED_ACCURACY_LOWEST = 3000;

// ---- logLevel --------------------------------------------------------------
export const LOG_LEVEL_OFF = 0;
export const LOG_LEVEL_ERROR = 1;
export const LOG_LEVEL_WARNING = 2;
export const LOG_LEVEL_INFO = 3;
export const LOG_LEVEL_DEBUG = 4;
export const LOG_LEVEL_VERBOSE = 5;

// ---- authorization status (onProviderChange.status / getProviderState) -----
export const AUTHORIZATION_STATUS_NOT_DETERMINED = 0;
export const AUTHORIZATION_STATUS_RESTRICTED = 1;
export const AUTHORIZATION_STATUS_DENIED = 2;
export const AUTHORIZATION_STATUS_ALWAYS = 3;
export const AUTHORIZATION_STATUS_WHEN_IN_USE = 4;

// ---- accuracyAuthorization (requestTemporaryFullAccuracy / providerchange) --
export const ACCURACY_AUTHORIZATION_FULL = 0;
export const ACCURACY_AUTHORIZATION_REDUCED = 1;

// ---- license error codes ---------------------------------------------------
// Rejected by ready()/start() (and getCurrentPosition/watchPosition) in a
// release build with an invalid license. Debuggable builds run unlicensed.
export const LICENSE_MISSING = 'LICENSE_MISSING';
export const LICENSE_INVALID = 'LICENSE_INVALID';
export const LICENSE_EXPIRED = 'LICENSE_EXPIRED';
export const LICENSE_APP_MISMATCH = 'LICENSE_APP_MISMATCH';

// ---- activity types --------------------------------------------------------
export const ACTIVITY_TYPE_STILL = 'still';
export const ACTIVITY_TYPE_ON_FOOT = 'on_foot';
export const ACTIVITY_TYPE_WALKING = 'walking';
export const ACTIVITY_TYPE_RUNNING = 'running';
export const ACTIVITY_TYPE_ON_BICYCLE = 'on_bicycle';
export const ACTIVITY_TYPE_IN_VEHICLE = 'in_vehicle';
export const ACTIVITY_TYPE_UNKNOWN = 'unknown';

/** Aggregated map of constants attached to the default export for parity. */
export const CONSTANTS = {
  DESIRED_ACCURACY_NAVIGATION,
  DESIRED_ACCURACY_HIGH,
  DESIRED_ACCURACY_MEDIUM,
  DESIRED_ACCURACY_LOW,
  DESIRED_ACCURACY_VERY_LOW,
  DESIRED_ACCURACY_LOWEST,
  LOG_LEVEL_OFF,
  LOG_LEVEL_ERROR,
  LOG_LEVEL_WARNING,
  LOG_LEVEL_INFO,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_VERBOSE,
  AUTHORIZATION_STATUS_NOT_DETERMINED,
  AUTHORIZATION_STATUS_RESTRICTED,
  AUTHORIZATION_STATUS_DENIED,
  AUTHORIZATION_STATUS_ALWAYS,
  AUTHORIZATION_STATUS_WHEN_IN_USE,
  ACCURACY_AUTHORIZATION_FULL,
  ACCURACY_AUTHORIZATION_REDUCED,
  LICENSE_MISSING,
  LICENSE_INVALID,
  LICENSE_EXPIRED,
  LICENSE_APP_MISMATCH,
} as const;
