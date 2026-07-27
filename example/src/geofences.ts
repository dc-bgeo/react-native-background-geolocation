/** Keep the app store and the web console in sync with the SDK's geofence set
 * (the device is the source of truth). Call after every CRUD operation and on
 * onGeofencesChange. */

import BackgroundGeolocation from '@bgeo/react-native-background-geolocation';

import {appStore} from './appStore';
import {putGeofences} from './deviceLink';

export async function syncGeofences(): Promise<void> {
  const geofences = await BackgroundGeolocation.getGeofences();
  appStore.setGeofences(geofences);
  await putGeofences(geofences); // no-op (null) when not linked
}
