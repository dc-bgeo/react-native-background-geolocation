/** Compact from/to picker field for the Map screen range bar. Android uses the
 * imperative two-step date -> time dialogs (no combined mode); iOS shows the
 * native compact datetime picker inline once a value exists. */

import React from 'react';
import {Platform, Pressable, Text, View} from 'react-native';
import DateTimePicker, {DateTimePickerAndroid} from '@react-native-community/datetimepicker';

import {MONO, themedStyles, useTheme, type ThemeColors} from '../theme';

export function DateTimeField({
  label,
  value,
  onChange,
  placeholder = 'set…',
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
  placeholder?: string;
}) {
  const {scheme} = useTheme();
  const styles = STYLES[scheme];

  const openAndroid = () => {
    const base = value ?? new Date();
    DateTimePickerAndroid.open({
      value: base,
      mode: 'date',
      onChange: (ev, date) => {
        if (ev.type !== 'set' || !date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onChange: (ev2, dt) => {
            if (ev2.type === 'set' && dt) onChange(dt);
          },
        });
      },
    });
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'ios' && value ? (
        <DateTimePicker
          value={value}
          mode="datetime"
          display="compact"
          themeVariant={scheme}
          onChange={(_, d) => d && onChange(d)}
        />
      ) : (
        <Pressable
          style={styles.button}
          onPress={() => (Platform.OS === 'android' ? openAndroid() : onChange(new Date()))}>
          <Text style={[styles.buttonText, !value && styles.placeholder]}>
            {value ? value.toLocaleString() : placeholder}
          </Text>
        </Pressable>
      )}
      {value != null && (
        <Pressable hitSlop={8} onPress={() => onChange(null)}>
          <Text style={styles.clear}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const STYLES = themedStyles((c: ThemeColors) => ({
  field: {flexDirection: 'row', alignItems: 'center', gap: 8},
  label: {color: c.textDim, fontSize: 13, fontFamily: MONO},
  button: {
    minWidth: 100,
    backgroundColor: c.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  buttonText: {color: c.text, fontSize: 13, fontFamily: MONO, fontWeight: '600'},
  placeholder: {color: c.textDim, fontWeight: '400'},
  clear: {color: c.dangerText, fontSize: 13, paddingHorizontal: 2},
}));
