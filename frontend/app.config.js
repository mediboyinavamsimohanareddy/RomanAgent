module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';

  if (!googleMapsApiKey) {
    console.warn(
      '\x1b[33m%s\x1b[0m',
      '[Google Maps Config Warning] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY is not set in environment variables (.env).\n' +
      'Native Google Maps requires a valid API key configured in .env for map tile rendering on Android and iOS.'
    );
  }

  // Preserve existing plugins from app.json while ensuring react-native-maps plugin is configured
  const existingPlugins = config.plugins || [];
  const hasMapsPlugin = existingPlugins.some(p => 
    (Array.isArray(p) ? p[0] : p) === 'react-native-maps'
  );

  const mapsPluginConfig = [
    'react-native-maps',
    {
      androidGoogleMapsApiKey: googleMapsApiKey,
      iosGoogleMapsApiKey: googleMapsApiKey,
    },
  ];

  const updatedPlugins = hasMapsPlugin
    ? existingPlugins.map(p => ((Array.isArray(p) ? p[0] : p) === 'react-native-maps' ? mapsPluginConfig : p))
    : [...existingPlugins, mapsPluginConfig];

  return {
    ...config,
    android: {
      ...(config.android || {}),
      config: {
        ...(config.android?.config || {}),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    ios: {
      ...(config.ios || {}),
      config: {
        ...(config.ios?.config || {}),
        googleMapsApiKey: googleMapsApiKey,
      },
    },
    plugins: updatedPlugins,
  };
};
