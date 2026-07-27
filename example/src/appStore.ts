/** Tiny shared store for the example app (no Redux needed here):
 * structured log lines (same shape as /device/logs events), breadcrumb points,
 * the SDK geofence set, engine status and the device-link state. State is
 * replaced immutably so useSyncExternalStore snapshots change by reference. */

import type {Geofence} from '@bgeo/react-native-background-geolocation';

export type LogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error';

/** Exactly the event shape uploaded to /device/logs — what you see in the app
 * is what the web console shows. */
export type LogLine = {
  ts: string; // ISO
  level: LogLevel;
  event: string;
  message?: string;
  data?: unknown;
};

export type Point = {
  uuid?: string;
  latitude: number;
  longitude: number;
  timestamp: string; // ISO
  accuracy?: number;
  speed?: number;
  heading?: number;
  odometer?: number; // metres
  activity?: string;
  isMoving?: boolean;
  event?: string | null;
  /** Present on event:"geofence" points — which region fired and how. */
  geofence?: {identifier: string; action?: string} | null;
};

export type LinkState = {
  serverUrl: string;
  linked: boolean;
  deviceId: string | null;
};

export type EngineStatus = {
  ready: boolean;
  enabled: boolean;
  isMoving: boolean;
  batteryLevel: number | null;
};

export type AppState = {
  logs: LogLine[];
  points: Point[];
  geofences: Geofence[];
  link: LinkState;
  status: EngineStatus;
};

type Listener = () => void;

let state: AppState = {
  logs: [],
  points: [],
  geofences: [],
  link: {serverUrl: 'https://app.bgeo.dev', linked: false, deviceId: null},
  status: {ready: false, enabled: false, isMoving: false, batteryLevel: null},
};

const listeners = new Set<Listener>();

function setState(patch: Partial<AppState>) {
  state = {...state, ...patch};
  listeners.forEach(l => l());
}

export const appStore = {
  getState: () => state,
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  appendLog(line: LogLine) {
    setState({logs: [...state.logs.slice(-999), line]});
  },
  clearLogs() {
    setState({logs: []});
  },
  appendPoint(point: Point) {
    setState({points: [...state.points.slice(-1999), point]});
  },
  clearTrack() {
    setState({points: []});
  },
  setGeofences(geofences: Geofence[]) {
    setState({geofences});
  },
  setLink(link: Partial<LinkState>) {
    setState({link: {...state.link, ...link}});
  },
  setStatus(status: Partial<EngineStatus>) {
    setState({status: {...state.status, ...status}});
  },
};
