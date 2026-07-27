/** Persisted user overrides for the SDK config (Settings screen). Overrides
 * are applied immediately via setConfig and merged over BASE_CONFIG at boot. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundGeolocation from '@dc-bgeo/react-native-background-geolocation';

import {CONFIG_SECTIONS, defaultFor} from './configSchema';

const KEY = 'bgeo:configOverrides';

export async function loadOverrides(): Promise<Record<string, unknown>> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : {};
}

/** All schema keys starting with a dot-prefix (e.g. "notification."). */
function keysWithPrefix(prefix: string): string[] {
  const keys: string[] = [];
  for (const section of CONFIG_SECTIONS) {
    for (const field of section.fields) {
      if (field.key.startsWith(prefix)) keys.push(field.key);
    }
  }
  return keys;
}

/** Full nested object for a dot-prefix: schema fields filled from `values`
 * where overridden, else their defaults. */
function nestedPatchFor(prefix: string, values: Record<string, unknown>): Record<string, unknown> {
  const nested: Record<string, unknown> = {};
  for (const fullKey of keysWithPrefix(prefix + '.')) {
    nested[fullKey.slice(prefix.length + 1)] =
      fullKey in values ? values[fullKey] : defaultFor(fullKey);
  }
  return nested;
}

/** For "a.b" keys the engine replaces the whole nested object on setConfig,
 * so rebuild it from EVERY schema field of the prefix (override if present,
 * else its default) — never just the overridden subset. */
function toConfigPatch(key: string, values: Record<string, unknown>): Record<string, unknown> {
  const dot = key.indexOf('.');
  if (dot < 0) return {[key]: values[key]};
  const prefix = key.slice(0, dot);
  return {[prefix]: nestedPatchFor(prefix, values)};
}

/** Apply one config key right away and remember it across restarts. */
export async function applyOverride(key: string, value: unknown): Promise<void> {
  const overrides = await loadOverrides();
  overrides[key] = value;
  await BackgroundGeolocation.setConfig(toConfigPatch(key, overrides));
  await AsyncStorage.setItem(KEY, JSON.stringify(overrides));
}

/** Drop all overrides and re-apply the defaults for every overridden key. */
export async function resetOverrides(): Promise<void> {
  const overrides = await loadOverrides();
  const keys = Object.keys(overrides);
  if (keys.length > 0) {
    const defaults: Record<string, unknown> = {};
    for (const key of keys) {
      const dot = key.indexOf('.');
      if (dot < 0) {
        defaults[key] = defaultFor(key);
      } else if (!(key.slice(0, dot) in defaults)) {
        const prefix = key.slice(0, dot);
        defaults[prefix] = nestedPatchFor(prefix, {});
      }
    }
    await BackgroundGeolocation.setConfig(defaults);
  }
  await AsyncStorage.removeItem(KEY);
}

/** Boot-time shape: dot-path overrides -> nested Config patch for ready().
 * Nested prefixes are schema-complete (same rule as toConfigPatch). */
export function expandOverrides(overrides: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(overrides)) {
    const dot = key.indexOf('.');
    if (dot < 0) {
      out[key] = overrides[key];
    } else {
      const prefix = key.slice(0, dot);
      if (!(prefix in out)) out[prefix] = nestedPatchFor(prefix, overrides);
    }
  }
  return out;
}
