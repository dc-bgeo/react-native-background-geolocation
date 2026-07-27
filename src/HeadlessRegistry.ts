import { AppRegistry, Platform } from 'react-native';

import type { HeadlessTask, HeadlessEvent } from './types';

/**
 * Android headless-task registration (parity with Transistor's
 * `registerHeadlessTask`). The native `HeadlessTaskService` enqueues a
 * `HeadlessJsTaskConfig` named `BackgroundGeolocation` whose data bundle is the
 * event's payload fields flattened alongside a top-level `name`
 * (`{ name, ...payload }`, no `params` wrapper); we forward it to the
 * app-supplied task.
 *
 * `index.js` registers this at module load and keys on `event.name === 'heartbeat'`,
 * so the task data MUST carry a top-level `name`.
 */
const HEADLESS_TASK_NAME = 'BackgroundGeolocation';

let registeredTask: HeadlessTask | null = null;

export function registerHeadlessTask(task: HeadlessTask): void {
  registeredTask = task;

  // iOS has no HeadlessJsTaskService; the task is retained for the BGTask /
  // background-fetch bridge wired in a later phase. Registering on Android only
  // avoids a redbox from AppRegistry on platforms without the native service.
  if (Platform.OS !== 'android') {
    return;
  }

  AppRegistry.registerHeadlessTask(HEADLESS_TASK_NAME, () => async (event: HeadlessEvent) => {
    if (!registeredTask) {
      return;
    }
    await registeredTask(event);
  });
}

export function getRegisteredHeadlessTask(): HeadlessTask | null {
  return registeredTask;
}
