// Configurazione dinamica di Expo.
// Prende come base app.json e inietta la Google Maps API key per Android
// (obbligatoria per react-native-maps nei build standalone) leggendola da una
// variabile d'ambiente, cosi' la chiave non finisce nel repository.
//
// - In locale: definisci GOOGLE_MAPS_API_KEY in .env.local (serve solo per i
//   dev build; in Expo Go la mappa usa la chiave di Expo).
// - Su EAS: la variabile e' configurata negli Environment del progetto.
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!googleMapsApiKey) {
    return config;
  }

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...(config.android?.config ?? {}),
        googleMaps: {
          ...(config.android?.config?.googleMaps ?? {}),
          apiKey: googleMapsApiKey,
        },
      },
    },
  };
};
