package com.roamagent.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class ApiDtos {

    @Data
    public static class ExtractIntentRequest {
        private String conversationId;
        private String rawInput;
        private String userLanguage;
    }

    @Data
    @Builder
    public static class ExtractIntentResponse {
        private String intentId;
        private String status;
        private DraftIntentDto draftIntent;
        private List<String> missingFields;
        private ClarificationQuestionDto clarificationQuestion;
    }

    @Data
    @Builder
    public static class DraftIntentDto {
        private String originCity;
        private String destinationCity;
        private LocalDate travelDate;
        private LocalDateTime arrivalDeadline;
        private BigDecimal maxBudget;
        private String preferredMode;
        private Integer passengerCount;
    }

    @Data
    @Builder
    public static class ClarificationQuestionDto {
        private String questionKey;
        private String questionText;
        private List<String> options;
    }

    @Data
    public static class SearchItinerariesRequest {
        private String intentId;
        private Integer minTransferBufferMinutes;
        private Boolean allowMultiLeg;
    }

    @Data
    @Builder
    public static class SearchItinerariesResponse {
        private String intentId;
        private Integer totalOptionsFound;
        private List<ItineraryOptionDto> itineraries;
    }

    @Data
    @Builder
    public static class ItineraryOptionDto {
        private String itineraryId;
        private Integer rankingPosition;
        private BigDecimal totalFare;
        private Integer totalDurationMinutes;
        private Integer totalTransfers;
        private Boolean overallFeasible;
        private BigDecimal compositeScore;
        private String verifiedExplanation;
        private List<LegDto> legs;
    }

    @Data
    @Builder
    public static class LegDto {
        private Integer legSequence;
        private String busServiceId;
        private String operatorName;
        private String serviceNumber;
        private String busType;
        private String fromStopName;
        private String toStopName;
        private LocalDateTime scheduledDeparture;
        private LocalDateTime scheduledArrival;
        private BigDecimal fare;
    }

    @Data
    public static class TriggerScenarioRequest {
        private String activeItineraryId;
        private String scenarioCode;
        private Integer simulatedDelayMinutes;
    }

    @Data
    public static class ApproveRevisionRequest {
        private String proposalId;
    }

    @Data
    @Builder
    public static class ApproveRevisionResponse {
        private String itineraryId;
        private Integer newRevisionNumber;
        private String status;
        private LocalDateTime activeEta;
        private String auditRecordId;
        private String message;
    }

    // --- Seat Selection and Booking DTOs ---

    @Data
    @Builder
    public static class SeatDto {
        private String seatId;
        private String seatNumber;
        private Integer rowNum;
        private Integer colNum;
        private String deck;
        private String seatType;
        private Boolean isWindow;
        private BigDecimal extraFare;
        private String status; // AVAILABLE, HELD, BOOKED
    }

    @Data
    @Builder
    public static class SeatLayoutResponse {
        private String busServiceId;
        private String serviceNumber;
        private String operatorName;
        private String coachType;
        private Integer totalRows;
        private Integer totalCols;
        private Integer totalSeats;
        private Boolean hasUpperDeck;
        private BigDecimal baseFare;
        private LocalDate departureDate;
        private String serviceDepartureId;
        private List<SeatDto> seats;
    }

    @Data
    public static class CreateSeatHoldRequest {
        private String busServiceId;
        private LocalDate departureDate;
        private List<String> seatNumbers;
        private Integer passengerCount;
    }

    @Data
    @Builder
    public static class CreateSeatHoldResponse {
        private String holdToken;
        private LocalDateTime holdExpiresAt;
        private String busServiceId;
        private LocalDate departureDate;
        private List<String> selectedSeats;
        private BigDecimal totalFare;
        private String message;
    }

    @Data
    public static class PassengerInputDto {
        private String seatNumber;
        private String fullName;
        private String gender;
        private Integer age;
    }

    @Data
    public static class ConfirmSeatBookingRequest {
        private String holdToken;
        private String busServiceId;
        private LocalDate departureDate;
        private String itineraryId;
        private List<PassengerInputDto> passengers;
    }

    @Data
    @Builder
    public static class ConfirmSeatBookingResponse {
        private String bookingReference;
        private String itineraryId;
        private String busServiceId;
        private String operatorName;
        private LocalDate departureDate;
        private BigDecimal totalFare;
        private Integer passengerCount;
        private List<PassengerInputDto> passengers;
        private List<String> confirmedSeatNumbers;
        private String status;
        private String message;
    }
}
