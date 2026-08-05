/** Keep the app store and the web console in sync with the SDK's geofence set
 * (the device is the source of truth). Call after every CRUD operation and on
 * onGeofencesChange. */

import BackgroundGeolocation from '@dc-bgeo/react-native-background-geolocation';

import {appStore} from './appStore';
import {putGeofences} from './deviceLink';
import {logEvent} from './logUploader';

export async function syncGeofences(): Promise<void> {
  const geofences = await BackgroundGeolocation.getGeofences();
  appStore.setGeofences(geofences);
  // The push is the one step whose failure is otherwise invisible: the fence
  // is on the device and drawn on the map, the console just never hears about
  // it. `putGeofences` is a no-op (false) when not linked, and swallows a
  // rejected request — so log the outcome rather than discarding it.
  const pushed = await putGeofences(geofences);
  logEvent(
    'putGeofences',
    pushed
      ? `${geofences.length} mirrored to console`
      : `console not updated (${geofences.length} local)`,
    undefined,
    pushed ? 'info' : 'warn',
  );
}
