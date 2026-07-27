/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

// The package resolves its TurboModule at import time
// (TurboModuleRegistry.getEnforcing), which does not exist in the jest host —
// mock the whole JS facade.
const subscription = () => ({remove: jest.fn()});
jest.mock('@bgeo/react-native-background-geolocation', () => ({
  __esModule: true,
  default: {
    ready: jest.fn(() => Promise.resolve({enabled: false, odometer: 0})),
    start: jest.fn(() => Promise.resolve({enabled: true})),
    stop: jest.fn(() => Promise.resolve({enabled: false})),
    setConfig: jest.fn(() => Promise.resolve({})),
    getState: jest.fn(() => Promise.resolve({enabled: false})),
    getCount: jest.fn(() => Promise.resolve(0)),
    sync: jest.fn(() => Promise.resolve([])),
    destroyLocations: jest.fn(() => Promise.resolve(0)),
    requestPermission: jest.fn(() => Promise.resolve(3)),
    getCurrentPosition: jest.fn(() =>
      Promise.resolve({coords: {latitude: 0, longitude: 0, accuracy: 1}}),
    ),
    addGeofence: jest.fn(() => Promise.resolve()),
    removeGeofence: jest.fn(() => Promise.resolve()),
    getGeofences: jest.fn(() => Promise.resolve([])),
    onLocation: jest.fn(subscription),
    onMotionChange: jest.fn(subscription),
    onHeartbeat: jest.fn(subscription),
    onProviderChange: jest.fn(subscription),
    onAuthorization: jest.fn(subscription),
    onGeofence: jest.fn(subscription),
    onGeofencesChange: jest.fn(subscription),
    onHttp: jest.fn(subscription),
    onConnectivityChange: jest.fn(subscription),
    logger: {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    },
    getLog: jest.fn(() => Promise.resolve([])),
    destroyLog: jest.fn(() => Promise.resolve(0)),
    uploadLog: jest.fn(() => Promise.resolve(0)),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

// react-native-maps ships untranspiled ESM + native views; render plain Views.
jest.mock('react-native-maps', () => {
  const {View} = require('react-native');
  const MockMapView = (props: any) => <View>{props.children}</View>;
  return {
    __esModule: true,
    default: MockMapView,
    Marker: (props: any) => <View>{props.children}</View>,
    Polyline: () => null,
    Circle: () => null,
    PROVIDER_GOOGLE: 'google',
  };
});

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: {open: jest.fn()},
}));

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
