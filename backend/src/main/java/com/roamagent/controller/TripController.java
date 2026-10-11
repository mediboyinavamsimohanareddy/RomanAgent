package com.roamagent.controller;

import com.roamagent.dto.ApiDtos.*;
import com.roamagent.entity.TripIntent;
import com.roamagent.repository.TripIntentRepository;
import com.roamagent.service.AgentOrchestratorService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class TripController {

    private final AgentOrchestratorService orchestratorService;
    private final TripIntentRepository tripIntentRepository;

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("status", "UP", "service", "RoamAgent Backend", "version", "1.0.0");
    }

    @PostMapping("/voice/stt")
    public Map<String, Object> speechToText(@RequestBody Map<String, String> request) {
        String base64Audio = request.get("audioBase64");
        String language = request.getOrDefault("language", "en");
        
        if (base64Audio != null && !base64Audio.isEmpty()) {
            try {
                byte[] audioBytes = java.util.Base64.getDecoder().decode(base64Audio);
                String transcript = orchestratorService.getConversationAgent().getGroqApiClient().transcribeAudio(audioBytes, "recording.m4a");
                if (transcript != null && !transcript.trim().isEmpty()) {
                    return Map.of("status", "SUCCESS", "transcript", transcript, "language", language);
                }
            } catch (Exception e) {
                return Map.of("status", "ERROR", "message", "Transcription failed: " + e.getMessage(), "language", language);
            }
        }

        return Map.of("status", "ERROR", "message", "No valid audio payload received", "language", language);
    }

    @PostMapping("/trip-intent/extract")
    public ExtractIntentResponse extractIntent(@RequestBody ExtractIntentRequest request) {
        var draft = orchestratorService.getIntakeAgent().extractIntent(request.getRawInput());
        var clarification = orchestratorService.getClarificationAgent().evaluateDraft(draft);

        String intentId = UUID.randomUUID().toString();
        String convId = request.getConversationId() != null ? request.getConversationId() : UUID.randomUUID().toString();

        TripIntent savedIntent = TripIntent.builder()
                .id(intentId)
                .conversationId(convId)
                .originCity(draft.getOriginCity())
                .destinationCity(draft.getDestinationCity())
                .travelDate(draft.getTravelDate())
                .arrivalDeadline(draft.getArrivalDeadline())
                .maxBudget(draft.getMaxBudget())
                .preferredMode(draft.getPreferredMode())
                .passengerCount(draft.getPassengerCount())
                .languagePreference(request.getUserLanguage())
                .isClarified(clarification.isClarified())
                .build();

        tripIntentRepository.save(savedIntent);

        DraftIntentDto draftDto = DraftIntentDto.builder()
                .originCity(draft.getOriginCity())
                .destinationCity(draft.getDestinationCity())
                .travelDate(draft.getTravelDate())
                .arrivalDeadline(draft.getArrivalDeadline())
                .maxBudget(draft.getMaxBudget())
                .preferredMode(draft.getPreferredMode())
                .passengerCount(draft.getPassengerCount())
                .build();

        ClarificationQuestionDto questionDto = null;
        if (clarification.getQuestion() != null) {
            questionDto = ClarificationQuestionDto.builder()
                    .questionKey(clarification.getQuestion().getQuestionKey())
                    .questionText(clarification.getQuestion().getQuestionText())
                    .options(clarification.getQuestion().getOptions())
                    .build();
        }

        return ExtractIntentResponse.builder()
                .intentId(savedIntent.getId())
                .status(clarification.isClarified() ? "CLARIFIED" : "REQUIRES_CLARIFICATION")
                .draftIntent(draftDto)
                .missingFields(clarification.getMissingFields())
                .clarificationQuestion(questionDto)
                .build();
    }
}
