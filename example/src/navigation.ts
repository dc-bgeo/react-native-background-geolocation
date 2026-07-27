import type {NativeStackScreenProps} from '@react-navigation/native-stack';

export type RootStackParamList = {
  Tabs: undefined;
  GeofenceForm: {latitude: number; longitude: number; identifier?: string};
};

export type GeofenceFormProps = NativeStackScreenProps<RootStackParamList, 'GeofenceForm'>;
