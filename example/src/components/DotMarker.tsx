/** Marker with a custom child view for the track dots.
 *
 * iOS (Apple Maps): children render as live UIViews centered on the
 * coordinate — no rasterization, nothing extra needed. (The `icon`/`image`
 * props are broken there on bridgeless RN — the Fabric wrapper drops `icon`
 * and loads `image` via the nil legacy bridge — so child views are the only
 * working path.)
 *
 * Android (Google): children become a one-shot bitmap snapshot; mount with
 * tracksViewChanges ON and flip it off after the child has rendered so the
 * snapshot isn't taken blank. `redrawKey` re-runs the cycle when the child's
 * appearance changes. collapsable={false} keeps a real native view to
 * snapshot. */

import React, {useEffect, useState} from 'react';
import {View} from 'react-native';
import {Marker, type MapMarkerProps} from 'react-native-maps';

const SETTLE_MS = 350;

export function DotMarker({
  children,
  redrawKey,
  ...props
}: Omit<MapMarkerProps, 'tracksViewChanges'> & {redrawKey?: unknown}) {
  const [tracks, setTracks] = useState(true);

  useEffect(() => {
    setTracks(true);
    const timer = setTimeout(() => setTracks(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [redrawKey]);

  return (
    <Marker {...props} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={tracks}>
      <View collapsable={false}>{children}</View>
    </Marker>
  );
}
