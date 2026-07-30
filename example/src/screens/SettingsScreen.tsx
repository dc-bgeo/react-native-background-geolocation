/** Settings — device link (registration code), every working SDK config key
 * (applied immediately via setConfig, persisted as overrides), engine state
 * and upload-queue tools. */

import React, {useCallback, useEffect, useState} from 'react';
import {
  TouchableOpacity,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import BackgroundGeolocation from '@dc-bgeo/react-native-background-geolocation';

import {appStore} from '../appStore';
import {appliesToPlatform, CONFIG_SECTIONS, resolveDefault, type ConfigField} from '../configSchema';
import {applyOverride, loadOverrides, resetOverrides} from '../configStore';
import {linkDevice, unlinkDevice} from '../deviceLink';
import {logEvent} from '../logUploader';
import {
  MONO,
  themeStore,
  themedStyles,
  useTheme,
  type ThemeColors,
  type ThemeMode,
} from '../theme';
import {useAppStore} from '../useAppStore';

const STATE_FIELDS = [
  'enabled',
  'trackingActive',
  'isMoving',
  'odometer',
  'geofenceCount',
  'authorization',
  'lastRawFixAge',
  'lastAcceptedFixAge',
  'watchdogRecoveryCount',
  'sessionEngineActive',
  'serviceSessionActive',
];

export function SettingsScreen() {
  const {link} = useAppStore();
  const styles = STYLES[useTheme().scheme];
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});

  useEffect(() => {
    loadOverrides().then(setOverrides);
  }, []);

  const setValue = useCallback(async (key: string, value: unknown) => {
    setOverrides(prev => ({...prev, [key]: value}));
    await applyOverride(key, value);
    logEvent('setConfig', `${key}=${JSON.stringify(value)}`, undefined, 'info');
  }, []);

  const onReset = useCallback(async () => {
    await resetOverrides();
    setOverrides({});
    logEvent('setConfig', 'reset to defaults', undefined, 'info');
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <LinkSection linked={link.linked} deviceId={link.deviceId} serverUrl={link.serverUrl} />
        <AppearanceSection />
        {CONFIG_SECTIONS.map(section => {
          const fields = section.fields.filter(f => appliesToPlatform(f));
          if (fields.length === 0) return null;
          return (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {fields.map(field => (
                <FieldRow
                  key={field.key}
                  field={field}
                  value={overrides[field.key] ?? resolveDefault(field.default)}
                  overridden={field.key in overrides}
                  onChange={v => setValue(field.key, v)}
                />
              ))}
            </View>
          );
        })}
        <TouchableOpacity style={[styles.button, styles.buttonReset]} onPress={onReset}>
          <Text style={styles.buttonResetText}>Reset config to defaults</Text>
        </TouchableOpacity>
        <StateSection />
      </ScrollView>
    </SafeAreaView>
  );
}

// --- appearance ------------------------------------------------------------

const THEME_MODES: {value: ThemeMode; label: string}[] = [
  {value: 'system', label: 'System'},
  {value: 'light', label: 'Light'},
  {value: 'dark', label: 'Dark'},
];

