/** Link this install to a BGeo account using a registration code from the
 * web console, then point the SDK's native uploader at the demo server with
 * JWT auth (native refresh via refreshUrl survives killed-app uploads). */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import BackgroundGeolocation from '@dc-bgeo/react-native-background-geolocation';

import {appStore} from './appStore';

const KEY = 'bgeo:link';

type StoredLink = {
  serverUrl: string;
  deviceId: string;
  accessToken: string;
  refreshToken: string;
  installUuid: string;
};

async function installUuid(): Promise<string> {
  const existing = await AsyncStorage.getItem('bgeo:installUuid');
  if (existing) return existing;
  const fresh = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem('bgeo:installUuid', fresh);
  return fresh;
}

async function applySdkConfig(link: StoredLink): Promise<void> {
  await BackgroundGeolocation.setConfig({
    url: `${link.serverUrl}/device/locations`,
    autoSync: true,
    batchSync: true,
    maxBatchSize: 50,
    // Native logger upload endpoint; the level itself lives in BASE_CONFIG /
    // Settings overrides (so the Settings toggle survives re-linking).
    logUrl: `${link.serverUrl}/device/logs`,
    authorization: {
      strategy: 'JWT',
      accessToken: link.accessToken,
      refreshToken: link.refreshToken,
      refreshUrl: `${link.serverUrl}/device/auth/refresh`,
      refreshPayload: {refresh_token: '{refreshToken}'},
    },
  });
}

/** Restore a persisted link on app start (returns null when not linked). */
export async function restoreLink(): Promise<StoredLink | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  const link: StoredLink = JSON.parse(raw);
  await applySdkConfig(link);
  appStore.setLink({serverUrl: link.serverUrl, linked: true, deviceId: link.deviceId});
  return link;
}

/** Exchange a registration code for device tokens and configure the SDK. */
export async function linkDevice(serverUrl: string, code: string): Promise<StoredLink> {
  const uuid = await installUuid();
  const res = await fetch(`${serverUrl}/device/register`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      code: code.trim(),
      device: {
        uuid,
        model: Platform.select({ios: 'iPhone', android: 'Android'}),
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        appVersion: '0.0.1',
        name: `BGeoExample (${Platform.OS})`,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? body.error ?? `register failed (${res.status})`);
  }
  const tokens = await res.json();
  const link: StoredLink = {
    serverUrl,
    deviceId: tokens.device_id,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    installUuid: uuid,
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(link));
  await applySdkConfig(link);
  appStore.setLink({serverUrl, linked: true, deviceId: link.deviceId});
  return link;
}

/** Persist rotated tokens surfaced by the native uploader (onAuthorization). */
export async function persistRotatedTokens(event: any): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return;
  const link: StoredLink = JSON.parse(raw);
  if (event?.accessToken) link.accessToken = event.accessToken;
  if (event?.refreshToken) link.refreshToken = event.refreshToken;
  await AsyncStorage.setItem(KEY, JSON.stringify(link));
}

export async function unlinkDevice(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
  // logUrl clears the same way as url (both tolerate the empty-string
  // convention at the engine — see BGGeoHttpStore's `.ifEmpty { null }`/
  // `.length == 0` handling on both platforms), otherwise the engine keeps
  // POSTing this device's logs to the server it just unlinked from, now with
  // the auth block stripped.
  await BackgroundGeolocation.setConfig({url: '', logUrl: '', authorization: undefined});
  appStore.setLink({linked: false, deviceId: null});
}

/** Current tokens for the JS-side log uploader. */
export async function currentLink(): Promise<StoredLink | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

/** Authorized fetch against the linked demo server with one 401-refresh retry.
 * Returns parsed JSON, or null when not linked / request failed. */
export async function deviceFetch(
  path: string,
  init?: {method?: string; body?: unknown},
): Promise<any | null> {
  const link = await currentLink();
  if (!link) return null;
  const send = (token: string) =>
    fetch(`${link.serverUrl}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: init?.body != null ? JSON.stringify(init.body) : undefined,
    });
  try {
    let res = await send(link.accessToken);
    if (res.status === 401) {
      const fresh = await refreshTokens();
      if (!fresh) return null;
      res = await send(fresh.accessToken);
    }
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Mirror the SDK's geofence set to the console (snapshot replace). */
export async function putGeofences(geofences: unknown[]): Promise<boolean> {
  const res = await deviceFetch('/device/geofences', {
    method: 'PUT',
    body: {geofences},
  });
  return res != null;
}

/** Refresh helper shared with the log uploader (JS-side twin of the native
 * refresh cycle). */
export async function refreshTokens(): Promise<StoredLink | null> {
  const link = await currentLink();
  if (!link) return null;
  const res = await fetch(`${link.serverUrl}/device/auth/refresh`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({refresh_token: link.refreshToken}),
  });
  if (!res.ok) return null;
  const tokens = await res.json();
  link.accessToken = tokens.access_token;
  link.refreshToken = tokens.refresh_token;
  await AsyncStorage.setItem(KEY, JSON.stringify(link));
  await applySdkConfig(link);
  return link;
}
