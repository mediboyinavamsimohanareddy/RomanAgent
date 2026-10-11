package com.roamagent.controller;

import com.roamagent.dto.ApiDtos.*;
import com.roamagent.entity.TripIntent;
import com.roamagent.repository.ItineraryRepository;
import com.roamagent.repository.TripIntentRepository;
import com.roamagent.service.AgentOrchestratorService;
import com.roamagent.service.FeasibilityService;
import com.roamagent.service.RevisionCommitService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/itineraries")
@RequiredArgsConstructor
public class ItineraryController {

    private final TripIntentRepository tripIntentRepository;
    private final AgentOrchestratorService orchestratorService;
    private final FeasibilityService feasibilityService;
    private final ItineraryRepository itineraryRepository;
    private final RevisionCommitService revisionCommitService;

    @PostMapping("/search")
    public SearchItinerariesResponse searchItineraries(@RequestBody SearchItinerariesRequest request) {
        TripIntent intent = tripIntentRepository.findById(request.getIntentId())
                .orElseThrow(() -> new IllegalArgumentException("Trip intent not found"));

        var candidates = orchestratorService.getRoutePlanningAgent().findCandidates(
                intent.getOriginCity(), intent.getDestinationCity(), intent.getTravelDate()
        );

        var feasible = feasibilityService.filterFeasible(candidates, intent.getArrivalDeadline(), intent.getMaxBudget());
        var ranked = orchestratorService.getRecommendationAgent().scoreAndRank(feasible);

        List<ItineraryOptionDto> options = new ArrayList<>();
        int pos = 1;
        for (var scored : ranked) {
            var c = scored.getCandidate();
            List<LegDto> legs = new ArrayList<>();
            int seq = 1;
            for (var leg : c.getLegs()) {
                legs.add(LegDto.builder()
                        .legSequence(seq++)
                        .busServiceId(leg.getBusService().getId())
                        .operatorName(leg.getBusService().getOperator().getName())
                        .serviceNumber(leg.getBusService().getServiceNumber())
                        .busType(leg.getBusService().getServiceType())
                        .fromStopName(leg.getFromStop().getName())
                        .toStopName(leg.getToStop().getName())
                        .scheduledDeparture(leg.getDepartureTime())
                        .scheduledArrival(leg.getArrivalTime())
                        .fare(leg.getFare())
                        .build());
            }

            options.add(ItineraryOptionDto.builder()
                    .itineraryId(UUID.randomUUID().toString())
                    .rankingPosition(pos++)
                    .totalFare(c.getTotalFare())
                    .totalDurationMinutes(c.getTotalDurationMinutes())
                    .totalTransfers(c.getTotalTransfers())
                    .overallFeasible(true)
                    .compositeScore(scored.getCompositeScore())
                    .verifiedExplanation(scored.getScoreExplanation())
                    .legs(legs)
                    .build());
        }

        return SearchItinerariesResponse.builder()
                .intentId(intent.getId())
                .totalOptionsFound(options.size())
                .itineraries(options)
                .build();
    }

    @PostMapping("/{id}/select")
    public Map<String, Object> selectItinerary(@PathVariable String id) {
        return Map.of("itineraryId", id, "status", "AWAITING_DEMO_CONFIRMATION");
    }

    @PostMapping("/{id}/checkout")
    public Map<String, Object> checkoutItinerary(@PathVariable String id) {
        return Map.of("itineraryId", id, "status", "ACTIVE", "paymentStatus", "DEMO_CONFIRMED");
    }

    @PostMapping("/{id}/revisions/approve")
    public ApproveRevisionResponse approveRevision(@PathVariable String id, @RequestBody ApproveRevisionRequest request) {
        return revisionCommitService.approveRevision(id, request.getProposalId());
    }

    @PostMapping("/{id}/revisions/reject")
    public Map<String, Object> rejectRevision(@PathVariable String id) {
        return Map.of("itineraryId", id, "status", "REJECTED_ACTIVE_PRESERVED");
    }
}
