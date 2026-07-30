/** Declarative schema of the SDK's working Config keys — single source for the
 * Settings screen UI and for reset-to-defaults. Documented no-op keys
 * (foregroundService, backgroundPermissionRationale) are excluded.
 * `default` is the effective engine/app default shown when no override is set. */

import {Platform} from 'react-native';
import type {Config} from '@dc-bgeo/react-native-background-geolocation';

/** A default that differs between the iOS and Android engines — see
 * `resolveDefault`. Use only when the two engines' own literal fallbacks
 * genuinely disagree (rare: `minimumActivityRecognitionConfidence` below is
 * currently the one known case). Most fields keep a single `default`. */
export type PlatformDefault = {ios: boolean | number | string; android: boolean | number | string};

export type ConfigField = {
  key: string;
  label: string;
  type: 'bool' | 'number' | 'enum' | 'string';
  /** enum choices */
  options?: {label: string; value: number | string}[];
  default: boolean | number | string | null | PlatformDefault;
  unit?: string;
  platform?: 'ios' | 'android';
  hint?: string;
};

function isPlatformDefault(value: unknown): value is PlatformDefault {
  return typeof value === 'object' && value !== null && 'ios' in value && 'android' in value;
}

/** Resolves a field's `default` (single value, or a per-platform pair) for
 * one platform. `os` is an explicit parameter rather than reading
 * `Platform.OS` internally, so this stays a pure function — unit-testable
 * for both platforms from a single Jest run, no react-native Platform
 * mocking needed. Production call sites omit it and get the current device. */
export function resolveDefault(
  value: ConfigField['default'],
  os: 'ios' | 'android' = Platform.OS as 'ios' | 'android',
): boolean | number | string | null {
  return isPlatformDefault(value) ? value[os] : value;
}

/** Whether `field` applies to `os` (defaults to the running platform). A
 * field with no `platform` tag applies to both — same "common case needs no
 * tag" rule `resolveDefault` uses for values. `os` is an explicit parameter
 * for the same reason: pure, unit-testable for both platforms without
 * mocking react-native's `Platform`. */
export function appliesToPlatform(
  field: Pick<ConfigField, 'platform'>,
  os: 'ios' | 'android' = Platform.OS as 'ios' | 'android',
): boolean {
  return !field.platform || field.platform === os;
}

export type ConfigSection = {title: string; fields: ConfigField[]};

/** Base config the example app passes to ready() (before user overrides). */
export const BASE_CONFIG: Config = {
  distanceFilter: 10,
  stopTimeout: 5,
  debug: true,
  startOnBoot: false,
  stopOnTerminate: true,
  // Native logger at INFO for the example app; upload starts once a device
  // link supplies logUrl (deviceLink.applySdkConfig).
  logLevel: 3,
};

const ACCURACY_OPTIONS = [
  {label: 'NAV', value: -2},
  {label: 'HIGH', value: -1},
  {label: 'MED', value: 10},
  {label: 'LOW', value: 100},
  {label: 'V.LOW', value: 1000},
];

const STATIONARY_ACCURACY_OPTIONS = [
  {label: 'HIGH', value: 'HIGH'},
  {label: 'BAL', value: 'BALANCED'},
  {label: 'LOW', value: 'LOW'},
];

