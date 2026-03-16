import React, { useState, useEffect, useRef } from 'react';
import { View, Button, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';

type ParkingMode = 'searching' | 'leaving' | null;

export default function App() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parkingMode, setParkingMode] = useState<ParkingMode>(null);

  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permesso di accesso alla posizione negato');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);

      // Sposta la mappa alla posizione corrente
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          1000 // durata animazione in ms
        );
      }
    })();
  }, []);

  const handleLeaveParkingSpot = () => {
    setParkingMode('leaving');
    alert('Parcheggio lasciato');
  };

  const handleSearchParkingSpot = () => {
    setParkingMode('searching');
    alert('Cerca parcheggio');
  };

  return (
    <View style={styles.container}>
      {location ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="La tua posizione"
          />
        </MapView>
      ) : (
        <Text>{errorMsg || 'Caricamento posizione...'}</Text>
      )}
      <View style={styles.buttonContainer}>
        <Button title="Lascia Parcheggio" onPress={handleLeaveParkingSpot} />
        <Button title="Cerca Parcheggio" onPress={handleSearchParkingSpot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
  },
});