/**
 * @format
 */

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => void store.set(k, v)),
      removeItem: jest.fn(async (k: string) => void store.delete(k)),
      clear: jest.fn(async () => store.clear()),
    },
  };
});
jest.mock('@dc-bgeo/react-native-background-geolocation', () => ({
  __esModule: true,
  default: {setConfig: jest.fn(() => Promise.resolve({}))},
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundGeolocation from '@dc-bgeo/react-native-background-geolocation';

import {appStore} from '../src/appStore';
import {unlinkDevice} from '../src/deviceLink';

beforeEach(async () => {
  await AsyncStorage.clear();
  (BackgroundGeolocation.setConfig as jest.Mock).mockClear();
  appStore.setLink({serverUrl: 'https://app.bgeo.dev', linked: true, deviceId: 'dev-1'});
});

test('unlinkDevice clears logUrl the same way it clears url', async () => {
  await AsyncStorage.setItem(
    'bgeo:link',
    JSON.stringify({
      serverUrl: 'https://app.bgeo.dev',
      deviceId: 'dev-1',
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      installUuid: 'uuid-1',
    }),
  );

  await unlinkDevice();

  // Not an omitted key: logUrl must be present in the same setConfig call
  // that clears url, or the engine keeps POSTing this device's logs to the
  // server it just unlinked from, now with the auth block stripped.
  expect(BackgroundGeolocation.setConfig).toHaveBeenCalledWith({
    url: '',
    logUrl: '',
    authorization: undefined,
  });
  expect(await AsyncStorage.getItem('bgeo:link')).toBeNull();
  expect(appStore.getState().link.linked).toBe(false);
  expect(appStore.getState().link.deviceId).toBeNull();
});
