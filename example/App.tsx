import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {NavigationContainer, DarkTheme, DefaultTheme} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import BackgroundGeolocation from '@bgeo/react-native-background-geolocation';

import {runManifestCheck} from './licenseE2E';
import {appStore} from './src/appStore';
import {BASE_CONFIG} from './src/configSchema';
import {expandOverrides, loadOverrides} from './src/configStore';
import {persistRotatedTokens, restoreLink} from './src/deviceLink';
import {syncGeofences} from './src/geofences';
import {logEvent} from './src/logUploader';
import type {RootStackParamList} from './src/navigation';
import {LogsScreen} from './src/screens/LogsScreen';
import {GeofenceFormScreen} from './src/screens/GeofenceFormScreen';
import {MapScreen} from './src/screens/MapScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {themeStore, useTheme} from './src/theme';
import MapIcon from './src/assets/map.svg';
import TerminalIcon from './src/assets/apple.terminal.svg';
import GearIcon from './src/assets/gearshape.svg';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICONS: Record<string, React.FC<{width: number; height: number; color: string}>> = {
  Map: MapIcon,
  Logs: TerminalIcon,
  Settings: GearIcon,
};

function Tabs() {
  const {colors} = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: {fontSize: 11, fontWeight: '600'},
        tabBarIcon: ({color}) => {
          const Icon = TAB_ICONS[route.name];
          return <Icon width={24} height={22} color={color} />;
        },
      })}>
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Logs" component={LogsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App(): React.JSX.Element {
  const {scheme, colors} = useTheme();

  useEffect(() => {
    themeStore.hydrate().catch(() => null);
  }, []);

  useEffect(() => {
    const subs = [
      BackgroundGeolocation.onLocation((location: any) => {
        const c = location?.coords;
        if (c?.latitude != null) {
          appStore.appendPoint({
            uuid: location?.uuid,
            latitude: c.latitude,
            longitude: c.longitude,
            timestamp: location?.timestamp ?? new Date().toISOString(),
            accuracy: c.accuracy,
            speed: c.speed,
            heading: c.heading,
            odometer: location?.odometer,
            activity: location?.activity?.type,
            isMoving: location?.is_moving,
            event: location?.event,
          });
          appStore.setStatus({
            isMoving: Boolean(location?.is_moving),
            batteryLevel: location?.battery?.level ?? null,
          });
        }
        logEvent('onLocation', `${c?.latitude?.toFixed(6)}, ${c?.longitude?.toFixed(6)} ±${c?.accuracy}m`, {
          lat: c?.latitude,
          lng: c?.longitude,
          accuracy: c?.accuracy,
          isMoving: location?.is_moving,
          extras: location?.extras,
        }, 'debug');
      }),
      BackgroundGeolocation.onMotionChange((event: any) => {
        appStore.setStatus({isMoving: Boolean(event?.isMoving)});
        logEvent('onMotionChange', `isMoving=${event?.isMoving}`, undefined, 'info');
      }),
      BackgroundGeolocation.onHeartbeat(() => {
        logEvent('onHeartbeat', undefined, undefined, 'debug');
      }),
      BackgroundGeolocation.onProviderChange((event: any) => {
        logEvent('onProviderChange', `status=${event?.status}`, event, 'warn');
      }),
      BackgroundGeolocation.onAuthorization((event: any) => {
        logEvent('onAuthorization', event?.success ? 'refreshed' : 'failed', event,
          event?.success ? 'info' : 'error');
        void persistRotatedTokens(event?.response ?? event);
      }),
      BackgroundGeolocation.onGeofence((event: any) => {
        logEvent('onGeofence', `${event?.action} ${event?.identifier}`, event, 'info');
        // Geofence transitions don't ride onLocation — append the point here so
        // the map and the coordinates table show them (same as the web console).
        const gc = event?.location?.coords;
        if (gc?.latitude != null) {
          appStore.appendPoint({
            uuid: event?.location?.uuid,
            latitude: gc.latitude,
            longitude: gc.longitude,
            timestamp: event?.location?.timestamp ?? new Date().toISOString(),
            accuracy: gc.accuracy,
            speed: gc.speed,
            heading: gc.heading,
            odometer: event?.location?.odometer,
            activity: event?.location?.activity?.type,
            isMoving: event?.location?.is_moving,
            event: 'geofence',
            geofence: {identifier: event?.identifier, action: event?.action},
          });
        }
      }),
      BackgroundGeolocation.onGeofencesChange((event: any) => {
        logEvent('onGeofencesChange',
          `on=${event?.on?.length ?? 0} off=${event?.off?.length ?? 0}`, undefined, 'debug');
        void syncGeofences();
      }),
      BackgroundGeolocation.onHttp((event: any) => {
        logEvent('onHttp', `${event?.status} ${event?.success ? 'ok' : 'fail'}`, event,
          event?.success ? 'debug' : 'warn');
      }),
      BackgroundGeolocation.onConnectivityChange((event: any) => {
        logEvent('onConnectivityChange', `connected=${event?.connected}`, event,
          event?.connected ? 'info' : 'warn');
      }),
    ];

    // Confirm the manifest license is read + the gate passes (logs [MANIFEST]),
    // restore a previous console link, then bring the engine up with the base
    // config merged with the user's persisted Settings overrides.
    runManifestCheck(line => logEvent('manifest', line, undefined, 'info'))
      .catch((e: any) => logEvent('manifest', e?.message ?? String(e), undefined, 'error'))
      .then(() => restoreLink())
      .catch(() => null)
      .then(() => loadOverrides())
      .then(overrides => BackgroundGeolocation.ready({...BASE_CONFIG, ...expandOverrides(overrides)}))
      .then((state: any) => {
        appStore.setStatus({ready: true, enabled: Boolean(state?.enabled)});
        logEvent('ready', `enabled=${state?.enabled} odometer=${state?.odometer}`, undefined, 'info');
        return syncGeofences();
      })
      .catch((e: any) => logEvent('ready', e?.message ?? String(e), undefined, 'error'));

    return () => subs.forEach(sub => sub.remove());
  }, []);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator>
          <Stack.Screen name="Tabs" component={Tabs} options={{headerShown: false}} />
          <Stack.Screen
            name="GeofenceForm"
            component={GeofenceFormScreen}
            options={{
              presentation: 'modal',
              title: 'Geofence',
              headerStyle: {backgroundColor: colors.surface},
              headerTintColor: colors.text,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
