/**
 * @format
 */

import {
  appliesToPlatform,
  CONFIG_SECTIONS,
  fieldsForPlatform,
  resolveDefault,
  type ConfigField,
} from '../src/configSchema';

function fieldDefault(key: string): ConfigField['default'] {
  for (const section of CONFIG_SECTIONS) {
    const field = section.fields.find(f => f.key === key);
    if (field) return field.default;
  }
  throw new Error(`field ${key} not found in CONFIG_SECTIONS`);
}

// Guards against the schema's defaults drifting from what the native engines
// actually use — the Settings screen displays these for un-overridden keys,
// and "reset to defaults" pushes them into the engine.
describe('config schema defaults match the engines', () => {
  test('stationaryRadius matches both engines (200 m)', () => {
    expect(resolveDefault(fieldDefault('stationaryRadius'), 'ios')).toBe(200);
    expect(resolveDefault(fieldDefault('stationaryRadius'), 'android')).toBe(200);
  });

  test('httpTimeoutMs matches both engines (30000 ms)', () => {
    expect(resolveDefault(fieldDefault('httpTimeoutMs'), 'ios')).toBe(30000);
    expect(resolveDefault(fieldDefault('httpTimeoutMs'), 'android')).toBe(30000);
  });

  test('maxBatchSize matches both engines (-1, unbatched)', () => {
    expect(resolveDefault(fieldDefault('maxBatchSize'), 'ios')).toBe(-1);
    expect(resolveDefault(fieldDefault('maxBatchSize'), 'android')).toBe(-1);
  });

  // iOS engine default is 50 (BGGeoEngine.mm:1576); Android engine default is
  // 75 (BGGeoEngine.kt:870) — deliberate divergence (iOS's confidence scale is
  // coarse). Each platform now resolves to its OWN engine's literal default.
  test('minimumActivityRecognitionConfidence resolves per platform', () => {
    expect(resolveDefault(fieldDefault('minimumActivityRecognitionConfidence'), 'ios')).toBe(50);
    expect(resolveDefault(fieldDefault('minimumActivityRecognitionConfidence'), 'android')).toBe(75);
  });
});

describe('resolveDefault', () => {
  test('returns the iOS value on ios and the Android value on android for a divergent field', () => {
    const divergent = {ios: 50, android: 75};
    expect(resolveDefault(divergent, 'ios')).toBe(50);
    expect(resolveDefault(divergent, 'android')).toBe(75);
  });

  test('a single-valued default resolves identically on both platforms', () => {
    expect(resolveDefault(200, 'ios')).toBe(200);
    expect(resolveDefault(200, 'android')).toBe(200);
    expect(resolveDefault('BALANCED', 'ios')).toBe('BALANCED');
    expect(resolveDefault('BALANCED', 'android')).toBe('BALANCED');
    expect(resolveDefault(false, 'ios')).toBe(false);
    expect(resolveDefault(false, 'android')).toBe(false);
    expect(resolveDefault(null, 'ios')).toBe(null);
    expect(resolveDefault(null, 'android')).toBe(null);
  });
});

describe('appliesToPlatform / fieldsForPlatform', () => {
  test('an unmarked field applies to both platforms', () => {
    const field: Pick<ConfigField, 'platform'> = {};
    expect(appliesToPlatform(field, 'ios')).toBe(true);
    expect(appliesToPlatform(field, 'android')).toBe(true);
  });

  test('a platform-tagged field applies only to its own platform', () => {
    const iosOnly: Pick<ConfigField, 'platform'> = {platform: 'ios'};
    expect(appliesToPlatform(iosOnly, 'ios')).toBe(true);
    expect(appliesToPlatform(iosOnly, 'android')).toBe(false);
  });

  // Regression guard for the recorded defect: these two keys are read only
  // by the iOS engine (core/ios/Sources/BGGeoEngine.mm:1466/:1827 and :848)
  // and are absent from core/android/engine entirely, so the Settings screen
  // must not offer them on Android.
  test('stationaryDistanceFilter and diagnosticExtras are iOS-only in the resolved field list', () => {
    const iosFields = fieldsForPlatform('ios').map(f => f.key);
    const androidFields = fieldsForPlatform('android').map(f => f.key);
    expect(iosFields).toEqual(expect.arrayContaining(['stationaryDistanceFilter', 'diagnosticExtras']));
    expect(androidFields).not.toEqual(expect.arrayContaining(['stationaryDistanceFilter']));
    expect(androidFields).not.toEqual(expect.arrayContaining(['diagnosticExtras']));
  });

  test('an unmarked field (distanceFilter) is present in the resolved field list on both platforms', () => {
    expect(fieldsForPlatform('ios').map(f => f.key)).toEqual(expect.arrayContaining(['distanceFilter']));
    expect(fieldsForPlatform('android').map(f => f.key)).toEqual(expect.arrayContaining(['distanceFilter']));
  });
});
