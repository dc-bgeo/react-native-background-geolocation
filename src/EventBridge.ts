import type { EventSubscription } from 'react-native';

import NativeBackgroundGeolocation from './NativeBackgroundGeolocation';

import type { Subscription } from './types';

/**
 * Fans the codegen `EventEmitter<T>` native channels out to the multiple app
 * callbacks the Transistor API allows (e.g. several `onLocation` listeners).
 *
 * Each logical channel is subscribed to the native module exactly once (lazily,
 * on first listener) and dispatches to the registered app callbacks. This lets
 * the facade implement Transistor's `removeListeners()` — which detaches every
 * listener at once — by clearing all sets and tearing down native subscriptions.
 */

type Channel =
  | 'location'
  | 'locationerror'
  | 'providerchange'
  | 'heartbeat'
  | 'motionchange'
  | 'geofence'
  | 'geofenceschange'
  | 'authorization'
  | 'powersavechange'
  | 'http'
  | 'connectivitychange';

// Maps a logical channel to the native emitter subscribe fn (codegen exposes
// each `readonly onX: EventEmitter<T>` as a callable returning EventSubscription).
const NATIVE_SUBSCRIBE: Record<Channel, (listener: (value: any) => void) => EventSubscription> = {
  location: l => NativeBackgroundGeolocation.onLocation(l),
  locationerror: l => NativeBackgroundGeolocation.onLocationError(l),
  providerchange: l => NativeBackgroundGeolocation.onProviderChange(l),
  heartbeat: l => NativeBackgroundGeolocation.onHeartbeat(l),
  motionchange: l => NativeBackgroundGeolocation.onMotionChange(l),
  geofence: l => NativeBackgroundGeolocation.onGeofence(l),
  geofenceschange: l => NativeBackgroundGeolocation.onGeofencesChange(l),
  authorization: l => NativeBackgroundGeolocation.onAuthorization(l),
  powersavechange: l => NativeBackgroundGeolocation.onPowerSaveChange(l),
  http: l => NativeBackgroundGeolocation.onHttp(l),
  connectivitychange: l => NativeBackgroundGeolocation.onConnectivityChange(l),
};

class EventBridgeImpl {
  private listeners: Record<Channel, Set<(value: any) => void>> = {
    location: new Set(),
    locationerror: new Set(),
    providerchange: new Set(),
    heartbeat: new Set(),
    motionchange: new Set(),
    geofence: new Set(),
    geofenceschange: new Set(),
    authorization: new Set(),
    powersavechange: new Set(),
    http: new Set(),
    connectivitychange: new Set(),
  };

  private nativeSubs: Partial<Record<Channel, EventSubscription>> = {};

  on(channel: Channel, callback: (value: any) => void): Subscription {
    const set = this.listeners[channel];
    set.add(callback);

    if (!this.nativeSubs[channel]) {
      this.nativeSubs[channel] = NATIVE_SUBSCRIBE[channel](value => {
        // Snapshot to tolerate listeners that unsubscribe during dispatch.
        for (const cb of Array.from(this.listeners[channel])) {
          try {
            cb(value);
          } catch (err) {
            console.warn(`[BackgroundGeolocation] ${channel} listener threw`, err);
          }
        }
      });
    }

    return {
      remove: () => this.off(channel, callback),
    };
  }

  private off(channel: Channel, callback: (value: any) => void) {
    const set = this.listeners[channel];
    set.delete(callback);
    if (set.size === 0) {
      this.nativeSubs[channel]?.remove();
      delete this.nativeSubs[channel];
    }
  }

  /** Transistor `removeListeners()` semantics: detach everything. */
  removeAll() {
    (Object.keys(this.listeners) as Channel[]).forEach(channel => {
      this.listeners[channel].clear();
      this.nativeSubs[channel]?.remove();
      delete this.nativeSubs[channel];
    });
  }
}

export const EventBridge = new EventBridgeImpl();
