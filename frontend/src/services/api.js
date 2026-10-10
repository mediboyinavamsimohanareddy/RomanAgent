import {
  parseIntentFromInput,
  searchRoutes,
  evaluateDisruptionRisk,
  calculateRecoveryOptions
} from '../transportEngine';

// Central configuration for Spring Boot API base URL
// Usage in .env or app environment: EXPO_PUBLIC_API_BASE_URL=http://<YOUR_SPRING_BOOT_HOST>:8080/api/v1
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.2.194:8080/api/v1';

// Configured Spring Boot API endpoint paths matching backend contract
export const ENDPOINTS = {
  HEALTH: `${API_BASE_URL}/health`,
  VOICE_STT: `${API_BASE_URL}/voice/stt`,
  EXTRACT_INTENT: `${API_BASE_URL}/trip-intent/extract`,
  SEARCH_ITINERARIES: `${API_BASE_URL}/itineraries/search`,
  SELECT_ITINERARY: (id) => `${API_BASE_URL}/itineraries/${id}/select`,
  CHECKOUT_ITINERARY: (id) => `${API_BASE_URL}/itineraries/${id}/checkout`,
  APPROVE_REVISION: (id) => `${API_BASE_URL}/itineraries/${id}/revisions/approve`,
  REJECT_REVISION: (id) => `${API_BASE_URL}/itineraries/${id}/revisions/reject`,
  TRIGGER_SCENARIO: `${API_BASE_URL}/disruptions/trigger-scenario`,
};

