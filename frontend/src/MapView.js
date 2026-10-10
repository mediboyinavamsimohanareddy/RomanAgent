import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { MOCK_STOPS, MOCK_CITIES } from './mockData';
import { theme } from './theme';

// Helper to resolve coordinates for stops or city names
function resolveCoordinates(stopOrCity) {
  if (!stopOrCity) return null;

  // Direct lat/lng on object
  if (typeof stopOrCity.lat === 'number' && typeof stopOrCity.lng === 'number') {
    return { latitude: stopOrCity.lat, longitude: stopOrCity.lng };
  }
  if (typeof stopOrCity.latitude === 'number' && typeof stopOrCity.longitude === 'number') {
    return { latitude: stopOrCity.latitude, longitude: stopOrCity.longitude };
  }

  const searchName = (typeof stopOrCity === 'string' ? stopOrCity : stopOrCity.name || stopOrCity.city || '').trim().toLowerCase();
  if (!searchName) return null;

  // Search in MOCK_STOPS
  for (const stopKey of Object.keys(MOCK_STOPS)) {
    const s = MOCK_STOPS[stopKey];
    if (
      s.name.toLowerCase().includes(searchName) ||
      s.city.toLowerCase().includes(searchName) ||
      (s.aliases && s.aliases.some(a => a.toLowerCase().includes(searchName)))
    ) {
      return { latitude: s.lat, longitude: s.lng };
    }
  }

  // Search in MOCK_CITIES
  for (const c of MOCK_CITIES) {
    if (
      c.city_name.toLowerCase().includes(searchName) ||
      (c.aliases && c.aliases.some(a => a.toLowerCase().includes(searchName)))
    ) {
      return { latitude: c.latitude, longitude: c.longitude };
    }
  }

  return null;
}

// Convert simulated location props (supports lat/lng or SVG x/y conversion)
function resolveSimulatedBusLocation(simulatedBusLocation, originCoord, destCoord) {
  if (!simulatedBusLocation) return null;

  if (typeof simulatedBusLocation.latitude === 'number' && typeof simulatedBusLocation.longitude === 'number') {
    return {
      latitude: simulatedBusLocation.latitude,
      longitude: simulatedBusLocation.longitude,
      label: simulatedBusLocation.label || 'Simulated Bus'
    };
  }

  if (typeof simulatedBusLocation.lat === 'number' && typeof simulatedBusLocation.lng === 'number') {
    return {
      latitude: simulatedBusLocation.lat,
      longitude: simulatedBusLocation.lng,
      label: simulatedBusLocation.label || 'Simulated Bus'
    };
  }

  // Fallback conversion for legacy x/y SVG coordinates mapping to Vizag -> Vijayawada corridor
  if (typeof simulatedBusLocation.x === 'number') {
    if (simulatedBusLocation.x >= 140) {
      // Near Vijayawada PNBS
      return { latitude: 16.5100, longitude: 80.6400, label: 'Bus A (Vijayawada Area)' };
    } else {
      // Mid-route near Eluru / Rajahmundry
      return { latitude: 16.8500, longitude: 81.2000, label: 'Bus A (En Route)' };
    }
  }

  return null;
}

