/** Light/dark palette for the example app chrome (panels, tab bar, sheet).
 *
 * The values are the web console's design tokens (`web/src/index.css`) converted
 * from oklch to hex — same palette on both clients. Two roles per status color:
 * `success`/`warning`/`danger` are FILLS (the web's `--success` … tokens, meant
 * to carry a contrasting foreground), `*Text` are the readable inks for type on
 * `background`/`surface`. In dark they coincide; in light the fill stays bright
 * and the ink is the same hue darkened to clear 4.5:1.
 *
 * Map-overlay colors (geofence actions, track polyline, breadcrumb dots) are NOT
 * theme-scoped — the web console keeps them fixed too and only flips the map's
 * own colorScheme.
 */

import {useSyncExternalStore} from 'react';
import {Platform, StyleSheet, useColorScheme} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Scheme = 'light' | 'dark';
/** What the user picked; `system` follows the OS (same contract as the web). */
export type ThemeMode = 'system' | Scheme;

export type ThemeColors = {
  /** Screen background. */
  background: string;
  /** Cards and raised chrome. */
  surface: string;
  /** Buttons, toggles, chips. */
  surfaceRaised: string;
  /** Text inputs and the log/terminal viewport. */
  field: string;
  border: string;
  separator: string;
  /** Floating panels over the map — translucent over `surface`. */
  panel: string;
  /** Bottom-sheet drag handle. */
  handle: string;

  text: string;
  /** Secondary type (labels, values). */
  text2: string;
  /** Dimmed type (metadata, table gutters). */
  textDim: string;
  placeholder: string;

  accent: string;
  /** Accent as type — darkened in light so it clears 4.5:1. */
  accentText: string;
  /** Tinted accent background (badges). */
  accentSoft: string;
  /** Type on an `accent`/`danger` fill. */
  onAccent: string;

  success: string;
  warning: string;
  danger: string;
  successText: string;
  warningText: string;
  dangerText: string;
  /** Row tint for geofence events. */
  warningSoft: string;

  tabBar: string;
  tabBarBorder: string;
};

const light: ThemeColors = {
  background: '#F5F5F6',
  surface: '#FFFFFF',
  surfaceRaised: '#EFEFF0',
  field: '#FFFFFF',
  border: '#DDDEDF',
  separator: '#E4E4E5',
  panel: 'rgba(255, 255, 255, 0.94)',
  handle: '#CFD0D2',

  text: '#181819',
  text2: '#525864',
  textDim: '#717273',
  placeholder: '#81868F',

  accent: '#3A6FF0',
  accentText: '#3265E5',
  accentSoft: 'rgba(58, 111, 240, 0.12)',
  onAccent: '#FFFFFF',

  success: '#00C967',
  warning: '#F4A620',
  danger: '#FF3836',
  successText: '#028845',
  warningText: '#A16B08',
  dangerText: '#E81420',
  warningSoft: 'rgba(244, 166, 32, 0.14)',

  tabBar: '#FFFFFF',
  tabBarBorder: '#DDDEDF',
};

const dark: ThemeColors = {
  background: '#06080D',
  surface: '#181819',
  surfaceRaised: '#232324',
  field: '#000000',
  border: '#292929',
  separator: '#212222',
  panel: 'rgba(24, 24, 25, 0.94)',
  handle: '#3F4045',

  text: '#FCFCFD',
  text2: '#9CA5B1',
  textDim: '#9FA0A1',
  placeholder: '#6D7580',

  accent: '#3A6FF0',
  accentText: '#6895F4',
  accentSoft: 'rgba(58, 111, 240, 0.28)',
  onAccent: '#FFFFFF',

  success: '#00C967',
  warning: '#F6B84F',
  danger: '#DB3B3A',
  successText: '#00C967',
  warningText: '#F6B84F',
  dangerText: '#DB3B3A',
  warningSoft: 'rgba(246, 184, 79, 0.10)',

  tabBar: '#0F0F14',
  tabBarBorder: '#292929',
};

export const PALETTE: Record<Scheme, ThemeColors> = {light, dark};

export const MONO = Platform.select({ios: 'Menlo', default: 'monospace'});

// --- theme mode store ------------------------------------------------------

const KEY = 'bgeo:themeMode';

let mode: ThemeMode = 'system';
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(l => l());
}

export const themeStore = {
  getMode: () => mode,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  async setMode(next: ThemeMode): Promise<void> {
    mode = next;
    notify();
    await AsyncStorage.setItem(KEY, next);
  },
  /** Restore the persisted choice at boot. */
  async hydrate(): Promise<void> {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === 'system' || raw === 'light' || raw === 'dark') {
      mode = raw;
      notify();
    }
  },
};

/** Current mode, the scheme it resolves to, and that scheme's colors.
 * An unknown OS scheme resolves to light — same fallback as the web. */
export function useTheme(): {mode: ThemeMode; scheme: Scheme; colors: ThemeColors} {
  const current = useSyncExternalStore(themeStore.subscribe, themeStore.getMode);
  const system = useColorScheme();
  const scheme: Scheme = current === 'system' ? (system === 'dark' ? 'dark' : 'light') : current;
  return {mode: current, scheme, colors: PALETTE[scheme]};
}

/** Build both stylesheets once at module load; pick one with the live scheme:
 * `const styles = STYLES[scheme]`. Keeps StyleSheet.create off the render path. */
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(
  build: (c: ThemeColors) => T,
): Record<Scheme, T> {
  return {
    light: StyleSheet.create(build(light)),
    dark: StyleSheet.create(build(dark)),
  };
}
