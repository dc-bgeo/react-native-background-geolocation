/** Hybrid history source for the Map screen's from/to range: server history
 * when the device is linked (same data the web console shows), otherwise the
 * local session buffer filtered by timestamp. */

import {appStore, type Point} from './appStore';
import {currentLink, deviceFetch} from './deviceLink';

export function filterPointsByRange(
  points: Point[],
  from: string | null,
  to: string | null,
): Point[] {
  const fromMs = from ? Date.parse(from) : null;
  const toMs = to ? Date.parse(to) : null;
  return points.filter(p => {
    const t = Date.parse(p.timestamp);
    return (fromMs == null || t >= fromMs) && (toMs == null || t <= toMs);
  });
}

/** Console /v1 + /device history camelCase shape -> app Point. */
export function serverLocationToPoint(loc: any): Point {
  return {
    uuid: loc.uuid,
    timestamp: loc.recordedAt,
    latitude: loc.lat,
    longitude: loc.lng,
    accuracy: loc.accuracy ?? undefined,
    speed: loc.speed ?? undefined,
    heading: loc.heading ?? undefined,
    odometer: loc.odometer ?? undefined,
    activity: loc.activityType ?? loc.activity ?? undefined,
    isMoving: loc.isMoving ?? undefined,
    event: loc.event,
  };
}

export async function loadHistory(from: string | null, to: string | null): Promise<Point[]> {
  if (await currentLink()) {
    const qs = new URLSearchParams({limit: '2000'});
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const res = await deviceFetch(`/device/locations?${qs}`);
    if (res?.locations) {
      // Server returns newest-first; polylines want oldest-first.
      return res.locations.map(serverLocationToPoint).reverse();
    }
  }
  return filterPointsByRange(appStore.getState().points, from, to);
}
