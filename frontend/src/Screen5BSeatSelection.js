import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { theme } from './theme';
import { DemoHeader, StatusPill } from './components';
import { fetchSeatLayout, createSeatHold } from './services/api';

export function Screen5BSeatSelection({
  option,
  legIndex = 0,
  onProceedToCheckout,
  language,
  onToggleLanguage
}) {
  const isTe = language === 'te';

  const currentLeg = option?.legs ? option.legs[legIndex] || option.legs[0] : null;
  const busServiceId = currentLeg?.busServiceId || currentLeg?.serviceNumber || 'c1111111-1111-1111-1111-111111111111';

  const [isLoading, setIsLoading] = useState(true);
  const [layoutData, setLayoutData] = useState(null);
  const [activeDeck, setActiveDeck] = useState('LOWER');
  const [selectedSeatNos, setSelectedSeatNos] = useState([]);
  const [passengerCount, setPassengerCount] = useState(1);
  const [passengers, setPassengers] = useState([
    { seatNumber: '', fullName: 'Vamsi Mohan', gender: 'Male', age: 24 }
  ]);
  const [isSubmittingHold, setIsSubmittingHold] = useState(false);

  useEffect(() => {
    loadSeats();
  }, [busServiceId]);

  async function loadSeats() {
    setIsLoading(true);
    try {
      const res = await fetchSeatLayout(busServiceId);
      if (res && res.data) {
        setLayoutData(res.data);
      }
    } catch (err) {
      console.warn('Error loading seat layout:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Update passenger input entries whenever selected seats change
  const handleSeatToggle = (seat) => {
    if (seat.status === 'BOOKED' || seat.status === 'HELD') {
      return; // Not selectable
    }

    const seatNo = seat.seatNumber;

    if (selectedSeatNos.includes(seatNo)) {
      // Unselect seat
      const nextSeats = selectedSeatNos.filter(s => s !== seatNo);
      setSelectedSeatNos(nextSeats);
      syncPassengers(nextSeats, passengerCount);
    } else {
      // Allow adding seats up to maximum vehicle limit (or e.g. 10). Auto-sync passenger count if seat count exceeds current passenger count!
      const nextSeats = [...selectedSeatNos, seatNo];
      const newPassengerCount = Math.max(passengerCount, nextSeats.length);
      setPassengerCount(newPassengerCount);
      setSelectedSeatNos(nextSeats);
      syncPassengers(nextSeats, newPassengerCount);
    }
  };

  const syncPassengers = (seatNos, count) => {
    const targetCount = Math.max(count || 1, seatNos.length);
    const updated = [];
    for (let idx = 0; idx < targetCount; idx++) {
      const seatNo = seatNos[idx] || '';
      const existing = passengers[idx];
      updated.push({
        seatNumber: seatNo,
        fullName: existing?.fullName || `Passenger ${idx + 1}`,
        gender: existing?.gender || 'Male',
        age: existing?.age || 25
      });
    }
    setPassengers(updated);
  };

  const handlePassengerCountChange = (delta) => {
    const newCount = Math.max(1, Math.min(10, passengerCount + delta));
    setPassengerCount(newCount);
    if (selectedSeatNos.length > newCount) {
      const trimmed = selectedSeatNos.slice(0, newCount);
      setSelectedSeatNos(trimmed);
      syncPassengers(trimmed, newCount);
    } else {
      syncPassengers(selectedSeatNos, newCount);
    }
  };

  const handlePassengerInfoChange = (index, field, value) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  const calculateTotalFare = () => {
    if (!layoutData || selectedSeatNos.length === 0) return 0;
    const base = layoutData.baseFare || 700;
    let extraSum = 0;
    layoutData.seats.forEach(s => {
      if (selectedSeatNos.includes(s.seatNumber)) {
        extraSum += s.extraFare || 0;
      }
    });
    return (base * selectedSeatNos.length) + extraSum;
  };

  const handleProceed = async () => {
    if (selectedSeatNos.length === 0) {
      Alert.alert(
        isTe ? 'సీటును ఎంచుకోండి' : 'Select Seat',
        isTe ? 'దయచేసి ముందుకు వెళ్ళడానికి కనీసం ఒక సీటును ఎంచుకోండి.' : 'Please select at least one seat to proceed.'
      );
      return;
    }

    if (selectedSeatNos.length !== passengerCount) {
      Alert.alert(
        isTe ? 'ప్రయాణీకుల వివరాలు' : 'Passenger Seats Mismatch',
        isTe ? `దయచేసి ఎంచుకున్న ${selectedSeatNos.length} సీట్లకు అనుగుణంగా ${passengerCount} ప్రయాణీకుల సంఖ్యను సరిచూడండి.` : `You have selected ${selectedSeatNos.length} seat(s) for ${passengerCount} passenger(s). Please align the number of selected seats and passengers.`
      );
      return;
    }

    setIsSubmittingHold(true);
    try {
      const date = layoutData?.departureDate || new Date().toISOString().split('T')[0];
      const holdRes = await createSeatHold(busServiceId, date, selectedSeatNos, passengerCount);

      const bookingPayload = {
        ...option,
        selectedSeats: selectedSeatNos,
        totalFare: calculateTotalFare() || option.totalFare,
        passengers,
        holdToken: holdRes?.data?.holdToken || `hold-${Date.now()}`,
        busServiceId,
        departureDate: date
      };

      onProceedToCheckout(bookingPayload);
    } catch (err) {
      console.warn('Seat hold failed:', err);
      Alert.alert('Hold Failed', 'Unable to reserve selected seats. They might have been taken.');
    } finally {
      setIsSubmittingHold(false);
    }
  };

  // Filter seats by active deck (LOWER / UPPER)
  const currentDeckSeats = layoutData?.seats?.filter(s => (s.deck || 'LOWER') === activeDeck) || [];

  // Group seats by row for grid display
  const rowsMap = {};
  currentDeckSeats.forEach(seat => {
    const r = seat.rowNum || 1;
    if (!rowsMap[r]) rowsMap[r] = [];
    rowsMap[r].push(seat);
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <DemoHeader
        title={isTe ? '5B. బస్సు సీట్ల ఎంపిక' : '5B. Bus Seat Selection'}
        subtitle={isTe ? 'ఇంటరాక్టివ్ లేఅవుట్ నుండి మీ సీటును ఎంచుకోండి' : 'Interactive Seat Layout & Realtime Hold Reservation'}
        language={language}
        onToggleLanguage={onToggleLanguage}
      />

      {/* Bus & Journey Banner */}
      <View style={styles.bannerCard}>
        <View style={styles.bannerHeaderRow}>
          <Text style={styles.operatorTitle}>
            🚌 {layoutData?.operatorName || currentLeg?.operator?.name || 'APSRTC Express'}
          </Text>
          <StatusPill type="ACTIVE" label={layoutData?.coachType || currentLeg?.coachType || 'AC Seater'} />
        </View>

        <Text style={styles.routeSubtitle}>
          {currentLeg?.fromCity || currentLeg?.originStop?.name || 'Visakhapatnam'} ➔ {currentLeg?.toCity || currentLeg?.destStop?.name || 'Hyderabad'}
        </Text>

        <View style={styles.timeMetaRow}>
          <Text style={styles.timeMetaText}>
            ⏰ Departure: <Text style={styles.timeHighlight}>{currentLeg?.departureTime || '20:00'}</Text>
          </Text>
          <Text style={styles.timeMetaText}>
            📅 Date: <Text style={styles.timeHighlight}>{layoutData?.departureDate || 'Today'}</Text>
          </Text>
        </View>
      </View>

      {/* Passenger Count Selector Bar */}
      <View style={styles.passengerCountCard}>
        <Text style={styles.passengerLabel}>
          👥 {isTe ? 'ప్రయాణీకుల సంఖ్య (Passenger Count):' : 'Number of Passengers:'}
        </Text>
        <View style={styles.counterRow}>
          <TouchableOpacity style={styles.counterBtn} onPress={() => handlePassengerCountChange(-1)}>
            <Text style={styles.counterBtnText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.counterVal}>{passengerCount}</Text>
          <TouchableOpacity style={styles.counterBtn} onPress={() => handlePassengerCountChange(1)}>
            <Text style={styles.counterBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Upper/Lower Deck Switcher for Sleeper Buses */}
      {layoutData?.hasUpperDeck && (
        <View style={styles.deckTabContainer}>
          <TouchableOpacity
            style={[styles.deckTab, activeDeck === 'LOWER' && styles.deckTabActive]}
            onPress={() => setActiveDeck('LOWER')}
          >
            <Text style={[styles.deckTabText, activeDeck === 'LOWER' && styles.deckTabTextActive]}>
              👇 LOWER DECK
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deckTab, activeDeck === 'UPPER' && styles.deckTabActive]}
            onPress={() => setActiveDeck('UPPER')}
          >
            <Text style={[styles.deckTabText, activeDeck === 'UPPER' && styles.deckTabTextActive]}>
              ☝️ UPPER DECK
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Seat Legend Bar */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, styles.seatAvailable]} />
          <Text style={styles.legendLabel}>{isTe ? 'అందుబాటులో ఉంది' : 'Available'}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, styles.seatSelected]} />
          <Text style={styles.legendLabel}>{isTe ? 'ఎంచుకున్నారు' : 'Selected'}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, styles.seatBooked]} />
          <Text style={styles.legendLabel}>{isTe ? 'బుక్ చేయబడింది' : 'Booked'}</Text>
        </View>
      </View>

      {/* Interactive Seat Layout Container */}
      <View style={styles.layoutCard}>
        <View style={styles.busFrontHeader}>
          <Text style={styles.steeringIcon}>☸️ Driver Position</Text>
          <Text style={styles.frontText}>FRONT OF BUS</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text style={styles.loadingText}>Loading Seat Layout...</Text>
          </View>
        ) : (
          <View style={styles.seatGrid}>
            {Object.keys(rowsMap).map(rowNum => {
              const rowSeats = rowsMap[rowNum];
              return (
                <View key={`row-${rowNum}`} style={styles.rowLayout}>
                  {rowSeats.map((seat, colIdx) => {
                    const isSelected = selectedSeatNos.includes(seat.seatNumber);
                    const isBooked = seat.status === 'BOOKED';
                    const isHeld = seat.status === 'HELD';
                    const isSleeper = (seat.seatType || '').includes('SLEEPER');

                    return (
                      <React.Fragment key={seat.seatId}>
                        {/* Insert Aisle gap between col 2 and col 3 in 2x2 Seater layout */}
                        {colIdx === 2 && !isSleeper && <View style={styles.aisleGap} />}

                        <TouchableOpacity
                          style={[
                            styles.seatBox,
                            isSleeper && styles.sleeperBox,
                            isBooked && styles.seatBooked,
                            isHeld && styles.seatHeld,
                            isSelected && styles.seatSelected,
                          ]}
                          disabled={isBooked || isHeld}
                          onPress={() => handleSeatToggle(seat)}
                        >
                          <Text
                            style={[
                              styles.seatNumberText,
                              (isSelected || isBooked) && styles.seatTextLight
                            ]}
                          >
                            {seat.seatNumber}
                          </Text>
                          {seat.extraFare > 0 && (
                            <Text style={styles.extraFareBadge}>+₹{seat.extraFare}</Text>
                          )}
                        </TouchableOpacity>
                      </React.Fragment>
                    );
                  })}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Passenger Details Form */}
      {selectedSeatNos.length > 0 && (
        <View style={styles.passengerFormCard}>
          <Text style={styles.formTitle}>
            📋 {isTe ? 'ప్రయాణీకుల వివరాలు' : 'Passenger Details'}
          </Text>
          {passengers.map((p, idx) => (
            <View key={idx} style={styles.passengerRowItem}>
              <Text style={styles.passengerSeatHeader}>
                Seat {p.seatNumber || selectedSeatNos[idx]}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="Full Name"
                placeholderTextColor="#94A3B8"
                value={p.fullName}
                onChangeText={val => handlePassengerInfoChange(idx, 'fullName', val)}
              />
              <View style={styles.inlineInputs}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="Gender (Male/Female)"
                  placeholderTextColor="#94A3B8"
                  value={p.gender}
                  onChangeText={val => handlePassengerInfoChange(idx, 'gender', val)}
                />
                <TextInput
                  style={[styles.textInput, { width: 80 }]}
                  placeholder="Age"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={String(p.age)}
                  onChangeText={val => handlePassengerInfoChange(idx, 'age', Number(val) || 25)}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Total Fare & Confirmation Bar */}
      <View style={styles.fareFooterCard}>
        <View style={styles.fareSummaryRow}>
          <View>
            <Text style={styles.footerLabel}>{isTe ? 'ఎంచుకున్న సీట్లు:' : 'Selected Seats:'}</Text>
            <Text style={styles.selectedSeatList}>
              {selectedSeatNos.length > 0 ? selectedSeatNos.join(', ') : 'None'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.footerLabel}>{isTe ? 'మొత్తం రుసుము:' : 'Total Amount:'}</Text>
            <Text style={styles.totalFareText}>₹{calculateTotalFare() || option?.totalFare || 700}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.proceedBtn, isSubmittingHold && styles.btnDisabled]}
          onPress={handleProceed}
          disabled={isSubmittingHold}
        >
          {isSubmittingHold ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.proceedBtnText}>
              {isTe ? 'సిమ్యులేటెడ్ చెక్‌అవుట్‌కి వెళ్ళు ➔' : 'Proceed to Demo Checkout ➔'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: 40 },
  bannerCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: theme.spacing.md,
    marginTop: 12,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    gap: 6
  },
  bannerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  operatorTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  routeSubtitle: { fontSize: 13, color: '#38BDF8', fontWeight: '600' },
  timeMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  timeMetaText: { fontSize: 11, color: '#94A3B8' },
  timeHighlight: { color: '#FFFFFF', fontWeight: '700' },

  passengerCountCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    padding: 12,
    borderRadius: theme.radius.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.outline
  },
  passengerLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: {
    backgroundColor: '#F1F5F9',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  counterBtnText: { fontSize: 18, fontWeight: '700', color: '#334155' },
  counterVal: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },

  deckTabContainer: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    backgroundColor: '#E2E8F0',
    borderRadius: theme.radius.lg,
    padding: 4
  },
  deckTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: theme.radius.md },
  deckTabActive: { backgroundColor: '#0F172A' },
  deckTabText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  deckTabTextActive: { color: '#FFFFFF' },

  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: '#CBD5E1' },
  legendLabel: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' },

  layoutCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.outline
  },
  busFrontHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 16
  },
  steeringIcon: { fontSize: 12, fontWeight: '700', color: '#475569' },
  frontText: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 1 },

  loadingBox: { padding: 30, alignItems: 'center' },
  loadingText: { marginTop: 8, color: theme.colors.textMuted, fontSize: 12 },

  seatGrid: { gap: 12, alignItems: 'center' },
  rowLayout: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  aisleGap: { width: 20 },

  seatBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  sleeperBox: { width: 68, height: 44 },
  seatAvailable: { backgroundColor: '#FFFFFF' },
  seatSelected: { backgroundColor: '#10B981', borderColor: '#059669' },
  seatBooked: { backgroundColor: '#94A3B8', borderColor: '#64748B' },
  seatHeld: { backgroundColor: '#F59E0B', borderColor: '#D97706' },

  seatNumberText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  seatTextLight: { color: '#FFFFFF' },
  extraFareBadge: { fontSize: 8, color: '#D97706', fontWeight: '700' },

  passengerFormCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    gap: 12
  },
  formTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  passengerRowItem: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8
  },
  passengerSeatHeader: { fontSize: 12, fontWeight: '700', color: '#0284C7' },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: theme.colors.textPrimary
  },
  inlineInputs: { flexDirection: 'row', gap: 8 },

  fareFooterCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    gap: 12
  },
  fareSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { fontSize: 11, color: theme.colors.textMuted },
  selectedSeatList: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  totalFareText: { fontSize: 22, fontWeight: '800', color: '#0284C7' },

  proceedBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    alignItems: 'center'
  },
  btnDisabled: { opacity: 0.7 },
  proceedBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' }
});
