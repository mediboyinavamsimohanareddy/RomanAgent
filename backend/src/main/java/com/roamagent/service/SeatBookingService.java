package com.roamagent.service;

import com.roamagent.dto.ApiDtos.*;
import com.roamagent.entity.*;
import com.roamagent.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SeatBookingService {

    private final BusServiceRepository busServiceRepository;
    private final BusSeatLayoutRepository busSeatLayoutRepository;
    private final BusSeatRepository busSeatRepository;
    private final ServiceDepartureRepository serviceDepartureRepository;
    private final SeatInventoryRepository seatInventoryRepository;
    private final SeatBookingRepository seatBookingRepository;
    private final BookingPassengerRepository bookingPassengerRepository;
    private final FareRecordRepository fareRecordRepository;

    @Transactional
    public SeatLayoutResponse getSeatLayoutAndAvailability(String busServiceId, LocalDate departureDate) {
        if (departureDate == null) {
            departureDate = LocalDate.now();
        }

        BusService busService = busServiceRepository.findById(busServiceId)
                .orElseThrow(() -> new IllegalArgumentException("Bus service not found for ID: " + busServiceId));

        // Get or create ServiceDeparture
        final LocalDate targetDate = departureDate;
        ServiceDeparture departure = serviceDepartureRepository
                .findByBusServiceIdAndDepartureDate(busServiceId, targetDate)
                .orElseGet(() -> serviceDepartureRepository.save(ServiceDeparture.builder()
                        .id(UUID.randomUUID().toString())
                        .busService(busService)
                        .departureDate(targetDate)
                        .status("SCHEDULED")
                        .createdAt(LocalDateTime.now())
                        .build()));

        // Retrieve Seat Layout
        BusSeatLayout layout = busSeatLayoutRepository.findByVehicleId(busService.getVehicle().getId())
                .orElseGet(() -> createFallbackLayout(busService.getVehicle()));

        List<BusSeat> busSeats = busSeatRepository.findByLayoutIdOrderByRowNumAscColNumAsc(layout.getId());
        if (busSeats.isEmpty()) {
            busSeats = seedDefaultSeatsForLayout(layout);
        }

        // Get or initialize Seat Inventories
        List<SeatInventory> inventories = seatInventoryRepository.findByServiceDepartureId(departure.getId());
        Map<String, SeatInventory> inventoryMap = inventories.stream()
                .collect(Collectors.toMap(i -> i.getBusSeat().getId(), i -> i, (a, b) -> a));

        LocalDateTime now = LocalDateTime.now();
        List<SeatDto> seatDtos = new ArrayList<>();

        for (BusSeat seat : busSeats) {
            SeatInventory inv = inventoryMap.get(seat.getId());
            if (inv == null) {
                inv = seatInventoryRepository.save(SeatInventory.builder()
                        .id(UUID.randomUUID().toString())
                        .serviceDeparture(departure)
                        .busSeat(seat)
                        .status("AVAILABLE")
                        .updatedAt(now)
                        .build());
            } else if ("HELD".equals(inv.getStatus()) && inv.getHoldExpiresAt() != null && inv.getHoldExpiresAt().isBefore(now)) {
                inv.setStatus("AVAILABLE");
                inv.setHoldToken(null);
                inv.setHoldExpiresAt(null);
                inv.setUpdatedAt(now);
                seatInventoryRepository.save(inv);
            }

            seatDtos.add(SeatDto.builder()
                    .seatId(seat.getId())
                    .seatNumber(seat.getSeatNumber())
                    .rowNum(seat.getRowNum())
                    .colNum(seat.getColNum())
                    .deck(seat.getDeck())
                    .seatType(seat.getSeatType())
                    .isWindow(seat.getIsWindow())
                    .extraFare(seat.getExtraFare() != null ? seat.getExtraFare() : BigDecimal.ZERO)
                    .status(inv.getStatus())
                    .build());
        }

        // Get base fare if available
        BigDecimal baseFare = fareRecordRepository.findByBusServiceId(busServiceId).stream()
                .findFirst()
                .map(FareRecord::getBaseFare)
                .orElse(BigDecimal.valueOf(700.00));

        return SeatLayoutResponse.builder()
                .busServiceId(busServiceId)
                .serviceNumber(busService.getServiceNumber())
                .operatorName(busService.getOperator().getName())
                .coachType(layout.getCoachType())
                .totalRows(layout.getTotalRows())
                .totalCols(layout.getTotalCols())
                .totalSeats(layout.getTotalSeats())
                .hasUpperDeck(layout.getHasUpperDeck())
                .baseFare(baseFare)
                .departureDate(departureDate)
                .serviceDepartureId(departure.getId())
                .seats(seatDtos)
                .build();
    }

    @Transactional
    public CreateSeatHoldResponse createSeatHold(CreateSeatHoldRequest request) {
        if (request.getSeatNumbers() == null || request.getSeatNumbers().isEmpty()) {
            throw new IllegalArgumentException("At least one seat must be selected");
        }

        LocalDate departureDate = request.getDepartureDate() != null ? request.getDepartureDate() : LocalDate.now();

        BusService busService = busServiceRepository.findById(request.getBusServiceId())
                .orElseThrow(() -> new IllegalArgumentException("Bus service not found"));

        ServiceDeparture departure = serviceDepartureRepository
                .findByBusServiceIdAndDepartureDate(request.getBusServiceId(), departureDate)
                .orElseThrow(() -> new IllegalArgumentException("Service departure not initialized for date"));

        // Acquire Pessimistic Locks on target seats
        List<SeatInventory> lockedInventories = seatInventoryRepository
                .findForUpdateByDepartureAndSeatNumbers(departure.getId(), request.getSeatNumbers());

        if (lockedInventories.size() != request.getSeatNumbers().size()) {
            throw(new IllegalStateException("One or more selected seat numbers do not exist for this departure"));
        }

        LocalDateTime now = LocalDateTime.now();
        for (SeatInventory inv : lockedInventories) {
            boolean isExpiredHold = "HELD".equals(inv.getStatus()) && inv.getHoldExpiresAt() != null && inv.getHoldExpiresAt().isBefore(now);
            if (!"AVAILABLE".equals(inv.getStatus()) && !isExpiredHold) {
                throw new IllegalStateException("Seat " + inv.getBusSeat().getSeatNumber() + " is currently unavailable or booked");
            }
        }

        String holdToken = UUID.randomUUID().toString();
        LocalDateTime expiresAt = now.plusMinutes(10);

        BigDecimal baseFare = fareRecordRepository.findByBusServiceId(request.getBusServiceId()).stream()
                .findFirst()
                .map(FareRecord::getBaseFare)
                .orElse(BigDecimal.valueOf(700.00));

        BigDecimal totalFare = BigDecimal.ZERO;

        for (SeatInventory inv : lockedInventories) {
            inv.setStatus("HELD");
            inv.setHoldToken(holdToken);
            inv.setHoldExpiresAt(expiresAt);
            inv.setUpdatedAt(now);

            BigDecimal seatExtra = inv.getBusSeat().getExtraFare() != null ? inv.getBusSeat().getExtraFare() : BigDecimal.ZERO;
            totalFare = totalFare.add(baseFare).add(seatExtra);
        }

        seatInventoryRepository.saveAll(lockedInventories);

        return CreateSeatHoldResponse.builder()
                .holdToken(holdToken)
                .holdExpiresAt(expiresAt)
                .busServiceId(request.getBusServiceId())
                .departureDate(departureDate)
                .selectedSeats(request.getSeatNumbers())
                .totalFare(totalFare)
                .message("Seats temporarily held for 10 minutes")
                .build();
    }

    @Transactional
    public ConfirmSeatBookingResponse confirmBooking(ConfirmSeatBookingRequest request) {
        LocalDate departureDate = request.getDepartureDate() != null ? request.getDepartureDate() : LocalDate.now();

        ServiceDeparture departure = serviceDepartureRepository
                .findByBusServiceIdAndDepartureDate(request.getBusServiceId(), departureDate)
                .orElseThrow(() -> new IllegalArgumentException("Service departure not found"));

        List<SeatInventory> heldInventories = seatInventoryRepository
                .findByServiceDepartureIdAndHoldToken(departure.getId(), request.getHoldToken());

        if (heldInventories.isEmpty()) {
            throw new IllegalStateException("Invalid or expired seat hold token");
        }

        LocalDateTime now = LocalDateTime.now();
        for (SeatInventory inv : heldInventories) {
            if (inv.getHoldExpiresAt() != null && inv.getHoldExpiresAt().isBefore(now)) {
                throw new IllegalStateException("Seat hold expired. Please re-select your seats.");
            }
        }

        // Calculate authoritative fare
        BigDecimal baseFare = fareRecordRepository.findByBusServiceId(request.getBusServiceId()).stream()
                .findFirst()
                .map(FareRecord::getBaseFare)
                .orElse(BigDecimal.valueOf(700.00));

        BigDecimal totalFare = BigDecimal.ZERO;
        for (SeatInventory inv : heldInventories) {
            inv.setStatus("BOOKED");
            inv.setHoldToken(null);
            inv.setHoldExpiresAt(null);
            inv.setUpdatedAt(now);

            BigDecimal seatExtra = inv.getBusSeat().getExtraFare() != null ? inv.getBusSeat().getExtraFare() : BigDecimal.ZERO;
            totalFare = totalFare.add(baseFare).add(seatExtra);
        }

        seatInventoryRepository.saveAll(heldInventories);

        String bookingRef = "RM-BK" + (100000 + new Random().nextInt(899999));

        SeatBooking booking = seatBookingRepository.save(SeatBooking.builder()
                .id(UUID.randomUUID().toString())
                .bookingReference(bookingRef)
                .itineraryId(request.getItineraryId())
                .serviceDeparture(departure)
                .passengerCount(request.getPassengers() != null ? request.getPassengers().size() : heldInventories.size())
                .totalFare(totalFare)
                .status("CONFIRMED")
                .createdAt(now)
                .build());

        List<BookingPassenger> passengerEntities = new ArrayList<>();
        if (request.getPassengers() != null && !request.getPassengers().isEmpty()) {
            for (PassengerInputDto pDto : request.getPassengers()) {
                BusSeat seat = heldInventories.stream()
                        .map(SeatInventory::getBusSeat)
                        .filter(s -> s.getSeatNumber().equalsIgnoreCase(pDto.getSeatNumber()))
                        .findFirst()
                        .orElse(heldInventories.get(0).getBusSeat());

                passengerEntities.add(BookingPassenger.builder()
                        .id(UUID.randomUUID().toString())
                        .booking(booking)
                        .busSeat(seat)
                        .seatNumber(pDto.getSeatNumber())
                        .fullName(pDto.getFullName() != null ? pDto.getFullName() : "Passenger")
                        .gender(pDto.getGender() != null ? pDto.getGender() : "Male")
                        .age(pDto.getAge() != null ? pDto.getAge() : 25)
                        .build());
            }
            bookingPassengerRepository.saveAll(passengerEntities);
        }

        return ConfirmSeatBookingResponse.builder()
                .bookingReference(bookingRef)
                .itineraryId(request.getItineraryId())
                .busServiceId(request.getBusServiceId())
                .operatorName(departure.getBusService().getOperator().getName())
                .departureDate(departureDate)
                .totalFare(totalFare)
                .passengerCount(booking.getPassengerCount())
                .passengers(request.getPassengers())
                .status("CONFIRMED")
                .message("Booking confirmed successfully!")
                .build();
    }

    public ConfirmSeatBookingResponse getBookingByReference(String bookingRef) {
        SeatBooking booking = seatBookingRepository.findByBookingReference(bookingRef)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found for ref: " + bookingRef));

        List<BookingPassenger> passengers = bookingPassengerRepository.findByBookingId(booking.getId());

        List<PassengerInputDto> pDtos = passengers.stream().map(p -> {
            PassengerInputDto dto = new PassengerInputDto();
            dto.setSeatNumber(p.getSeatNumber());
            dto.setFullName(p.getFullName());
            dto.setGender(p.getGender());
            dto.setAge(p.getAge());
            return dto;
        }).collect(Collectors.toList());

        return ConfirmSeatBookingResponse.builder()
                .bookingReference(booking.getBookingReference())
                .itineraryId(booking.getItineraryId())
                .busServiceId(booking.getServiceDeparture().getBusService().getId())
                .operatorName(booking.getServiceDeparture().getBusService().getOperator().getName())
                .departureDate(booking.getServiceDeparture().getDepartureDate())
                .totalFare(booking.getTotalFare())
                .passengerCount(booking.getPassengerCount())
                .passengers(pDtos)
                .status(booking.getStatus())
                .message("Booking retrieved successfully")
                .build();
    }

    private BusSeatLayout createFallbackLayout(Vehicle vehicle) {
        return busSeatLayoutRepository.save(BusSeatLayout.builder()
                .id(UUID.randomUUID().toString())
                .vehicle(vehicle)
                .layoutName("Default Seater Layout")
                .coachType("SEATER_2X2")
                .totalRows(9)
                .totalCols(4)
                .totalSeats(36)
                .hasUpperDeck(false)
                .build());
    }

    private List<BusSeat> seedDefaultSeatsForLayout(BusSeatLayout layout) {
        List<BusSeat> seats = new ArrayList<>();
        char[] colLetters = {'A', 'B', 'C', 'D'};
        for (int r = 1; r <= layout.getTotalRows(); r++) {
            for (int c = 1; c <= 4; c++) {
                String seatNo = r + "" + colLetters[c - 1];
                seats.add(busSeatRepository.save(BusSeat.builder()
                        .id(UUID.randomUUID().toString())
                        .layout(layout)
                        .seatNumber(seatNo)
                        .rowNum(r)
                        .colNum(c)
                        .deck("LOWER")
                        .seatType("SEATER")
                        .isWindow(c == 1 || c == 4)
                        .extraFare(BigDecimal.ZERO)
                        .build()));
            }
        }
        return seats;
    }
}
