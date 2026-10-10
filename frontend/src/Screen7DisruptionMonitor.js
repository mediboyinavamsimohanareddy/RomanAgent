import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { theme } from './theme';
import { DemoHeader, StatusPill } from './components';
import { InteractiveMapView } from './MapView';

export function Screen7DisruptionMonitor({ option, disruption, TriggerDelay, onStartRecovery, language, onToggleLanguage }) {
  const isTe = language === 'te';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <DemoHeader
        title={isTe ? '7. ప్రయాణ పర్యవేక్షణ & ఆటంకాలు' : '7. Live Journey Monitor & Risk Engine'}
        subtitle={isTe ? 'కనెక్టింగ్ సమయాల ప్రమాదాన్ని గుర్తించుట' : 'Deterministic Simulation Event Engine & Delay Threshold Analysis'}
        language={language}
        onToggleLanguage={onToggleLanguage}
      />

      {/* Disruption Alert Banner (Orange Ember Action Style) */}
      {disruption && disruption.isAtRisk ? (
        <View style={styles.alertBanner}>
          <View style={styles.alertHeaderRow}>
            <Text style={styles.alertTitle}>🚨 {isTe ? 'కనెక్షన్ ప్రమాదంలో ఉంది!' : 'CONNECTION AT RISK ALERT'}</Text>
            <StatusPill type="WARNING" label={isTe ? 'ఆలస్యం: 50 ని' : 'DELAY: +50 MINS'} />
          </View>
          <Text style={styles.alertBody}>
            {isTe ? disruption.impactSummaryTe : disruption.impactSummaryEn}
          </Text>
        </View>
      ) : (
        <View style={styles.normalBanner}>
          <Text style={styles.normalTitle}>✅ {isTe ? 'ప్రయాణం సాఫీగా సాగుతోంది' : 'Journey Progressing On-Time'}</Text>
          <Text style={styles.normalBody}>
            {isTe ? 'బస్సు అనుకున్న సమయానికి నడుస్తోంది.' : 'Bus A is currently adhering to scheduled timetables.'}
          </Text>
        </View>
      )}

      {/* Embedded Map with Disruption Bus Pin */}
      <View style={styles.mapPadding}>
        <InteractiveMapView
          legs={option.legs}
          isDisrupted={disruption && disruption.isAtRisk}
          simulatedBusLocation={
            disruption && disruption.isAtRisk
              ? { latitude: 16.5100, longitude: 80.6400, label: isTe ? 'బస్సు A (విజయవాడ వద్ద ఆలస్యం)' : 'Bus A (Delayed +50m at Vijayawada)' }
              : { latitude: 17.2000, longitude: 82.2000, label: isTe ? 'బస్సు A (సాఫీగా సాగుతోంది)' : 'Bus A (En Route On-Time)' }
          }
        />
      </View>

      {/* Realtime Buffer Metric Metrics Diff Box */}
      {disruption && disruption.isAtRisk && (
        <View style={styles.metricDiffCard}>
          <Text style={styles.metricHeader}>{isTe ? 'విజయవాడ బదిలీ సమయ లెక్కింపు' : 'Vijayawada Interchange Buffer Math'}</Text>
          
          <View style={styles.diffRow}>
            <View style={styles.diffCol}>
              <Text style={styles.diffLabel}>{isTe ? 'ప్రణాళిక సమయం' : 'Planned Arrival'}</Text>
              <Text style={styles.oldVal}>02:40 AM</Text>
            </View>
            <Text style={styles.arrow}>➔</Text>
            <View style={styles.diffCol}>
              <Text style={styles.diffLabel}>{isTe ? 'సవరించిన సమయం' : 'Projected Arrival'}</Text>
              <Text style={styles.newVal}>03:30 AM (+50m)</Text>
            </View>
          </View>

          <View style={styles.diffRow}>
            <View style={styles.diffCol}>
              <Text style={styles.diffLabel}>{isTe ? 'మిగిలిన సమయం' : 'Remaining Buffer'}</Text>
              <Text style={styles.dangerVal}>{disruption.remainingBufferMinutes} Mins</Text>
            </View>
            <View style={styles.diffCol}>
              <Text style={styles.diffLabel}>{isTe ? 'కనీస అవసరం' : 'Min Required Buffer'}</Text>
              <Text style={styles.safeVal}>{disruption.requiredBufferMinutes} Mins</Text>
            </View>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.btnStack}>
        {!disruption || !disruption.isAtRisk ? (
          <TouchableOpacity style={styles.triggerBtn} onPress={TriggerDelay}>
            <Text style={styles.triggerBtnText}>
              ⚡ {isTe ? 'సిమ్యులేటెడ్ 50 నిమిషాల ఆలస్యం ప్రారంభించు' : 'Trigger Predefined 50-Min Delay Scenario'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.recoveryBtn} onPress={onStartRecovery}>
            <Text style={styles.recoveryBtnText}>
              🛠️ {isTe ? 'మరొక ప్రయాణ మార్గాన్ని వెతుకు ➔' : 'Find Recovery Proposals ➔'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: 30 },
  alertBanner: {
    backgroundColor: '#FFF7ED',
    margin: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1.5,
    borderColor: '#FED7AA',
  },
  alertHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  alertTitle: { fontSize: 13, fontWeight: '700', color: '#C2410C' },
  alertBody: { fontSize: 12, color: '#EA580C', lineHeight: 18, fontWeight: '500' },
  normalBanner: {
    backgroundColor: '#DCFCE7',
    margin: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  normalTitle: { fontSize: 14, fontWeight: '700', color: '#15803D' },
  normalBody: { fontSize: 12, color: '#166534', marginTop: 2 },
  mapPadding: { paddingHorizontal: theme.spacing.md },
  metricDiffCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    gap: 12,
  },
  metricHeader: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  diffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 10, borderRadius: theme.radius.md },
  diffCol: { alignItems: 'center', flex: 1 },
  diffLabel: { fontSize: 10, color: theme.colors.textMuted },
  oldVal: { fontSize: 13, textDecorationLine: 'line-through', color: theme.colors.textMuted },
  newVal: { fontSize: 13, fontWeight: '700', color: theme.colors.action },
  dangerVal: { fontSize: 16, fontWeight: '700', color: theme.colors.error },
  safeVal: { fontSize: 16, fontWeight: '700', color: theme.colors.success },
  arrow: { fontSize: 16, color: theme.colors.textMuted },
  btnStack: { marginHorizontal: theme.spacing.md, marginTop: theme.spacing.md },
  triggerBtn: {
    backgroundColor: theme.colors.action,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  triggerBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  recoveryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  recoveryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' }
});
