/** Modal form for geofence CRUD. New fence: long-press on the map. Edit /
 * delete: tap a fence pin. Every change goes to the SDK, then the snapshot is
 * mirrored to the console via syncGeofences(). */

import React, {useState} from 'react';
import {TouchableOpacity, ScrollView, Switch, Text, TextInput, View} from 'react-native';
import BackgroundGeolocation from '@bgeo/react-native-background-geolocation';

import {appStore} from '../appStore';
import {syncGeofences} from '../geofences';
import {logEvent} from '../logUploader';
import type {GeofenceFormProps} from '../navigation';
import {MONO, themedStyles, useTheme, type ThemeColors} from '../theme';

export function GeofenceFormScreen({route, navigation}: GeofenceFormProps) {
  const {scheme, colors} = useTheme();
  const styles = STYLES[scheme];
  const {latitude, longitude, identifier: editId} = route.params;
  const existing = editId
    ? appStore.getState().geofences.find(g => g.identifier === editId)
    : undefined;

  const [identifier, setIdentifier] = useState(existing?.identifier ?? '');
  const [radius, setRadius] = useState(String(existing?.radius ?? 200));
  const [notifyOnEntry, setNotifyOnEntry] = useState(existing?.notifyOnEntry ?? true);
  const [notifyOnExit, setNotifyOnExit] = useState(existing?.notifyOnExit ?? true);
  const [notifyOnDwell, setNotifyOnDwell] = useState(existing?.notifyOnDwell ?? false);
  const [loiteringDelay, setLoiteringDelay] = useState(
    existing?.loiteringDelay != null ? String(existing.loiteringDelay) : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    const r = parseFloat(radius);
    if (!identifier.trim() || !Number.isFinite(r) || r <= 0) {
      setError('identifier and a positive radius are required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await BackgroundGeolocation.addGeofence({
        identifier: identifier.trim(),
        latitude: existing?.latitude ?? latitude,
        longitude: existing?.longitude ?? longitude,
        radius: r,
        notifyOnEntry,
        notifyOnExit,
        notifyOnDwell,
        ...(loiteringDelay.trim() ? {loiteringDelay: parseInt(loiteringDelay, 10)} : {}),
      });
      logEvent('addGeofence', `${identifier.trim()} r=${r}m`, undefined, 'info');
      await syncGeofences();
      navigation.goBack();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!existing) return;
    setBusy(true);
    try {
      await BackgroundGeolocation.removeGeofence(existing.identifier);
      logEvent('removeGeofence', existing.identifier, undefined, 'info');
      await syncGeofences();
      navigation.goBack();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{existing ? 'Edit geofence' : 'New geofence'}</Text>
      <Text style={styles.coords}>
        {(existing?.latitude ?? latitude).toFixed(6)}, {(existing?.longitude ?? longitude).toFixed(6)}
      </Text>

      <Text style={styles.label}>Identifier</Text>
      <TextInput
        style={[styles.input, !!existing && styles.inputDisabled]}
        value={identifier}
        onChangeText={setIdentifier}
        editable={!existing}
        placeholder="home"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>Radius (m)</Text>
      <TextInput
        style={styles.input}
        value={radius}
        onChangeText={setRadius}
        keyboardType="numeric"
      />

      <SwitchRow label="Notify on ENTER" value={notifyOnEntry} onChange={setNotifyOnEntry} />
      <SwitchRow label="Notify on EXIT" value={notifyOnExit} onChange={setNotifyOnExit} />
      <SwitchRow label="Notify on DWELL" value={notifyOnDwell} onChange={setNotifyOnDwell} />

      {notifyOnDwell && (
        <>
          <Text style={styles.label}>Loitering delay (ms)</Text>
          <TextInput
            style={styles.input}
            value={loiteringDelay}
            onChangeText={setLoiteringDelay}
            keyboardType="numeric"
            placeholder="30000"
            placeholderTextColor={colors.placeholder}
          />
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, styles.buttonSave, busy && styles.disabled]}
        disabled={busy}
        onPress={onSave}>
        <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Save'}</Text>
      </TouchableOpacity>
      {existing && (
        <TouchableOpacity
          style={[styles.button, styles.buttonDelete, busy && styles.disabled]}
          disabled={busy}
          onPress={onDelete}>
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const styles = STYLES[useTheme().scheme];
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const STYLES = themedStyles((c: ThemeColors) => ({
  root: {flex: 1, backgroundColor: c.background},
  content: {padding: 16},
  title: {color: c.text, fontSize: 18, fontWeight: '700'},
  coords: {color: c.textDim, fontSize: 12, fontFamily: MONO, marginTop: 4, marginBottom: 12},
  label: {color: c.textDim, fontSize: 12, marginBottom: 4, marginTop: 12},
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
  inputDisabled: {opacity: 0.5},
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  switchLabel: {color: c.text2, fontSize: 14},
  button: {borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16},
  buttonSave: {backgroundColor: c.accent},
  buttonDelete: {backgroundColor: c.danger},
  buttonText: {color: c.onAccent, fontWeight: '600'},
  disabled: {opacity: 0.5},
  error: {color: c.dangerText, marginTop: 12, fontSize: 13},
}));
