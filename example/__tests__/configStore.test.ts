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
jest.mock('@bgeo/react-native-background-geolocation', () => ({
  __esModule: true,
  default: {setConfig: jest.fn(() => Promise.resolve({}))},
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundGeolocation from '@bgeo/react-native-background-geolocation';

import {applyOverride, expandOverrides, loadOverrides, resetOverrides} from '../src/configStore';
import {BASE_CONFIG} from '../src/configSchema';

const DEFAULT_NOTIFICATION = {
  title: 'Location',
  text: 'Location tracking active',
  channelId: 'bgeo_location_min',
  channelName: 'Location',
  smallIcon: '',
  color: '',
  priority: -2,
};

beforeEach(async () => {
  await AsyncStorage.clear();
  (BackgroundGeolocation.setConfig as jest.Mock).mockClear();
});

test('applyOverride applies via setConfig and persists across loads', async () => {
  await applyOverride('distanceFilter', 25);
  expect(BackgroundGeolocation.setConfig).toHaveBeenCalledWith({distanceFilter: 25});
  expect(await loadOverrides()).toEqual({distanceFilter: 25});
  await applyOverride('debug', false);
  expect(await loadOverrides()).toEqual({distanceFilter: 25, debug: false});
});

test('resetOverrides restores defaults for overridden keys and clears storage', async () => {
  await applyOverride('distanceFilter', 99);
  await resetOverrides();
  expect(BackgroundGeolocation.setConfig).toHaveBeenLastCalledWith({
    distanceFilter: BASE_CONFIG.distanceFilter,
  });
  expect(await loadOverrides()).toEqual({});
});

test('applyOverride on a dot-path key rebuilds the full nested object from the schema', async () => {
  await applyOverride('notification.priority', 1);
  expect(BackgroundGeolocation.setConfig).toHaveBeenLastCalledWith({
    notification: {...DEFAULT_NOTIFICATION, priority: 1},
  });
});

test('applyOverride on a sibling dot-path key preserves earlier dot-path overrides', async () => {
  await applyOverride('notification.priority', 1);
  await applyOverride('notification.title', 'X');
  expect(BackgroundGeolocation.setConfig).toHaveBeenLastCalledWith({
    notification: {...DEFAULT_NOTIFICATION, priority: 1, title: 'X'},
  });
});

test('resetOverrides on a dot-path key resets the full default nested object', async () => {
  await applyOverride('notification.title', 'X');
  await resetOverrides();
  expect(BackgroundGeolocation.setConfig).toHaveBeenLastCalledWith({
    notification: DEFAULT_NOTIFICATION,
  });
  expect(await loadOverrides()).toEqual({});
});

test('expandOverrides nests dot-path keys schema-complete and leaves plain keys flat', () => {
  expect(
    expandOverrides({
      distanceFilter: 5,
      'notification.title': 'X',
      'notification.priority': 1,
    }),
  ).toEqual({
    distanceFilter: 5,
    notification: {...DEFAULT_NOTIFICATION, title: 'X', priority: 1},
  });
});