function AppearanceSection() {
  const {mode, scheme} = useTheme();
  const styles = STYLES[scheme];
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Appearance</Text>
      <View style={styles.fieldRow}>
        <View style={styles.fieldLabelBox}>
          <Text style={styles.fieldLabel}>Theme</Text>
          <Text style={styles.fieldHint}>
            same palette as the web console · now: {scheme}
          </Text>
        </View>
        <View style={styles.enumRow}>
          {THEME_MODES.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.enumOption, mode === opt.value && styles.enumOptionActive]}
              onPress={() => {
                themeStore.setMode(opt.value).catch(() => null);
              }}>
              <Text style={[styles.enumText, mode === opt.value && styles.enumTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// --- device link -----------------------------------------------------------

function LinkSection({
  linked,
  deviceId,
  serverUrl: initialUrl,
}: {
  linked: boolean;
  deviceId: string | null;
  serverUrl: string;
}) {
  const {scheme, colors} = useTheme();
  const styles = STYLES[scheme];
  const [serverUrl, setServerUrl] = useState(initialUrl);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLink = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await linkDevice(serverUrl.replace(/\/+$/, ''), code);
      logEvent('link', `linked to console as ${result.deviceId}`, undefined, 'info');
      setCode('');
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onUnlink = async () => {
    setBusy(true);
    try {
      await unlinkDevice();
      logEvent('link', 'unlinked from console', undefined, 'info');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Debug console</Text>
      <Text style={styles.help}>
        Create a registration code in the BGeo web console (Dashboard → Registration codes)
        and enter it here. Locations and SDK events then stream live to your console.
      </Text>
      <Text style={styles.label}>Server</Text>
      <TextInput
        style={styles.input}
        value={serverUrl}
        onChangeText={setServerUrl}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!linked}
      />
      {!linked ? (
        <>
          <Text style={styles.label}>Registration code</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="XXXX-XXXX"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.button, styles.buttonLink, busy && styles.disabled]}
            disabled={busy || code.replace(/-/g, '').length < 8}
            onPress={onLink}>
            <Text style={styles.buttonText}>{busy ? 'Linking…' : 'Link device'}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.linked}>🟢 Linked — device {deviceId?.slice(0, 8)}</Text>
          <TouchableOpacity
            style={[styles.button, styles.buttonUnlink, busy && styles.disabled]}
            disabled={busy}
            onPress={onUnlink}>
            <Text style={styles.buttonText}>Unlink</Text>
          </TouchableOpacity>
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

// --- config field controls -------------------------------------------------

function FieldRow({
  field,
  value,
  overridden,
  onChange,
}: {
  field: ConfigField;
  value: unknown;
  overridden: boolean;
  onChange: (v: unknown) => void;
}) {
  const styles = STYLES[useTheme().scheme];
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldLabelBox}>
        <Text style={[styles.fieldLabel, overridden && styles.fieldOverridden]}>
          {field.label}
          {field.unit ? ` (${field.unit})` : ''}
        </Text>
        {field.hint && <Text style={styles.fieldHint}>{field.hint}</Text>}
      </View>
      {field.type === 'bool' && (
        <Switch value={Boolean(value)} onValueChange={onChange} />
      )}
      {field.type === 'number' && (
        <NumberInput value={value as number} onCommit={onChange} />
      )}
      {field.type === 'string' && (
        <StringInput value={String(value ?? '')} onCommit={onChange} />
      )}
      {field.type === 'enum' && (
        <View style={styles.enumRow}>
          {field.options!.map(opt => (
            <TouchableOpacity
              key={String(opt.value)}
              style={[styles.enumOption, value === opt.value && styles.enumOptionActive]}
              onPress={() => onChange(opt.value)}>
              <Text
                style={[styles.enumText, value === opt.value && styles.enumTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function NumberInput({value, onCommit}: {value: number; onCommit: (v: number) => void}) {
  const styles = STYLES[useTheme().scheme];
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n) && n !== value) onCommit(n);
    else setDraft(String(value));
  };
  return (
    <TextInput
      style={styles.numberInput}
      value={draft}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      keyboardType="numbers-and-punctuation"
      returnKeyType="done"
    />
  );
}

function StringInput({value, onCommit}: {value: string; onCommit: (v: string) => void}) {
  const styles = STYLES[useTheme().scheme];
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <TextInput
      style={styles.numberInput}
      value={draft}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="done"
    />
  );
}

// --- engine state + queue --------------------------------------------------

function StateSection() {
  const styles = STYLES[useTheme().scheme];
  const [engineState, setEngineState] = useState<Record<string, unknown> | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [logCount, setLogCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [s, c, logs] = await Promise.all([
      BackgroundGeolocation.getState(),
      BackgroundGeolocation.getCount(),
      BackgroundGeolocation.getLog(5000),
    ]);
    setEngineState(s as Record<string, unknown>);
    setCount(c);
    setLogCount(logs.length);
  }, []);

  useEffect(() => {
    refresh().catch(() => null);
  }, [refresh]);

  const onSync = async () => {
    setBusy(true);
    try {
      const records = await BackgroundGeolocation.sync();
      logEvent('sync', `${records.length} records`, undefined, 'info');
    } catch (e: any) {
      logEvent('sync', e?.message ?? String(e), undefined, 'error');
    } finally {
      setBusy(false);
      refresh().catch(() => null);
    }
  };

  const onDestroy = async () => {
    setBusy(true);
    try {
      const n = await BackgroundGeolocation.destroyLocations();
      logEvent('destroyLocations', `${n} records`, undefined, 'info');
    } finally {
      setBusy(false);
      refresh().catch(() => null);
    }
  };

  const onResetOdometer = async () => {
    setBusy(true);
    try {
      await BackgroundGeolocation.resetOdometer();
      logEvent('resetOdometer', 'odometer=0', undefined, 'info');
    } catch (e: any) {
      logEvent('resetOdometer', e?.message ?? String(e), undefined, 'error');
    } finally {
      setBusy(false);
      refresh().catch(() => null);
    }
  };

  const onUploadLogs = async () => {
    setBusy(true);
    try {
      const n = await BackgroundGeolocation.uploadLog();
      logEvent('uploadLog', `${n} rows handed to the flusher`, undefined, 'info');
    } catch (e: any) {
      logEvent('uploadLog', e?.message ?? String(e), undefined, 'error');
    } finally {
      setBusy(false);
      refresh().catch(() => null);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.stateHeader}>
        <Text style={styles.sectionTitle}>Engine state</Text>
        <TouchableOpacity style={styles.chipButton} onPress={refresh}>
          <Text style={styles.chipButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      {engineState &&
        STATE_FIELDS.filter(k => engineState[k] !== undefined).map(k => (
          <View key={k} style={styles.stateRow}>
            <Text style={styles.stateKey}>{k}</Text>
            <Text style={styles.stateValue}>{JSON.stringify(engineState[k])}</Text>
          </View>
        ))}
      <View style={styles.stateRow}>
        <Text style={styles.stateKey}>upload queue</Text>
        <Text style={styles.stateValue}>{count ?? '—'} records</Text>
      </View>
      <View style={styles.stateRow}>
        <Text style={styles.stateKey}>log history</Text>
        <Text style={styles.stateValue}>
          {logCount === null ? '—' : logCount === 5000 ? '5000+' : logCount} rows
        </Text>
      </View>
      <View style={styles.queueButtons}>
        <TouchableOpacity
          style={[styles.button, styles.queueButton, styles.buttonLink, busy && styles.disabled]}
          disabled={busy}
          onPress={onSync}>
          <Text style={styles.buttonText}>Sync now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.queueButton, styles.buttonUnlink, busy && styles.disabled]}
          disabled={busy}
          onPress={onDestroy}>
          <Text style={styles.buttonText}>Destroy queue</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.button, styles.buttonLink, busy && styles.disabled]}
        disabled={busy}
        onPress={onUploadLogs}>
        <Text style={styles.buttonText}>Upload logs</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.buttonLink, busy && styles.disabled]}
        disabled={busy}
        onPress={onResetOdometer}>
        <Text style={styles.buttonText}>Reset odometer</Text>
      </TouchableOpacity>
      <Text style={styles.help}>
        Track buffer: {appStore.getState().points.length} pts ·{' '}
        <Text style={styles.link} onPress={() => appStore.clearTrack()}>
          clear track
        </Text>
      </Text>
    </View>
  );
}

