import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
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

// Generate Leaflet HTML for WebView rendering with OpenStreetMap tiles
function generateLeafletHTML(mapData) {
  const { legs, originMarker, destinationMarker, transferMarkers, busCoord, isDisrupted } = mapData;

  const serializedData = JSON.stringify({
    legs,
    originMarker,
    destinationMarker,
    transferMarkers,
    busCoord,
    isDisrupted,
    actionColor: theme.colors.action
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background-color: #0F172A;
    }
    .leaflet-control-attribution {
      font-size: 9px !important;
      background: rgba(255, 255, 255, 0.8) !important;
      padding: 2px 5px !important;
    }
    .custom-div-icon {
      background: transparent;
      border: none;
    }
    .marker-pin {
      width: 24px;
      height: 24px;
      border-radius: 50% 50% 50% 0;
      position: absolute;
      transform: rotate(-45deg);
      left: 50%;
      top: 50%;
      margin: -15px 0 0 -12px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .marker-pin::after {
      content: '';
      width: 10px;
      height: 10px;
      margin: 7px 0 0 7px;
      background: #fff;
      position: absolute;
      border-radius: 50%;
    }
    .pin-green { background: #10B981; }
    .pin-red { background: #EF4444; }
    .pin-orange { background: #F59E0B; }
    .pin-violet { background: #8B5CF6; }
    .pin-disrupted { background: ${theme.colors.action}; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      const data = ${serializedData};
      
      const map = L.map('map', {
        zoomControl: true,
        attributionControl: true
      }).setView([16.8000, 80.8000], 7);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
      }).addTo(map);

      const allBounds = [];

      // Custom marker icon helper
      function createPinIcon(colorClass, emoji) {
        return L.divIcon({
          className: 'custom-div-icon',
          html: '<div class="marker-pin ' + colorClass + '"></div>',
          iconSize: [30, 42],
          iconAnchor: [15, 42],
          popupAnchor: [0, -35]
        });
      }

      // Draw Leg Polylines
      data.legs.forEach(function(l, idx) {
        const coords = [
          [l.originCoord.latitude, l.originCoord.longitude],
          [l.destCoord.latitude, l.destCoord.longitude]
        ];
        allBounds.push(coords[0], coords[1]);

        const legColor = data.isDisrupted && idx === 0 ? data.actionColor : (idx === 0 ? '#0284C7' : '#10B981');
        const dashArray = data.isDisrupted && idx === 0 ? '8, 8' : null;

        L.polyline(coords, {
          color: legColor,
          weight: 5,
          opacity: 0.85,
          dashArray: dashArray
        }).addTo(map);
      });

      // Origin Marker
      if (data.originMarker) {
        const originLat = data.originMarker.coord.latitude;
        const originLng = data.originMarker.coord.longitude;
        L.marker([originLat, originLng], {
          icon: createPinIcon('pin-green')
        }).addTo(map).bindPopup('<b>Origin: ' + data.originMarker.name + '</b><br>Boarding Point');
      }

      // Destination Marker
      if (data.destinationMarker) {
        const destLat = data.destinationMarker.coord.latitude;
        const destLng = data.destinationMarker.coord.longitude;
        L.marker([destLat, destLng], {
          icon: createPinIcon('pin-red')
        }).addTo(map).bindPopup('<b>Destination: ' + data.destinationMarker.name + '</b><br>Final Drop Point');
      }

      // Transfer Markers
      data.transferMarkers.forEach(function(tm) {
        L.marker([tm.coord.latitude, tm.coord.longitude], {
          icon: createPinIcon('pin-orange')
        }).addTo(map).bindPopup('<b>Transfer Terminal: ' + tm.name + '</b><br>Interchange Transfer Point between Leg ' + tm.legIndex + ' & ' + (tm.legIndex + 1));
      });

      // Simulated Bus Marker
      if (data.busCoord) {
        const busLat = data.busCoord.latitude;
        const busLng = data.busCoord.longitude;
        allBounds.push([busLat, busLng]);
        const busPinClass = data.isDisrupted ? 'pin-disrupted' : 'pin-violet';

        L.marker([busLat, busLng], {
          icon: createPinIcon(busPinClass)
        }).addTo(map).bindPopup('<b>🚌 ' + data.busCoord.label + '</b><br>Simulated vehicle position - not live GPS');
      }

      // Fit map camera bounds
      if (allBounds.length > 0) {
        map.fitBounds(allBounds, { padding: [30, 30] });
      }
    })();
  </script>
</body>
</html>
  `;
}

export function InteractiveMapView({ legs = [], highlightedLegIndex = null, isDisrupted = false, simulatedBusLocation = null }) {
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

  const busCoord = resolveSimulatedBusLocation(simulatedBusLocation, processedLegs[0]?.originCoord, processedLegs[0]?.destCoord);

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
  const originMarker = processedLegs[0] ? { coord: processedLegs[0].originCoord, name: processedLegs[0].originName } : null;
  const destinationMarker = processedLegs[processedLegs.length - 1] ? { coord: processedLegs[processedLegs.length - 1].destCoord, name: processedLegs[processedLegs.length - 1].destName } : null;

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

  const leafletHTML = generateLeafletHTML({
    legs: processedLegs,
    originMarker,
    destinationMarker,
    transferMarkers,
    busCoord,
    isDisrupted
  });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.mapTitle}>Route Geometry & Transit Map (OpenStreetMap)</Text>
        <View style={styles.demoBadge}>
          <Text style={styles.demoBadgeText}>Simulated Vehicle Coordinates</Text>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <WebView
          originWhitelist={['*']}
          source={{ html: leafletHTML }}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>🗺️ Loading OpenStreetMap...</Text>
            </View>
          )}
        />
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
  mapContainer: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  map: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
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
