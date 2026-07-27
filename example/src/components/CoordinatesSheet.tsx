/** Collapsible bottom sheet with the collected-coordinates table (newest first).
 * Peeks as the drag handle + header by default; drag or tap to expand.
 * The table scrolls horizontally (fixed-width columns) and vertically. */

import React, {useMemo, useRef, useState} from 'react';
import {
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import type {Point} from '../appStore';
import {MONO, themedStyles, useTheme, type ThemeColors} from '../theme';
import {Chevron} from './Chevron';

const HANDLE_ZONE_HEIGHT = 26;
const HEADER_HEIGHT = 44;
export const SHEET_PEEK_HEIGHT = HANDLE_ZONE_HEIGHT + HEADER_HEIGHT;

// Table-head block height (used to bound the FlatList so it can virtualize).
const TABLE_HEAD_HEIGHT = 30;
// Fixed row height — lets getItemLayout skip measurement (border-box, incl. hairline border).
const ROW_HEIGHT = 36;

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const num = (v: number | undefined, digits: number) =>
  v != null && v >= 0 ? v.toFixed(digits) : '–';

// Same palette as the web console's geofence-event markers, in the ink shades
// that stay readable on the sheet.
function actionColor(c: ThemeColors, action: string | undefined): string {
  if (action === 'ENTER') return c.successText;
  if (action === 'EXIT') return c.dangerText;
  return c.warningText;
}

function EventCell({point}: {point: Point}) {
  const {scheme, colors} = useTheme();
  const styles = STYLES[scheme];
  if (point.event === 'geofence') {
    const action = point.geofence?.action?.toUpperCase();
    const color = actionColor(colors, action);
    return (
      <View style={[styles.tdEvent, styles.colEvent]}>
        <View style={[styles.tdEventDot, {backgroundColor: color}]} />
        <Text numberOfLines={1} style={[styles.tdEventText, {color}]}>
          {point.geofence?.identifier ?? 'geofence'}
          {action ? ` · ${action}` : ''}
        </Text>
      </View>
    );
  }
  return <Text style={[styles.tdDim, styles.colEvent]}>{point.event ?? '-'}</Text>;
}

const Row = React.memo(function Row({item, number}: {item: Point; number: number}) {
  const styles = STYLES[useTheme().scheme];
  return (
    <View style={[styles.tr, item.event === 'geofence' && styles.trGeofence]}>
      <Text style={[styles.tdDim, styles.colNum]}>{String(number).padStart(2, '0')}</Text>
      <Text style={[styles.td, styles.colTime]}>{formatTime(item.timestamp)}</Text>
      <Text style={[styles.td, styles.colCoord]}>{item.latitude.toFixed(5)}</Text>
      <Text style={[styles.td, styles.colCoord]}>{item.longitude.toFixed(5)}</Text>
      <Text style={[styles.tdAcc, styles.colMid]}>
        {item.accuracy != null ? Math.round(item.accuracy) : '–'}
      </Text>
      <Text style={[styles.td, styles.colWide]}>{num(item.speed, 1)}</Text>
      <Text style={[styles.td, styles.colMid]}>
        {item.odometer != null ? Math.round(item.odometer) : '–'}
      </Text>
      <Text style={[styles.td, styles.colMid]}>
        {item.heading != null && item.heading >= 0 ? `${Math.round(item.heading)}°` : '–'}
      </Text>
      <Text style={[item.isMoving ? styles.tdMoving : styles.tdDim, styles.colMid]}>
        {item.isMoving == null ? '–' : item.isMoving ? 'yes' : 'no'}
      </Text>
      <Text style={[styles.tdDim, styles.colMid]}>{item.activity ?? '–'}</Text>
      <EventCell point={item} />
    </View>
  );
});

export function CoordinatesSheet({points}: {points: Point[]}) {
  const {scheme, colors} = useTheme();
  const styles = STYLES[scheme];
  const {height: windowHeight} = useWindowDimensions();
  const expandedHeight = Math.min(460, Math.round(windowHeight * 0.55));
  // Bounded viewport height so the FlatList virtualizes instead of mounting every row.
  const listHeight = expandedHeight - SHEET_PEEK_HEIGHT - TABLE_HEAD_HEIGHT;
  const [expanded, setExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(SHEET_PEEK_HEIGHT)).current;
  const dragStart = useRef(SHEET_PEEK_HEIGHT);

  const snapTo = (next: boolean) => {
    setExpanded(next);
    Animated.spring(heightAnim, {
      toValue: next ? expandedHeight : SHEET_PEEK_HEIGHT,
      bounciness: 0,
      useNativeDriver: false,
    }).start();
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
        onPanResponderGrant: () => {
          heightAnim.stopAnimation(v => {
            dragStart.current = v;
          });
        },
        onPanResponderMove: (_e, g) => {
          const h = Math.min(
            expandedHeight,
            Math.max(SHEET_PEEK_HEIGHT, dragStart.current - g.dy),
          );
          heightAnim.setValue(h);
        },
        onPanResponderRelease: (_e, g) => {
          const projected = dragStart.current - g.dy - g.vy * 120;
          const next = projected > (SHEET_PEEK_HEIGHT + expandedHeight) / 2;
          setExpanded(next);
          Animated.spring(heightAnim, {
            toValue: next ? expandedHeight : SHEET_PEEK_HEIGHT,
            bounciness: 0,
            useNativeDriver: false,
          }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expandedHeight],
  );

  const rows = useMemo(() => [...points].reverse(), [points]);

  return (
    <Animated.View style={[styles.sheet, {height: heightAnim}]}>
      <View {...pan.panHandlers}>
        <Pressable style={styles.handleZone} onPress={() => snapTo(!expanded)}>
          <View style={styles.handle} />
        </Pressable>
        <View style={styles.header}>
          <View style={styles.burger}>
            <View style={styles.burgerBar} />
            <View style={styles.burgerBar} />
            <View style={styles.burgerBar} />
          </View>
          <Text style={styles.title}>Collected coordinates</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{points.length} pts</Text>
          </View>
          <TouchableOpacity
            hitSlop={12}
            style={styles.chevronButton}
            onPress={() => snapTo(!expanded)}>
            <Chevron up={!expanded} color={colors.textDim} />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
        <View>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colNum]}>#</Text>
            <Text style={[styles.th, styles.colTime]}>TIME</Text>
            <Text style={[styles.th, styles.colCoord]}>LAT</Text>
            <Text style={[styles.th, styles.colCoord]}>LNG</Text>
            <Text style={[styles.th, styles.colMid]}>ACCURACY (m)</Text>
            <Text style={[styles.th, styles.colWide]}>SPEED (m/s)</Text>
            <Text style={[styles.th, styles.colMid]}>ODOMETER (m)</Text>
            <Text style={[styles.th, styles.colMid]}>HEADING</Text>
            <Text style={[styles.th, styles.colMid]}>IS MOVING</Text>
            <Text style={[styles.th, styles.colMid]}>ACTIVITY</Text>
            <Text style={[styles.th, styles.colEvent]}>EVENT</Text>
          </View>
          {rows.length === 0 ? (
            <Text style={styles.empty}>no points yet</Text>
          ) : (
            <FlatList
              data={rows}
              style={{height: listHeight}}
              scrollEnabled={expanded}
              keyExtractor={(p, i) => p.uuid ?? `${p.timestamp}-${i}`}
              getItemLayout={(_, index) => ({
                length: ROW_HEIGHT,
                offset: ROW_HEIGHT * index,
                index,
              })}
              showsVerticalScrollIndicator={false}
              initialNumToRender={16}
              maxToRenderPerBatch={16}
              windowSize={11}
              removeClippedSubviews
              renderItem={({item, index}) => (
                <Row item={item} number={rows.length - index} />
              )}
            />
          )}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const STYLES = themedStyles((c: ThemeColors) => ({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.panel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handleZone: {
    height: HANDLE_ZONE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.handle,
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  burger: {gap: 3},
  burgerBar: {width: 18, height: 2.5, borderRadius: 2, backgroundColor: c.accent},
  title: {color: c.text, fontSize: 17, fontWeight: '700'},
  badge: {
    backgroundColor: c.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeText: {color: c.accentText, fontSize: 12, fontWeight: '700', fontFamily: MONO},
  chevronButton: {marginLeft: 'auto', padding: 4},
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  th: {color: c.textDim, fontSize: 12, fontFamily: MONO, letterSpacing: 1},
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.separator,
  },
  trGeofence: {backgroundColor: c.warningSoft},
  td: {color: c.text, fontSize: 13, fontFamily: MONO, fontWeight: '600'},
  tdDim: {color: c.textDim, fontSize: 13, fontFamily: MONO},
  tdAcc: {color: c.accentText, fontSize: 13, fontFamily: MONO, fontWeight: '600'},
  tdMoving: {color: c.successText, fontSize: 13, fontFamily: MONO, fontWeight: '600'},
  tdEvent: {flexDirection: 'row', alignItems: 'center', gap: 8},
  tdEventDot: { width: 12, height: 12, borderRadius: 12},
  tdEventText: {fontSize: 13, fontFamily: MONO, fontWeight: '600'},
  colNum: {width: 34},
  colTime: {width: 86},
  colCoord: {width: 96, textAlign: 'right', paddingRight: 12},
  colWide: {width: 116, textAlign: 'right', paddingRight: 12},
  colMid: {width: 96, textAlign: 'right', paddingRight: 12},
  colEvent: {width: 170, paddingRight: 12},
  empty: {color: c.textDim, fontFamily: MONO, fontSize: 12, padding: 16},
}));