const STYLES = themedStyles((c: ThemeColors) => ({
  root: {flex: 1, backgroundColor: c.background},
  content: {padding: 16, paddingBottom: 40},
  section: {marginBottom: 24},
  sectionTitle: {color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 8},
  help: {color: c.textDim, fontSize: 13, lineHeight: 18, marginTop: 20, marginBottom: 8},
  label: {color: c.textDim, fontSize: 12, marginBottom: 4, marginTop: 8},
  input: {
    backgroundColor: c.field,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text2,
    padding: 12,
    fontFamily: MONO,
    fontSize: 14,
  },
  button: {borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16},
  buttonLink: {backgroundColor: c.accent},
  buttonUnlink: {backgroundColor: c.danger},
  buttonReset: {backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.border, marginBottom: 24},
  buttonResetText: {color: c.text, fontWeight: '600'},
  buttonText: {color: c.onAccent, fontWeight: '600'},
  disabled: {opacity: 0.5},
  linked: {color: c.successText, marginTop: 12, fontSize: 14},
  error: {color: c.dangerText, marginTop: 12, fontSize: 13},
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    gap: 8,
  },
  fieldLabelBox: {flexShrink: 1},
  fieldLabel: {color: c.text2, fontSize: 13},
  fieldOverridden: {color: c.accentText},
  fieldHint: {color: c.placeholder, fontSize: 11},
  numberInput: {
    backgroundColor: c.field,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: MONO,
    fontSize: 13,
    minWidth: 80,
    textAlign: 'right',
  },
  enumRow: {flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end'},
  enumOption: {borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: c.surfaceRaised},
  enumOptionActive: {backgroundColor: c.accent},
  enumText: {color: c.textDim, fontSize: 11, fontWeight: '600'},
  enumTextActive: {color: c.onAccent},
  stateHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  chipButton: {borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: c.surfaceRaised},
  chipButtonText: {color: c.accentText, fontSize: 12, fontWeight: '600'},
  stateRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3},
  stateKey: {color: c.textDim, fontSize: 12, fontFamily: MONO},
  stateValue: {color: c.text2, fontSize: 12, fontFamily: MONO},
  queueButtons: {flexDirection: 'row', gap: 12},
  queueButton: {flex: 1, paddingHorizontal: 4},
  link: {color: c.dangerText},
}));