// Generic fetch wrapper with timeout and fallback support
async function apiRequest(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 1. Fetch initial application data / Health check
 */
export async function sendVoiceAudio(base64Audio, language = 'en') {
  try {
    const response = await apiRequest(ENDPOINTS.VOICE_STT, {
      method: 'POST',
      body: JSON.stringify({ audioBase64: base64Audio, language }),
    });
    if (response && response.transcript) {
      return response;
    }
  } catch (error) {
    console.warn('[API Service] Backend STT endpoint unavailable. Using client fallback transcript.');
  }

  const fallbackText = language === 'te'
    ? 'రేపు ఉదయం 9 గంటలలోపు విశాఖపట్నం నుంచి హైదరాబాద్ చేరాలి. నా బడ్జెట్ ₹1,500. ఏసీ స్లీపర్ బస్సు కావాలి.'
    : 'I need to travel from Vizag to Hyderabad tomorrow. I must reach before 9 AM. My budget is ₹1,500, and I prefer an AC sleeper.';

  return { status: 'SUCCESS', transcript: fallbackText, language };
}

/**
 * 1. Fetch initial application data / Health check
 */
export async function getInitialData() {
  try {
    const data = await apiRequest(ENDPOINTS.HEALTH);
    return {
      status: 'SUCCESS',
      source: 'SPRING_BOOT_API',
      message: 'System connected to Spring Boot backend & MySQL.',
      data
    };
  } catch (error) {
    console.warn('[API Service] Backend unavailable for health check, falling back to local defaults.');
    return {
      status: 'SUCCESS',
      source: 'LOCAL_FALLBACK',
      message: 'Initial travel system data loaded.',
    };
  }
}

/**
 * 2. Process natural language query / travel request via Backend AI / Intake Agent
 */
export async function sendChatMessage(userPrompt, language = 'en') {
  try {
    const response = await apiRequest(ENDPOINTS.EXTRACT_INTENT, {
      method: 'POST',
      body: JSON.stringify({ rawInput: userPrompt, userLanguage: language }),
    });

    if (response && response.draftIntent) {
      return {
        status: 'SUCCESS',
        source: 'SPRING_BOOT_API',
        intentId: response.intentId,
        message: language === 'te'
          ? `మీ ప్రయాణ వివరాలు పరిశీలించండి.`
          : `I've extracted your travel plan. Review the details below.`,
        intent: {
          intentId: response.intentId,
          originCity: response.draftIntent.originCity || 'Visakhapatnam',
          destinationCity: response.draftIntent.destinationCity || 'Hyderabad',
          travelDate: response.draftIntent.travelDate,
          arrivalDeadline: response.draftIntent.arrivalDeadline,
          maxBudget: response.draftIntent.maxBudget || 2000,
          preferredMode: response.draftIntent.preferredMode || 'SLEEPER',
          passengerCount: response.draftIntent.passengerCount || 1,
        },
      };
    }
  } catch (error) {
    console.warn('[API Service] Spring Boot chat endpoint offline. Using local AI parser fallback.');
  }

  const extractedIntent = parseIntentFromInput(userPrompt, language);
  return {
    status: 'SUCCESS',
    source: 'LOCAL_FALLBACK',
    message: language === 'te'
      ? `మీ అభ్యర్థనను విశ్లేషించాను. విశాఖపట్నం నుండి హైదరాబాద్ ప్రయాణానికి రూట్‌లు వెతుకుతున్నాను.`
      : `I've processed your travel request for Vizag to Hyderabad. Let's review the details.`,
    intent: extractedIntent,
  };
}

/**
 * 3. Search trip itineraries via Backend Deterministic Routing Engine
 */
export async function fetchTripSearchResults(intent) {
  try {
    const payload = {
      intentId: intent?.intentId || intent?.id,
      minTransferBufferMinutes: 45,
      allowMultiLeg: true,
    };
    const response = await apiRequest(ENDPOINTS.SEARCH_ITINERARIES, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (response && response.itineraries && response.itineraries.length > 0) {
      return {
        status: 'SUCCESS',
        source: 'SPRING_BOOT_API',
        results: response.itineraries.map((item, idx) => ({
          id: item.itineraryId || `backend-itinerary-${idx + 1}`,
          rankingScore: item.compositeScore || 90,
          verifiedExplanation: item.verifiedExplanation || 'Recommended Option',
          summary: {
            totalFare: item.totalFare,
            totalDurationMinutes: item.totalDurationMinutes,
            totalTransfers: item.totalTransfers,
          },
          legs: (item.legs || []).map(l => ({
            id: l.legId || `leg-${l.legSequence}`,
            sequence: l.legSequence,
            serviceNumber: l.serviceNumber,
            operator: { name: l.operatorName || 'Intercity Express' },
            coachType: l.busType || 'AC Sleeper',
            fromCity: l.fromStopName,
            toCity: l.toStopName,
            originStop: l.originStop || { name: l.fromStopName, city: l.fromStopName },
            destStop: l.destStop || { name: l.toStopName, city: l.toStopName },
            departureTime: l.scheduledDeparture,
            arrivalTime: l.scheduledArrival,
            fare: l.fare,
          })),
        })),
      };
    }
  } catch (error) {
    console.warn('[API Service] Spring Boot trip search endpoint offline/failed. Using local search engine.');
  }

  const results = searchRoutes(intent);
  return {
    status: 'SUCCESS',
    source: 'LOCAL_FALLBACK',
    results,
  };
}

/**
 * 4. Retrieve Itinerary Details / Select Itinerary
 */
export async function fetchItineraryDetails(itineraryId) {
  try {
    const data = await apiRequest(ENDPOINTS.SELECT_ITINERARY(itineraryId), { method: 'POST' });
    return {
      status: 'SUCCESS',
      source: 'SPRING_BOOT_API',
      itineraryId,
      data
    };
  } catch (error) {
    console.warn('[API Service] Spring Boot itinerary endpoint offline.');
    return {
      status: 'SUCCESS',
      source: 'LOCAL_FALLBACK',
      itineraryId,
    };
  }
}

/**
 * 5. Retrieve Disruption Alert Status
 */
export async function fetchDisruptionStatus(activeItinerary, delayMinutes = 50) {
  try {
    const response = await apiRequest(ENDPOINTS.TRIGGER_SCENARIO, {
      method: 'POST',
      body: JSON.stringify({
        activeItineraryId: activeItinerary?.id,
        scenarioCode: 'SCENARIO_CONNECTION_DELAY_01',
        simulatedDelayMinutes: delayMinutes
      }),
    });

    if (response) {
      return {
        status: 'SUCCESS',
        source: 'SPRING_BOOT_API',
        disruption: {
          disruptionTriggered: response.disruptionTriggered,
          impactStatus: response.impactStatus,
          affectedLegSequence: response.affectedLegSequence,
          originalProjectedArrival: response.originalProjectedArrival,
          newProjectedArrival: response.newProjectedArrival,
          effectiveRemainingBufferMinutes: response.effectiveRemainingBufferMinutes,
          requiredBufferMinutes: response.requiredBufferMinutes,
          recoveryProposal: response.recoveryProposal
        }
      };
    }
  } catch (error) {
    console.warn('[API Service] Spring Boot alerts endpoint offline. Using local risk evaluator.');
  }

  const disruption = evaluateDisruptionRisk(activeItinerary, delayMinutes);
  return {
    status: 'SUCCESS',
    source: 'LOCAL_FALLBACK',
    disruption,
  };
}

/**
 * 6. Retrieve Recovery Alternatives
 */
export async function fetchRecoveryOptions(activeItinerary, disruption, intent) {
  if (disruption?.recoveryProposal) {
    return {
      status: 'SUCCESS',
      source: 'SPRING_BOOT_API',
      proposals: [disruption.recoveryProposal],
    };
  }

  const proposals = calculateRecoveryOptions(activeItinerary, disruption, intent);
  return {
    status: 'SUCCESS',
    source: 'LOCAL_FALLBACK',
    proposals,
  };
}

/**
 * 7. Approve Revised Itinerary
 */
export async function approveItineraryChange(proposalId, originalItineraryId) {
  try {
    const id = originalItineraryId || 'itinerary-001';
    const data = await apiRequest(ENDPOINTS.APPROVE_REVISION(id), {
      method: 'POST',
      body: JSON.stringify({ proposalId }),
    });

    return {
      status: 'SUCCESS',
      source: 'SPRING_BOOT_API',
      confirmed: true,
      data,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.warn('[API Service] Spring Boot approval endpoint offline. Approving locally.');
    return {
      status: 'SUCCESS',
      source: 'LOCAL_FALLBACK',
      confirmed: true,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * 8. Retrieve Pass / Confirmed Journey
 */
export async function fetchConfirmedPass(itineraryId) {
  try {
    const id = itineraryId || 'itinerary-001';
    const data = await apiRequest(ENDPOINTS.CHECKOUT_ITINERARY(id), { method: 'POST' });
    return {
      status: 'SUCCESS',
      source: 'SPRING_BOOT_API',
      itineraryId,
      data
    };
  } catch (error) {
    console.warn('[API Service] Spring Boot pass endpoint offline.');
    return {
      status: 'SUCCESS',
      source: 'LOCAL_FALLBACK',
      itineraryId,
    };
  }
}
