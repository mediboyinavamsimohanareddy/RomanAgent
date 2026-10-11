package com.roamagent.service;

import com.roamagent.dto.ApiDtos.*;
import com.roamagent.entity.*;
import com.roamagent.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SeatBookingServiceTest {

    @Mock
    private BusServiceRepository busServiceRepository;
    @Mock
    private BusSeatLayoutRepository busSeatLayoutRepository;
    @Mock
    private BusSeatRepository busSeatRepository;
    @Mock
    private ServiceDepartureRepository serviceDepartureRepository;
    @Mock
    private SeatInventoryRepository seatInventoryRepository;
    @Mock
    private SeatBookingRepository seatBookingRepository;
    @Mock
    private BookingPassengerRepository bookingPassengerRepository;
    @Mock
    private FareRecordRepository fareRecordRepository;

    @InjectMocks
    private SeatBookingService seatBookingService;

    private BusService mockBusService;
    private ServiceDeparture mockDeparture;
    private BusSeat mockSeat;
    private SeatInventory mockInventory;

    @BeforeEach
    void setUp() {
        Operator operator = Operator.builder().id("op-1").name("APSRTC").build();
        Vehicle vehicle = Vehicle.builder().id("v-1").operator(operator).busType("SUPER_LUXURY").capacity(36).build();
        mockBusService = BusService.builder().id("bs-1").serviceNumber("AP7788").operator(operator).vehicle(vehicle).build();
        mockDeparture = ServiceDeparture.builder().id("dep-1").busService(mockBusService).departureDate(LocalDate.now()).status("SCHEDULED").build();
        mockSeat = BusSeat.builder().id("seat-1").seatNumber("1A").rowNum(1).colNum(1).extraFare(BigDecimal.ZERO).build();
        mockInventory = SeatInventory.builder().id("inv-1").serviceDeparture(mockDeparture).busSeat(mockSeat).status("AVAILABLE").build();
    }

    @Test
    void testCreateSeatHold_Success() {
        when(busServiceRepository.findById("bs-1")).thenReturn(Optional.of(mockBusService));
        when(serviceDepartureRepository.findByBusServiceIdAndDepartureDate(eq("bs-1"), any())).thenReturn(Optional.of(mockDeparture));
        when(seatInventoryRepository.findForUpdateByDepartureAndSeatNumbers(eq("dep-1"), eq(List.of("1A")))).thenReturn(List.of(mockInventory));
        when(fareRecordRepository.findByBusServiceId("bs-1")).thenReturn(List.of());

        CreateSeatHoldRequest request = new CreateSeatHoldRequest();
        request.setBusServiceId("bs-1");
        request.setDepartureDate(LocalDate.now());
        request.setSeatNumbers(List.of("1A"));
        request.setPassengerCount(1);

        CreateSeatHoldResponse response = seatBookingService.createSeatHold(request);

        assertNotNull(response.getHoldToken());
        assertEquals(1, response.getSelectedSeats().size());
        assertEquals("1A", response.getSelectedSeats().get(0));
        verify(seatInventoryRepository).saveAll(any());
    }

    @Test
    void testCreateSeatHold_FailsWhenUnavailable() {
        mockInventory.setStatus("BOOKED");
        when(busServiceRepository.findById("bs-1")).thenReturn(Optional.of(mockBusService));
        when(serviceDepartureRepository.findByBusServiceIdAndDepartureDate(eq("bs-1"), any())).thenReturn(Optional.of(mockDeparture));
        when(seatInventoryRepository.findForUpdateByDepartureAndSeatNumbers(eq("dep-1"), eq(List.of("1A")))).thenReturn(List.of(mockInventory));

        CreateSeatHoldRequest request = new CreateSeatHoldRequest();
        request.setBusServiceId("bs-1");
        request.setDepartureDate(LocalDate.now());
        request.setSeatNumbers(List.of("1A"));
        request.setPassengerCount(1);

        assertThrows(IllegalStateException.class, () -> seatBookingService.createSeatHold(request));
    }
}
