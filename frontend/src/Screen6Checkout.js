import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing, ActivityIndicator } from 'react-native';
import { theme } from './theme';
import { DemoHeader, StatusPill } from './components';

export function Screen6Checkout({ option, onConfirmJourney, language, onToggleLanguage }) {
  const isTe = language === 'te';

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Animation Refs
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const checkmarkScaleAnim = useRef(new Animated.Value(0)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSuccess) {
      // Sequence: Scale in Circle -> Scale in Checkmark -> Fade in Content
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.back(1.5),
          useNativeDriver: true,
        }),
        Animated.timing(checkmarkScaleAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isSuccess]);

  const handleConfirmPayment = async () => {
    if (isProcessing || isSuccess) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Execute payment confirmation via callback
      if (onConfirmJourney) {
        await Promise.resolve(onConfirmJourney(option));
      }
      setIsSuccess(true);
    } catch (err) {
      console.warn('Payment confirmation error:', err);
      setErrorMessage(isTe ? 'చెల్లింపు ప్రక్రియలో విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.' : 'Simulated payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const bookingRef = option?.id ? `RM-${option.id.toString().substring(0, 8).toUpperCase()}` : 'RM-BK89201X';

  if (isSuccess) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.successContent}>
        <View style={styles.animationCard}>
          {/* Animated Circle Container */}
          <Animated.View style={[styles.circleContainer, { transform: [{ scale: scaleAnim }] }]}>
            <Animated.Text style={[styles.checkmarkText, { transform: [{ scale: checkmarkScaleAnim }] }]}>
              ✓
            </Animated.Text>
          </Animated.View>

          {/* Fade in Message & Details */}
          <Animated.View style={[styles.fadeContainer, { opacity: contentFadeAnim }]}>
            <View style={styles.simulatedBadge}>
              <Text style={styles.simulatedBadgeText}>DEMO PAYMENT · SIMULATED</Text>
            </View>

            <Text style={styles.successTitle}>
              {isTe ? 'చెల్లింపు పూర్తయింది!' : 'Payment Successful!'}
            </Text>
            <Text style={styles.successSubtext}>
              {isTe ? 'మీ డెమో బుకింగ్ విజయవంతంగా ధృవీకరించబడింది.' : 'Your demo booking has been confirmed.'}
            </Text>

            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>{isTe ? 'చెల్లించిన మొత్తం' : 'Amount Paid'}</Text>
              <Text style={styles.amountText}>₹{option?.totalFare || '1,450'}</Text>
              <Text style={styles.bookingRefText}>
                {isTe ? 'బుకింగ్ రిఫరెన్స్:' : 'Booking Ref:'} <Text style={styles.bookingRefVal}>{bookingRef}</Text>
              </Text>
            </View>

            <TouchableOpacity style={styles.viewJourneyBtn} onPress={() => onConfirmJourney && onConfirmJourney(option, true)}>
              <Text style={styles.viewJourneyBtnText}>
                {isTe ? 'నా ప్రయాణాన్ని చూడు ➔' : 'View My Journey ➔'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <DemoHeader
        title={isTe ? '6. డెమో చెక్‌అవుట్ & ధృవీకరణ' : '6. Simulated Checkout & Journey Activation'}
        subtitle={isTe ? 'ఉచిత సిమ్యులేషన్ ధృవీకరణ (ఏ విధమైన అసలు రుసుము ఉండదు)' : 'Demonstration Payment Flow (No real cards or transactions)'}
        language={language}
        onToggleLanguage={onToggleLanguage}
      />

      {errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
        </View>
      )}

      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>🛡️ {isTe ? 'సిమ్యులేషన్ నోటీసు' : 'Simulated Checkout Environment'}</Text>
        <Text style={styles.noticeText}>
          {isTe
            ? 'ఈ ప్రక్రియ డెమో ప్రయోజనాల కోసం మాత్రమే. అసలు పేమెంట్ గేట్‌వే లేదా డబ్బు విత్‌డ్రా కావు.'
            : 'Per Architectural Constraint: This screen demonstrates the state machine transition from ITINERARY_SELECTED to DEMO_CONFIRMED.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionHeader}>{isTe ? 'టికెట్ సారాంశం' : 'Trip Summary & Passengers'}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>{isTe ? 'ప్రయాణీకుల సంఖ్య:' : 'Passengers:'}</Text>
          <Text style={styles.val}>1 Adult (Single Berth)</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{isTe ? 'ఎంచుకున్న బస్సు:' : 'Selected Service:'}</Text>
          <Text style={styles.val}>{option.operator}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{isTe ? 'మొత్తం చెల్లించాల్సిన మొత్తం:' : 'Total Amount Due:'}</Text>
          <Text style={styles.fareVal}>₹{option.totalFare}</Text>
        </View>
      </View>

      <View style={styles.paymentMethodCard}>
        <Text style={styles.sectionHeader}>{isTe ? 'సిమ్యులేటెడ్ పేమెంట్ మోడ్' : 'Select Demo Payment Method'}</Text>
        
        <TouchableOpacity style={styles.radioRow}>
          <Text style={styles.radioDot}>🔘</Text>
          <Text style={styles.radioText}>Simulated UPI (RoamPay Demo Wallet)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.radioRow}>
          <Text style={styles.radioDot}>⚪</Text>
          <Text style={styles.radioText}>Demo Credit/Debit Card</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.confirmBtn, isProcessing && styles.btnDisabled]}
        onPress={handleConfirmPayment}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.confirmBtnText}>
            {isTe ? 'సిమ్యులేటెడ్ ప్రయాణాన్ని ప్రారంభించు ➔' : 'Confirm & Start Simulated Journey ➔'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: 30 },
  successContent: { flexGrow: 1, justifyContent: 'center', padding: theme.spacing.md, paddingBottom: 40 },
  noticeBox: {
    backgroundColor: '#F1F5F9',
    margin: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  noticeTitle: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 4 },
  noticeText: { fontSize: 11, color: '#64748B', lineHeight: 16 },
  errorBox: {
    backgroundColor: '#FEF2F2',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: { fontSize: 12, color: '#B91C1C', fontWeight: '600' },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    gap: 12,
  },
  sectionHeader: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: theme.colors.textSecondary },
  val: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  fareVal: { fontSize: 20, fontWeight: '700', color: theme.colors.secondary },
  paymentMethodCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    gap: 12,
  },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  radioDot: { fontSize: 16 },
  radioText: { fontSize: 13, color: theme.colors.textPrimary, fontWeight: '600' },
  confirmBtn: {
    backgroundColor: theme.colors.success,
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  btnDisabled: { opacity: 0.7 },
  confirmBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  
  // Success Animation Card Styles
  animationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.outline,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  circleContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    marginTop: -4,
  },
  fadeContainer: {
    width: '100%',
    alignItems: 'center',
  },
  simulatedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
    marginBottom: 12,
  },
  simulatedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  successSubtext: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  amountCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
  },
  amountLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  amountText: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.primary,
    marginVertical: 4,
  },
  bookingRefText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  bookingRefVal: {
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  viewJourneyBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  viewJourneyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
