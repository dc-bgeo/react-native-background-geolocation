/**
 * @format
 */

import {CONFIG_SECTIONS} from '../src/configSchema';

function fieldDefault(key: string): unknown {
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
    expect(fieldDefault('stationaryRadius')).toBe(200);
  });

  test('httpTimeoutMs matches both engines (30000 ms)', () => {
    expect(fieldDefault('httpTimeoutMs')).toBe(30000);
  });

  test('maxBatchSize matches both engines (-1, unbatched)', () => {
    expect(fieldDefault('maxBatchSize')).toBe(-1);
  });

  // iOS engine default is 50; Android engine default is 75 (deliberate
  // divergence — see BGGeoEngine.mm's comment on the coarse iOS confidence
  // scale). This schema has no per-platform default mechanism, so it uses
  // iOS's value here — see the parity report for the full discussion.
  test('minimumActivityRecognitionConfidence matches the iOS engine default (50)', () => {
    expect(fieldDefault('minimumActivityRecognitionConfidence')).toBe(50);
  });
});