export function InteractiveMapView({ legs = [], highlightedLegIndex = null, isDisrupted = false, simulatedBusLocation = null }) {
  const mapRef = useRef(null);
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  // Process coordinates for each leg
  const processedLegs = legs.map((leg, index) => {
    const originCoord = resolveCoordinates(leg.originStop) || resolveCoordinates(leg.fromCity) || resolveCoordinates(leg.origin);
    const destCoord = resolveCoordinates(leg.destStop) || resolveCoordinates(leg.toCity) || resolveCoordinates(leg.destination);

    return {
      leg,
      index,
      originCoord,
      destCoord,
      originName: leg.originStop?.name || leg.fromCity || leg.origin || `Origin ${index + 1}`,
      destName: leg.destStop?.name || leg.toCity || leg.destination || `Destination ${index + 1}`
    };
  }).filter(l => l.originCoord && l.destCoord);

  // Extract all route coordinates for map camera bounding region
  const allRouteCoords = [];
  processedLegs.forEach(l => {
    allRouteCoords.push(l.originCoord);
    allRouteCoords.push(l.destCoord);
  });

  const busCoord = resolveSimulatedBusLocation(simulatedBusLocation, processedLegs[0]?.originCoord, processedLegs[0]?.destCoord);
  if (busCoord) {
    allRouteCoords.push({ latitude: busCoord.latitude, longitude: busCoord.longitude });
  }

  // Calculate bounding region
  let initialRegion = {
    latitude: 16.8000,
    longitude: 80.8000,
    latitudeDelta: 3.5,
    longitudeDelta: 3.5,
  };

  if (allRouteCoords.length > 0) {
    const lats = allRouteCoords.map(c => c.latitude);
    const lngs = allRouteCoords.map(c => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    initialRegion = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.4),
      longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.4),
    };
  }

  // Frame route when map mounts or coordinates change
  useEffect(() => {
    if (mapRef.current && allRouteCoords.length > 0 && Platform.OS !== 'web') {
      try {
        mapRef.current.fitToCoordinates(allRouteCoords, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
        });
      } catch (err) {
        // Fallback handled by initialRegion
      }
    }
  }, [allRouteCoords.length, isDisrupted]);

  // Web platform fallback notice
  if (Platform.OS === 'web') {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.mapTitle}>Route Geometry & Transit Map</Text>
          <View style={styles.demoBadge}>
            <Text style={styles.demoBadgeText}>Simulated Bus Coordinates</Text>
          </View>
        </View>
        <View style={styles.webFallbackContainer}>
          <Text style={styles.webFallbackTitle}>🗺️ Google Maps Native View</Text>
          <Text style={styles.webFallbackText}>
            Native Google Maps (PROVIDER_GOOGLE) is configured for Android and iOS builds.
          </Text>
          {processedLegs.map((l, i) => (
            <Text key={i} style={styles.webFallbackLeg}>
              Leg {i + 1}: {l.originName} ➔ {l.destName}
            </Text>
          ))}
          {busCoord && (
            <Text style={styles.simulatedNote}>
              🚌 Vehicle Position: {busCoord.label} (Simulated coordinates: {busCoord.latitude.toFixed(4)}, {busCoord.longitude.toFixed(4)})
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Error state: Missing route coordinates contract
  if (processedLegs.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.mapTitle}>Route Geometry & Transit Map</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Missing Route Coordinates Data Contract</Text>
          <Text style={styles.errorText}>
            Unable to resolve stop latitude/longitude coordinates for the selected itinerary legs. Ensure backend or mock legs supply valid stop objects with lat/lng values.
          </Text>
        </View>
      </View>
    );
  }

  // Determine origin, destination, and transfer stops
  const originMarker = processedLegs[0]?.originCoord;
  const originName = processedLegs[0]?.originName;

  const destinationMarker = processedLegs[processedLegs.length - 1]?.destCoord;
  const destinationName = processedLegs[processedLegs.length - 1]?.destName;

  const transferMarkers = [];
  if (processedLegs.length > 1) {
    for (let i = 0; i < processedLegs.length - 1; i++) {
      transferMarkers.push({
        coord: processedLegs[i].destCoord,
        name: processedLegs[i].destName,
        legIndex: i + 1,
      });
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.mapTitle}>Route Geometry & Transit Map</Text>
        <View style={styles.demoBadge}>
          <Text style={styles.demoBadgeText}>Simulated Vehicle Coordinates</Text>
        </View>
      </View>

      {!apiKey && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️ GOOGLE_MAPS_API_KEY is not set in .env. Configure your key for native map tile rendering.
          </Text>
        </View>
      )}

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={false}
          showsCompass={true}
          showsScale={true}
        >
          {/* Render Leg Polylines */}
          {processedLegs.map((l, idx) => {
            const isHighlighted = highlightedLegIndex === idx;
            const legColor = isDisrupted && idx === 0 ? theme.colors.action : idx === 0 ? '#0284C7' : '#10B981';

            return (
              <Polyline
                key={`polyline-leg-${idx}`}
                coordinates={[l.originCoord, l.destCoord]}
                strokeColor={legColor}
                strokeWidth={isHighlighted || isDisrupted ? 5 : 4}
                lineDashPattern={isDisrupted && idx === 0 ? [8, 4] : null}
              />
            );
          })}

          {/* Origin Marker */}
          {originMarker && (
            <Marker
              coordinate={originMarker}
              title={`Origin: ${originName}`}
              description="Boarding Stop"
              pinColor="green"
            />
          )}

          {/* Destination Marker */}
          {destinationMarker && (
            <Marker
              coordinate={destinationMarker}
              title={`Destination: ${destinationName}`}
              description="Final Drop Point"
              pinColor="red"
            />
          )}

          {/* Transfer Stop Markers */}
          {transferMarkers.map((tm, idx) => (
            <Marker
              key={`transfer-${idx}`}
              coordinate={tm.coord}
              title={`Transfer Stop: ${tm.name}`}
              description={`Interchange Transfer Point between Leg ${tm.legIndex} & ${tm.legIndex + 1}`}
              pinColor="orange"
            />
          ))}

          {/* Simulated Vehicle Marker */}
          {busCoord && (
            <Marker
              coordinate={{ latitude: busCoord.latitude, longitude: busCoord.longitude }}
              title="🚌 Simulated Bus Location"
              description={`${busCoord.label} (Simulated vehicle position - not live GPS)`}
              pinColor="violet"
            />
          )}
        </MapView>
      </View>

      {/* Map Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
          <Text style={styles.legendText}>Leg 1</Text>
        </View>
        {processedLegs.length > 1 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Leg 2</Text>
          </View>
        )}
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: isDisrupted ? theme.colors.action : '#8B5CF6' }]} />
          <Text style={styles.legendText}>Simulated Bus</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    marginBottom: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mapTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  demoBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  demoBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  warningBanner: {
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '500',
  },
  mapContainer: {
    height: 210,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  webFallbackContainer: {
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 12,
    minHeight: 160,
  },
  webFallbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
    marginBottom: 6,
  },
  webFallbackText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 10,
  },
  webFallbackLeg: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 4,
  },
  simulatedNote: {
    fontSize: 11,
    color: '#F59E0B',
    marginTop: 6,
    fontStyle: 'italic',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 11,
    color: '#B91C1C',
    lineHeight: 16,
  },
});
