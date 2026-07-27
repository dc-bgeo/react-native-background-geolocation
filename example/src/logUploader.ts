/** Single log pipeline: logEvent() writes the structured line into the app
 * store (Console screen) AND into the module's native log queue (src:"js"),
 * which persists it in bgeo.db and uploads batches to /device/logs with the
 * engine's own auth — surviving app kills, unlike the old JS buffer. */

import BackgroundGeolocation from '@bgeo/react-native-background-geolocation';

import {appStore, type LogLevel} from './appStore';

const LEVELS: Record<LogLevel, (message: string, data?: object) => void> = {
  error: BackgroundGeolocation.logger.error,
  warn: BackgroundGeolocation.logger.warn,
  info: BackgroundGeolocation.logger.info,
  debug: BackgroundGeolocation.logger.debug,
  verbose: BackgroundGeolocation.logger.verbose,
};

export function logEvent(event: string, message: string | undefined, data: unknown, level: LogLevel) {
  const line = {ts: new Date().toISOString(), level, event, message, data};
  appStore.appendLog(line);
  const write = LEVELS[level] ?? BackgroundGeolocation.logger.info;
  write(message ?? event, {event, ...(data !== undefined ? {data} : {})});
}
