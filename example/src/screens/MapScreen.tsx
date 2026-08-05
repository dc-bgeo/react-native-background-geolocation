/** Map screen — console parity: status chips, start/stop, layer toggles
 * (follow/markers/polylines/geofences), from-to history range (hybrid source),
 * geofence CRUD (long-press to add, tap a fence pin to edit). */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, TouchableOpacity, StyleSheet, Text, View} from 'react-native';
import MapView, {Circle, Marker, Polyline} from 'react-native-maps';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import BackgroundGeolocation from '@dc-bgeo/react-native-background-geolocation';

import {appStore, type Point} from '../appStore';
import {Chevron} from '../components/Chevron';
import {CoordinatesSheet, SHEET_PEEK_HEIGHT} from '../components/CoordinatesSheet';
import {DateTimeField} from '../components/DateTimeField';
import {DotMarker} from '../components/DotMarker';
import {loadHistory} from '../history';
import {logEvent} from '../logUploader';
import type {RootStackParamList} from '../navigation';
import {MONO, themedStyles, useTheme, type ThemeColors} from '../theme';
import {useAppStore} from '../useAppStore';
import MapIcon from '../assets/map.svg';
import MapFillIcon from '../assets/map.fill.svg';
import LocationIcon from '../assets/location.svg';
import LocationFillIcon from '../assets/location.fill.svg';

// Markers are native views and get slow in the thousands — the map renders a
// paged window of at most this many points (parity with the web console).
const PAGE_SIZE = 1000;

