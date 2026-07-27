/**
 * @format
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));
jest.mock('@dc-bgeo/react-native-background-geolocation', () => ({
  __esModule: true,
  default: {setConfig: jest.fn(() => Promise.resolve({}))},
}));

import {filterPointsByRange, serverLocationToPoint} from '../src/history';

const p = (timestamp: string) => ({latitude: 1, longitude: 2, timestamp});

test('filterPointsByRange keeps only points inside [from, to]', () => {
  const points = [
    p('2026-07-18T08:00:00.000Z'),
    p('2026-07-18T10:00:00.000Z'),
    p('2026-07-18T12:00:00.000Z'),
  ];
  const got = filterPointsByRange(points, '2026-07-18T09:00:00Z', '2026-07-18T11:00:00Z');
  expect(got.map(x => x.timestamp)).toEqual(['2026-07-18T10:00:00.000Z']);
  // Open-ended bounds.
  expect(filterPointsByRange(points, null, '2026-07-18T09:00:00Z')).toHaveLength(1);
  expect(filterPointsByRange(points, '2026-07-18T09:00:00Z', null)).toHaveLength(2);
  expect(filterPointsByRange(points, null, null)).toHaveLength(3);
});

test('serverLocationToPoint maps the console camelCase shape', () => {
  expect(
    serverLocationToPoint({
      uuid: 'u1',
      recordedAt: '2026-07-18T10:00:00Z',
      lat: 52.5,
      lng: 13.4,
      isMoving: true,
      event: 'geofence',
    }),
  ).toEqual({
    uuid: 'u1',
    timestamp: '2026-07-18T10:00:00Z',
    latitude: 52.5,
    longitude: 13.4,
    isMoving: true,
    event: 'geofence',
  });
});
