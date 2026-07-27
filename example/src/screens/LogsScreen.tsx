/** Logs screen — the same event stream and formatting as the web console's
 * LogStream (ts / [LEVEL] / event / message / data, same colors), with a level
 * filter, follow-tail and clear. JS lines stream live via appStore; native
 * engine lines (track.*, wake.*, motion.* — persisted by logLevel) are polled
 * from the module's getLog() history and merged in by timestamp. */

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {FlatList, TouchableOpacity, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import BackgroundGeolocation, {type LogEntry} from '@dc-bgeo/react-native-background-geolocation';

import {appStore, type LogLine} from '../appStore';
import {MONO, themedStyles, useTheme, type ThemeColors} from '../theme';
import {useAppStore} from '../useAppStore';

const LEVELS = ['all', 'verbose', 'debug', 'info', 'warn', 'error'] as const;

const NATIVE_POLL_MS = 3000;
const NATIVE_FETCH_LIMIT = 300;

// Native numeric levels -> LogLine names.
const LEVEL_NAMES: Record<number, LogLine['level']> = {
  1: 'error', 2: 'warn', 3: 'info', 4: 'debug', 5: 'verbose',
};

// JS lines (src:"js") already stream via appStore — only merge native rows.
function toLogLine(entry: LogEntry): LogLine {
  return {
    ts: entry.ts,
    level: LEVEL_NAMES[entry.level] ?? 'info',
    event: entry.event,
    message: entry.message,
    data: entry.data,
  };
}

// Level inks, sourced from the palette so both themes stay readable. The web
// console paints `info` green like the event name; here it takes the accent so
// the level and the event stay distinguishable.
function levelColor(c: ThemeColors, level: string): string {
  switch (level) {
    case 'verbose': return c.placeholder;
    case 'debug': return c.textDim;
    case 'info': return c.accentText;
    case 'warn': return c.warningText;
    case 'error': return c.dangerText;
    default: return c.text;
  }
}

export function LogsScreen() {
  const {logs} = useAppStore();
  const styles = STYLES[useTheme().scheme];
  const listRef = useRef<FlatList<LogLine>>(null);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('all');
  const [follow, setFollow] = useState(true);
  const [nativeLines, setNativeLines] = useState<LogLine[]>([]);

  useEffect(() => {
    let alive = true;
    const fetchNative = () =>
      BackgroundGeolocation.getLog(NATIVE_FETCH_LIMIT)
        .then(entries => {
          if (alive) {
            setNativeLines(entries.filter(e => e.src === 'native').map(toLogLine));
          }
        })
        .catch(() => null);
    fetchNative();
    const timer = setInterval(fetchNative, NATIVE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const merged = useMemo(
    () => [...logs, ...nativeLines].sort((a, b) => a.ts.localeCompare(b.ts)),
    [logs, nativeLines],
  );

  const filtered = useMemo(
    () => (level === 'all' ? merged : merged.filter(l => l.level === level)),
    [merged, level],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        {LEVELS.map(l => (
          <TouchableOpacity
            key={l}
            style={[styles.chip, level === l && styles.chipActive]}
            onPress={() => setLevel(l)}>
            <Text style={[styles.chipText, level === l && styles.chipTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.spacer} />
        <TouchableOpacity
          style={[styles.chip, follow && styles.chipActive]}
          onPress={() => setFollow(f => !f)}>
          <Text style={[styles.chipText, follow && styles.chipTextActive]}>follow</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chip} onPress={() => appStore.clearLogs()}>
          <Text style={styles.chipText}>clear</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContainer}
        data={filtered}
        keyExtractor={(_, i) => String(i)}
        onScrollBeginDrag={() => setFollow(false)}
        onContentSizeChange={() => {
          // rAF lets wrapped multi-line rows finish layout, else the scroll lands short.
          if (follow) {
            requestAnimationFrame(() => listRef.current?.scrollToEnd({animated: false}));
          }
        }}
        ListEmptyComponent={<Text style={styles.empty}>waiting for events…</Text>}
        renderItem={({item}) => <LogRow line={item} />}
      />
    </SafeAreaView>
  );
}

const LogRow = React.memo(({line}: {line: LogLine}) => {
  const {scheme, colors} = useTheme();
  const styles = STYLES[scheme];
  return (
    <Text style={styles.line}>
      <Text style={styles.ts}>{line.ts.slice(11, 23)} </Text>
      <Text style={{color: levelColor(colors, line.level)}}>
        [{line.level.toUpperCase()}]{' '}
      </Text>
      <Text style={styles.event}>{line.event}</Text>
      {line.message ? <Text style={styles.message}> {line.message}</Text> : null}
      {line.data != null ? <Text style={styles.data}> {JSON.stringify(line.data)}</Text> : null}
    </Text>
  );
});

const STYLES = themedStyles((c: ThemeColors) => ({
  root: {flex: 1, backgroundColor: c.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexWrap: 'wrap',
  },
  spacer: {flex: 1},
  chip: {borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: c.surfaceRaised},
  chipActive: {backgroundColor: c.accent},
  chipText: {color: c.textDim, fontSize: 12, fontWeight: '600'},
  chipTextActive: {color: c.onAccent},
  list: {
    flex: 1,
    marginHorizontal: 12,
    marginVertical: 12,
    backgroundColor: c.field,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
  },
  listContainer: {paddingHorizontal: 8, paddingVertical: 12},
  line: {fontSize: 12, fontFamily: MONO, lineHeight: 18},
  ts: {color: c.textDim},
  event: {color: c.successText},
  message: {color: c.text2},
  data: {color: c.textDim},
  empty: {color: c.placeholder, fontSize: 12, fontFamily: MONO, padding: 8},
}));