// Geofence transition colors (parity with the web console's TrackMap).
const GEOFENCE_ACTION_COLOR: Record<string, string> = {
  ENTER: '#22c55e',
  EXIT: '#ef4444',
  DWELL: '#f59e0b',
};
const GEOFENCE_FALLBACK_COLOR = '#f97316';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MapScreen() {
  const navigation = useNavigation<Nav>();
  const {points, geofences, status, link} = useAppStore();
  const {scheme, colors} = useTheme();
  const styles = STYLES[scheme];
  const mapRef = useRef<MapView>(null);

  const [follow, setFollow] = useState(true);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [layers, setLayers] = useState({markers: true, polylines: true, geofences: true});
  const [panelOpen, setPanelOpen] = useState(true);
  const [fromDraft, setFromDraft] = useState<Date | null>(null);
  const [toDraft, setToDraft] = useState<Date | null>(null);
  const [historyPoints, setHistoryPoints] = useState<Point[] | null>(null);
  const [loading, setLoading] = useState(false);

  const rangeActive = historyPoints != null;
  const displayPoints = historyPoints ?? points;

  // Paged window over the track: page 0 = the newest PAGE_SIZE points (follows
  // live), older pages step back through history. The map only draws the window.
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(displayPoints.length / PAGE_SIZE));
  const effPage = Math.min(page, pageCount - 1);
  const windowEnd = displayPoints.length - effPage * PAGE_SIZE;
  const windowStart = Math.max(0, windowEnd - PAGE_SIZE);
  const view = useMemo(
    () => displayPoints.slice(windowStart, windowEnd),
    [displayPoints, windowStart, windowEnd],
  );
  const onNewestPage = effPage === 0;
  const last = displayPoints[displayPoints.length - 1];

  useEffect(() => {
    if (follow && !rangeActive && onNewestPage && last && mapRef.current) {
      mapRef.current.animateCamera({center: last}, {duration: 400});
    }
  }, [follow, rangeActive, onNewestPage, last]);

  // Fit the camera to the window when the user pages through history.
  const fittedPage = useRef(0);
  useEffect(() => {
    if (fittedPage.current === effPage) return;
    fittedPage.current = effPage;
    if (view.length > 1 && mapRef.current) {
      mapRef.current.fitToCoordinates(view, {
        edgePadding: {top: 180, bottom: 60, left: 40, right: 40},
        animated: true,
      });
    }
  }, [effPage, view]);

  const onToggleTracking = useCallback(async () => {
    if (status.enabled) {
      await BackgroundGeolocation.stop();
      appStore.setStatus({enabled: false});
      logEvent('stop', 'tracking stopped', undefined, 'info');
    } else {
      await BackgroundGeolocation.requestPermission().catch((e: any) =>
        logEvent('requestPermission', e?.message ?? String(e), undefined, 'error'),
      );
      await BackgroundGeolocation.start();
      appStore.setStatus({enabled: true});
      logEvent('start', 'tracking started', undefined, 'info');
    }
  }, [status.enabled]);

  const onGetPosition = useCallback(async () => {
    try {
      const location: any = await BackgroundGeolocation.getCurrentPosition({samples: 1, timeout: 30});
      const c = location?.coords;
      logEvent(
        'getCurrentPosition',
        `${c?.latitude?.toFixed(6)}, ${c?.longitude?.toFixed(6)}`,
        undefined,
        'info',
      );
    } catch (e: any) {
      logEvent('getCurrentPosition', e?.message ?? String(e), undefined, 'error');
    }
  }, []);

  const applyRange = useCallback(async () => {
    if (!fromDraft && !toDraft) return;
    setLoading(true);
    setFollow(false);
    const pts = await loadHistory(fromDraft?.toISOString() ?? null, toDraft?.toISOString() ?? null);
    setHistoryPoints(pts);
    setLoading(false);
    setPage(0);
    // Fit to the newest window of the range — that's what the map will draw.
    const windowPts = pts.slice(-PAGE_SIZE);
    if (windowPts.length > 1 && mapRef.current) {
      mapRef.current.fitToCoordinates(windowPts, {
        edgePadding: {top: 180, bottom: 60, left: 40, right: 40},
        animated: true,
      });
    }
  }, [fromDraft, toDraft]);

  const resetRange = useCallback(() => {
    setHistoryPoints(null);
    setFromDraft(null);
    setToDraft(null);
    setPage(0);
  }, []);

  const recenter = useCallback(() => {
    if (last && mapRef.current) {
      mapRef.current.animateCamera({center: last, zoom: 15}, {duration: 400});
    }
    setFollow(true);
  }, [last]);

  // Keyed here, not at the call site, and deliberately WITHOUT the array
  // index: React reconciles markers by key, so an index-derived key changes
  // for every point in the window the moment the window slides (a new fix past
  // PAGE_SIZE, or the 2000-point cap evicting the head) and React unmounts and
  // remounts the entire track — the same wholesale-rebuild defect iOS and
  // Android each shipped in their own renderer. `uuid ?? timestamp` is stable
  // across a slide; neither is guaranteed unique, so a repeat takes an
  // occurrence suffix rather than colliding into one (duplicate React keys
  // drop siblings).
  const markerPoints = useMemo(() => {
    if (!layers.markers) return [];
    const seen: Record<string, number> = {};
    return view.map(point => {
      const base = point.uuid ?? point.timestamp;
      const occurrence = (seen[base] = (seen[base] ?? 0) + 1);
      return {point, key: occurrence === 1 ? base : `${base}#${occurrence}`};
    });
  }, [layers.markers, view]);

  // Latest geofence transition per region in the window — the region (circle,
  // pin) and its event dot take the action's color; regions that did not fire
  // keep the fallback orange. Events whose region is no longer in the SDK
  // snapshot stay a plain dot at the point (web console parity).
  const {geofenceActionColor, geofenceEvents} = useMemo(() => {
    const colorById: Record<string, string> = {};
    const events: {point: Point; color: string}[] = [];
    if (layers.geofences) {
      const known = new Set(geofences.map(g => g.identifier));
      for (const p of view) {
        if (p.event !== 'geofence') continue;
        const action = p.geofence?.action?.toUpperCase();
        const color = (action && GEOFENCE_ACTION_COLOR[action]) || GEOFENCE_FALLBACK_COLOR;
        events.push({point: p, color});
        if (p.geofence && known.has(p.geofence.identifier)) {
          colorById[p.geofence.identifier] = color;
        }
      }
    }
    return {geofenceActionColor: colorById, geofenceEvents: events};
  }, [view, geofences, layers.geofences]);

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        // provider={PROVIDER_GOOGLE}
        // userInterfaceStyle is read when the native map is created — remount on
        // a theme flip so it takes effect (the web console remounts too).
        key={scheme}
        style={StyleSheet.absoluteFill}
        showsUserLocation
        showsMyLocationButton={false}
        mapType={mapType}
        userInterfaceStyle={scheme}
        onPanDrag={() => setFollow(false)}
        onLongPress={e =>
          navigation.navigate('GeofenceForm', {
            latitude: e.nativeEvent.coordinate.latitude,
            longitude: e.nativeEvent.coordinate.longitude,
          })
        }
        initialRegion={{
          latitude: last?.latitude ?? 52.52,
          longitude: last?.longitude ?? 13.405,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}>
        {layers.polylines && view.length > 1 && (
          <Polyline coordinates={view} strokeColor="#3A6FF0" strokeWidth={3} />
        )}
        {markerPoints.map(({point, key}) => (
          <DotMarker key={key} coordinate={point}>
            <View style={styles.dot} />
          </DotMarker>
        ))}
        {geofenceEvents.map(({point: p, color}) => (
          <DotMarker key={`gf-${p.uuid ?? p.timestamp}`} coordinate={p} redrawKey={color}>
            <View
              style={[styles.geofenceEventDot, {borderColor: color, backgroundColor: `${color}66`}]}
            />
          </DotMarker>
        ))}
        {layers.geofences &&
          geofences.map(g => {
            const color = geofenceActionColor[g.identifier] ?? GEOFENCE_FALLBACK_COLOR;
            return (
              <React.Fragment key={g.identifier}>
                <Circle
                  center={{latitude: g.latitude, longitude: g.longitude}}
                  radius={g.radius}
                  strokeColor={color}
                  strokeWidth={2}
                  fillColor={`${color}1F`}
                />
                <Marker
                  coordinate={{latitude: g.latitude, longitude: g.longitude}}
                  pinColor={color}
                  title={g.identifier}
                  description="tap again to edit"
                  onCalloutPress={() =>
                    navigation.navigate('GeofenceForm', {
                      latitude: g.latitude,
                      longitude: g.longitude,
                      identifier: g.identifier,
                    })
                  }
                />
              </React.Fragment>
            );
          })}
        {last && onNewestPage && (
          <DotMarker coordinate={last} redrawKey={status.isMoving}>
            <View style={[styles.lastDot, status.isMoving ? styles.moving : styles.stationary]} />
          </DotMarker>
        )}
      </MapView>

      <SafeAreaView edges={['top']} style={styles.panel} pointerEvents="box-none">
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: status.ready
                  ? status.enabled
                    ? colors.success
                    : colors.textDim
                  : colors.warning,
              },
            ]}
          />
          <Text style={styles.statusLabel}>{link.linked ? 'linked' : 'not linked'}</Text>
          {link.linked && <Text style={styles.statusId}>{link.deviceId?.slice(0, 8)}</Text>}
          <View style={styles.statusRight}>
            <Text style={[styles.statusMeta, status.isMoving ? styles.movingText : styles.dimText]}>
              ● {status.isMoving ? 'moving' : 'stationary'}
            </Text>
            {status.batteryLevel != null && (
              <Text style={[styles.statusMeta, styles.dimText]}>
                {Math.round(status.batteryLevel * 100)}%
              </Text>
            )}
            <Text style={[styles.statusMeta, styles.dimText]}>·</Text>
            <Text style={[styles.statusMeta, styles.ptsText]}>
              {displayPoints.length} pts{rangeActive ? ' (hist)' : ''}
            </Text>
          </View>
        </View>

        <View style={styles.controlCard}>
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[styles.mainButton, status.enabled ? styles.buttonStop : styles.buttonStart]}
              onPress={onToggleTracking}>
              {status.enabled ? (
                <View style={styles.stopGlyph} />
              ) : (
                <View style={styles.playGlyph} />
              )}
              <Text style={styles.mainButtonText}>{status.enabled ? 'Stop' : 'Start'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={onGetPosition}>
              <LocationIcon width={16} height={16} color={colors.text} />
              <Text style={styles.secondaryButtonText}>Get position</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.collapseButton} onPress={() => setPanelOpen(o => !o)}>
              <Chevron up={panelOpen} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          {panelOpen && (
            <>
              <View style={styles.controlRow}>
                <LayerToggle label="Follow" active={follow} onPress={() => setFollow(f => !f)} />
                <LayerToggle
                  label="Pts"
                  active={layers.markers}
                  onPress={() => setLayers(l => ({...l, markers: !l.markers}))}
                />
                <LayerToggle
                  label="Line"
                  active={layers.polylines}
                  onPress={() => setLayers(l => ({...l, polylines: !l.polylines}))}
                />
                <LayerToggle
                  label="Geo"
                  active={layers.geofences}
                  onPress={() => setLayers(l => ({...l, geofences: !l.geofences}))}
                />
              </View>
              <View style={styles.controlRow}>
                <DateTimeField label="From" value={fromDraft} onChange={setFromDraft} />
                <DateTimeField label="To" value={toDraft} onChange={setToDraft} placeholder="now" />
                {loading ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <TouchableOpacity
                    style={[styles.applyButton, !fromDraft && !toDraft && styles.disabled]}
                    disabled={!fromDraft && !toDraft}
                    onPress={applyRange}>
                    <Text style={styles.applyText}>Apply</Text>
                  </TouchableOpacity>
                )}
                {rangeActive && (
                  <TouchableOpacity style={styles.applyButton} onPress={resetRange}>
                    <Text style={styles.applyText}>Live</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </SafeAreaView>

      <TouchableOpacity
        style={[styles.mapFab, styles.mapTypeButton]}
        onPress={() => setMapType(t => (t === 'standard' ? 'satellite' : 'standard'))}>
        {mapType === 'satellite' ? (
          <MapFillIcon width={22} height={21} color={colors.text} />
        ) : (
          <MapIcon width={22} height={21} color={colors.text} />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.mapFab, styles.recenter, follow && styles.recenterActive]}
        disabled={follow}
        onPress={recenter}>
        {follow ? (
          <LocationFillIcon width={20} height={19} color={colors.onAccent} />
        ) : (
          <LocationIcon width={20} height={19} color={colors.text} />
        )}
      </TouchableOpacity>

      {pageCount > 1 && (
        <View style={styles.pager}>
          <TouchableOpacity
            style={[styles.pagerButton, effPage >= pageCount - 1 && styles.disabled]}
            disabled={effPage >= pageCount - 1}
            onPress={() => setPage(Math.min(pageCount - 1, effPage + 1))}>
            <Text style={styles.pagerArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.pagerText}>
            {windowStart + 1}–{windowEnd} / {displayPoints.length}
            {onNewestPage && !rangeActive ? ' · live' : ''}
          </Text>
          <TouchableOpacity
            style={[styles.pagerButton, onNewestPage && styles.disabled]}
            disabled={onNewestPage}
            onPress={() => setPage(Math.max(0, effPage - 1))}>
            <Text style={styles.pagerArrow}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      <CoordinatesSheet points={displayPoints} />
    </View>
  );
}

function LayerToggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const styles = STYLES[useTheme().scheme];
  return (
    <TouchableOpacity style={[styles.toggle, active && styles.toggleActive]} onPress={onPress}>
      <View style={[styles.toggleDot, active && styles.toggleDotActive]} />
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const STYLES = themedStyles((c: ThemeColors) => ({
  root: {flex: 1, backgroundColor: c.background},
  panel: {paddingHorizontal: 10, paddingTop: 4},
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.panel,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
    overflow: 'hidden',
  },
  statusDot: {width: 10, height: 10, borderRadius: 5},
  statusLabel: {color: c.text, fontSize: 14, fontWeight: '700', fontFamily: MONO},
  statusId: {color: c.textDim, fontSize: 13, fontFamily: MONO},
  statusRight: {flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto'},
  statusMeta: {fontSize: 13, fontFamily: MONO, fontWeight: '600'},
  movingText: {color: c.successText},
  dimText: {color: c.textDim},
  ptsText: {color: c.warningText, fontWeight: '700'},
  controlCard: {
    backgroundColor: c.panel,
    borderRadius: 18,
    padding: 10,
    gap: 8,
  },
  controlRow: {flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'},
  mainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 18,
  },
  buttonStart: {backgroundColor: c.accent},
  buttonStop: {backgroundColor: c.danger},
  stopGlyph: {width: 10, height: 10, borderRadius: 2, backgroundColor: c.onAccent},
  playGlyph: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 9,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: c.onAccent,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    height: 46,
    backgroundColor: c.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border,
  },
  mainButtonText: {color: c.onAccent, fontWeight: '700', fontSize: 15},
  secondaryButtonText: {color: c.text, fontWeight: '700', fontSize: 15},
  collapseButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: c.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    height: 38,
    paddingHorizontal: 14,
    backgroundColor: c.surfaceRaised,
  },
  toggleActive: {backgroundColor: c.accent},
  toggleDot: {width: 5, height: 5, borderRadius: 3, backgroundColor: c.textDim},
  toggleDotActive: {backgroundColor: c.onAccent},
  toggleText: {color: c.textDim, fontSize: 14, fontWeight: '700'},
  toggleTextActive: {color: c.onAccent},
  applyButton: {
    borderRadius: 10,
    height: 38,
    paddingHorizontal: 16,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  applyText: {color: c.onAccent, fontWeight: '700', fontSize: 14},
  disabled: {opacity: 0.4},
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(58,111,240,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  // colors come from the transition action (GEOFENCE_ACTION_COLOR)
  geofenceEventDot: {width: 14, height: 14, borderRadius: 7, borderWidth: 2},
  lastDot: {width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#fff'},
  moving: {backgroundColor: '#22c55e'},
  stationary: {backgroundColor: '#3A6FF0'},
  mapFab: {
    position: 'absolute',
    right: 14,
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 3},
    elevation: 4,
  },
  mapTypeButton: {
    bottom: SHEET_PEEK_HEIGHT + 84,
    backgroundColor: c.panel,
  },
  recenter: {
    bottom: SHEET_PEEK_HEIGHT + 24,
    backgroundColor: c.panel,
  },
  recenterActive: {backgroundColor: c.accent},
  pager: {
    position: 'absolute',
    left: 14,
    bottom: SHEET_PEEK_HEIGHT + 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: c.panel,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  pagerButton: {paddingHorizontal: 8, paddingVertical: 2},
  pagerArrow: {color: c.text, fontSize: 16, fontWeight: '700', fontFamily: MONO},
  pagerText: {color: c.text, fontSize: 12, fontFamily: MONO, fontWeight: '600'},
}));