export const CONFIG_SECTIONS: ConfigSection[] = [
  {
    title: 'Geolocation',
    fields: [
      {key: 'desiredAccuracy', label: 'Desired accuracy', type: 'enum', options: ACCURACY_OPTIONS, default: -1},
      {key: 'distanceFilter', label: 'Distance filter', type: 'number', unit: 'm', default: 10},
      // CORRECTED — engine default 200 on both platforms (core/ios/Sources/BGGeoEngine.mm:809,
      // core/android/.../BGGeoEngine.kt:636), not 25.
      {key: 'stationaryRadius', label: 'Stationary radius', type: 'number', unit: 'm', default: 200},
      // iOS-only: read by the session engine's stationary distance gate
      // (core/ios/Sources/BGGeoEngine.mm:1466, :1827). Zero occurrences under
      // core/android/engine — a no-op on Android (already doc-tagged
      // `@platform ios` on both SDKs' Config types).
      {key: 'stationaryDistanceFilter', label: 'Stationary distance filter', type: 'number', unit: 'm', default: 75, platform: 'ios'},
      {key: 'stationaryDesiredAccuracy', label: 'Stationary accuracy', type: 'enum', options: STATIONARY_ACCURACY_OPTIONS, default: 'BALANCED'},
      {key: 'stationaryKeepAlive', label: 'Stationary keep-alive', type: 'bool', default: true},
      {key: 'locationUpdateInterval', label: 'Moving interval', type: 'number', unit: 'ms', default: 1000, platform: 'android'},
      {key: 'showsBackgroundLocationIndicator', label: 'BG location indicator', type: 'bool', default: false, platform: 'ios'},
      {key: 'disableLocationFilter', label: 'Disable Kalman filter', type: 'bool', default: false},
      {key: 'locationFilterMaxAccuracy', label: 'Filter max accuracy', type: 'number', unit: 'm', default: 100},
      {key: 'locationFilterMaxSpeed', label: 'Filter max speed', type: 'number', unit: 'm/s', default: 60},
      {key: 'locationFilterPolicy', label: 'Filter policy', type: 'enum', options: [
        {label: 'CONS', value: 'Conservative'},
        {label: 'ADJ', value: 'Adjust'},
        {label: 'PASS', value: 'PassThrough'},
      ], default: 'Conservative'},
      {key: 'kalmanProfile', label: 'Kalman profile', type: 'enum', options: [
        {label: 'DEF', value: 'DEFAULT'},
        {label: 'AGGR', value: 'AGGRESSIVE'},
        {label: 'CONS', value: 'CONSERVATIVE'},
      ], default: 'DEFAULT'},
      {key: 'odometerAccuracyThreshold', label: 'Odometer accuracy gate', type: 'number', unit: 'm', default: 0, hint: '0 = off'},
    ],
  },
  {
    title: 'Motion / Activity',
    fields: [
      {key: 'stopTimeout', label: 'Stop timeout', type: 'number', unit: 'min', default: 5},
      {key: 'motionTriggerDelay', label: 'Motion trigger delay', type: 'number', unit: 'ms', default: 0},
      // DIVERGENT BY DESIGN — iOS engine default is 50 (core/ios/Sources/BGGeoEngine.mm:1576,
      // deliberate: iOS's confidence scale is coarse Low/Med/High=33/66/100, and 50 preserves
      // "anything above Low counts as moving"); Android engine default is 75
      // (core/android/.../BGGeoEngine.kt:870). Resolved per platform via `resolveDefault` so
      // each platform's Settings screen displays and resets to its OWN engine's real default.
      {key: 'minimumActivityRecognitionConfidence', label: 'Min AR confidence', type: 'number', unit: '%', default: {ios: 50, android: 75}},
      {key: 'disableMotionActivityUpdates', label: 'Disable motion updates', type: 'bool', default: false},
      {key: 'preventSuspend', label: 'Prevent suspend', type: 'bool', default: false, platform: 'ios'},
    ],
  },
  {
    title: 'Power',
    fields: [
      {key: 'disableElasticity', label: 'Disable elasticity', type: 'bool', default: false},
      {key: 'elasticityMultiplier', label: 'Elasticity multiplier', type: 'number', default: 1},
    ],
  },
  {
    title: 'HTTP / Sync',
    fields: [
      {key: 'autoSync', label: 'Auto sync', type: 'bool', default: true},
      {key: 'autoSyncThreshold', label: 'Auto-sync threshold', type: 'number', default: 0},
      {key: 'disableAutoSyncOnCellular', label: 'Wi-Fi-only auto sync', type: 'bool', default: false, hint: 'explicit Sync still uploads on cellular'},
      {key: 'batchSync', label: 'Batch sync', type: 'bool', default: false},
      // CORRECTED — engine default -1/unbatched on both platforms (core/ios/Sources/
      // BGGeoHttpStore.mm:74,183, core/android/.../BGGeoHttpStore.kt:60,198), not 50;
      // DeviceLink sets 50 once linked, independently of this default.
      {key: 'maxBatchSize', label: 'Max batch size', type: 'number', default: -1},
      // CORRECTED — engine default 30000 on both platforms (core/ios/Sources/
      // BGGeoHttpStore.mm:185, core/android/.../BGGeoHttpStore.kt:199), not 60000.
      {key: 'httpTimeoutMs', label: 'HTTP timeout', type: 'number', unit: 'ms', default: 30000},
    ],
  },
  {
    title: 'Persistence',
    fields: [
      {key: 'maxRecordsToPersist', label: 'Max records', type: 'number', default: -1, hint: '-1 = unlimited'},
      {key: 'maxDaysToPersist', label: 'Max days', type: 'number', unit: 'd', default: 0},
    ],
  },
  {
    title: 'Geofencing',
    fields: [
      {key: 'geofenceProximityRadius', label: 'Proximity radius', type: 'number', unit: 'm', default: 1000},
      {key: 'maxMonitoredGeofences', label: 'Max monitored', type: 'number', default: -1, hint: '-1 = platform budget'},
      {key: 'geofenceInitialTriggerEntry', label: 'Initial ENTER trigger', type: 'bool', default: true},
    ],
  },
  {
    title: 'Application',
    fields: [
      {key: 'heartbeatInterval', label: 'Heartbeat interval', type: 'number', unit: 's', default: 60},
      {key: 'stopOnTerminate', label: 'Stop on terminate', type: 'bool', default: true},
      {key: 'startOnBoot', label: 'Start on boot', type: 'bool', default: false},
      {key: 'debug', label: 'Debug sounds', type: 'bool', default: true},
    ],
  },
  {
    title: 'Diagnostics / Engine',
    fields: [
      {
        key: 'logLevel',
        label: 'Log level',
        type: 'enum',
        options: [
          {label: 'OFF', value: 0},
          {label: 'ERR', value: 1},
          {label: 'WARN', value: 2},
          {label: 'INFO', value: 3},
          {label: 'DBG', value: 4},
          {label: 'VERB', value: 5},
        ],
        default: 3,
        hint: 'native log persistence (mirror to logcat/os_log is always on)',
      },
      // iOS-only: gates the per-point diagnostic snapshot
      // (core/ios/Sources/BGGeoEngine.mm:848). Zero occurrences under
      // core/android/engine — a no-op on Android today (not doc-tagged
      // `@platform ios` on either SDK's Config, since Android support is on
      // the backlog; re-evaluate this tag if/when that ships).
      {key: 'diagnosticExtras', label: 'Diagnostic extras', type: 'bool', default: false, platform: 'ios'},
      {key: 'useSessionEngine', label: 'Session engine', type: 'bool', default: true, platform: 'ios', hint: 'OFF = legacy CLLocationManager (SLC-burst degraded in background)'},
    ],
  },
  {
    title: 'Notification',
    fields: [
      {key: 'notification.title', label: 'Title', type: 'string', default: 'Location', platform: 'android'},
      {key: 'notification.text', label: 'Text', type: 'string', default: 'Location tracking active', platform: 'android'},
      {key: 'notification.channelId', label: 'Channel ID', type: 'string', default: 'bgeo_location_min', platform: 'android', hint: 'importance is frozen per channel — change the ID to change priority'},
      {key: 'notification.channelName', label: 'Channel name', type: 'string', default: 'Location', platform: 'android'},
      {key: 'notification.smallIcon', label: 'Small icon', type: 'string', default: '', platform: 'android', hint: 'drawable/name or mipmap/name; empty = app icon'},
      {key: 'notification.color', label: 'Accent color', type: 'string', default: '', platform: 'android', hint: '#RRGGBB; empty = none'},
      {
        key: 'notification.priority',
        label: 'Priority',
        type: 'enum',
        options: [
          {label: 'MIN', value: -2},
          {label: 'LOW', value: -1},
          {label: 'DEF', value: 0},
          {label: 'HIGH', value: 1},
          {label: 'MAX', value: 2},
        ],
        default: -2,
        platform: 'android',
      },
    ],
  },
];

/** The schema field for `key`, searching every section. */
export function fieldFor(key: string): ConfigField | undefined {
  for (const section of CONFIG_SECTIONS) {
    const field = section.fields.find(f => f.key === key);
    if (field) return field;
  }
  return undefined;
}

/** Every schema field (flattened across sections) that applies to `os` —
 * what the Settings screen renders and what `resetOverrides` is allowed to
 * touch. */
export function fieldsForPlatform(
  os: 'ios' | 'android' = Platform.OS as 'ios' | 'android',
): ConfigField[] {
  return CONFIG_SECTIONS.flatMap(section => section.fields).filter(field =>
    appliesToPlatform(field, os),
  );
}

/** default value per key (BASE_CONFIG wins over the schema's, possibly
 * per-platform, default). */
export function defaultFor(key: string): unknown {
  if (key in BASE_CONFIG) {
    return (BASE_CONFIG as Record<string, unknown>)[key];
  }
  const field = fieldFor(key);
  return field ? resolveDefault(field.default) : undefined;
}
