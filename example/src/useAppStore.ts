import {useSyncExternalStore} from 'react';

import {appStore} from './appStore';

export function useAppStore() {
  return useSyncExternalStore(appStore.subscribe, appStore.getState);
}
