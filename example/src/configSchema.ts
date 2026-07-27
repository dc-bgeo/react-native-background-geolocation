/** Declarative schema of the SDK's working Config keys — single source for the
 * Settings screen UI and for reset-to-defaults. Documented no-op keys
 * (foregroundService, backgroundPermissionRationale) are excluded.
 * `default` is the effective engine/app default shown when no override is set. */

import type {Config} from '@bgeo/react-native-background-geolocation';

export type ConfigField = {
  key: string;
  label: string;
  type: 'bool' | 'number' | 'enum' | 'string';
  /** enum choices */
  options?: {label: string; value: number | string}[];
  default: boolean | number | string | null;
  unit?: string;
  platform?: 'ios' | 'android';
  hint?: string;
};

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

export const CONFIG_SECTIONS: ConfigSection[] = [
  {
    title: 'Geolocation',
    fields: [
      {key: 'desiredAccuracy', label: 'Desired accuracy', type: 'enum', options: ACCURACY_OPTIONS, default: -1},
      {key: 'distanceFilter', label: 'Distance filter', type: 'number', unit: 'm', default: 10},
      {key: 'stationaryRadius', label: 'Stationary radius', type: 'number', unit: 'm', default: 25},
      {key: 'stationaryDistanceFilter', label: 'Stationary distance filter', type: 'number', unit: 'm', default: 75},
      {key: 'stationaryDesiredAccuracy', label: 'Stationary accuracy', type: 'enum', options: ACCURACY_OPTIONS, default: 10},
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
      {key: 'minimumActivityRecognitionConfidence', label: 'Min AR confidence', type: 'number', unit: '%', default: 75},
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
      {key: 'maxBatchSize', label: 'Max batch size', type: 'number', default: 50},
      {key: 'httpTimeoutMs', label: 'HTTP timeout', type: 'number', unit: 'ms', default: 60000},
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
      {key: 'diagnosticExtras', label: 'Diagnostic extras', type: 'bool', default: false},
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

/** default value per key (BASE_CONFIG wins over schema defaults). */
export function defaultFor(key: string): unknown {
  if (key in BASE_CONFIG) {
    return (BASE_CONFIG as Record<string, unknown>)[key];
  }
  for (const section of CONFIG_SECTIONS) {
    const field = section.fields.find(f => f.key === key);
    if (field) return field.default;
  }
  return undefined;
}
