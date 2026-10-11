package com.roamagent.controller;

import com.roamagent.dto.ApiDtos.*;
import com.roamagent.service.SeatBookingService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/seats")
@RequiredArgsConstructor
public class SeatBookingController {

    private final SeatBookingService seatBookingService;

    @GetMapping("/layout")
    public SeatLayoutResponse getSeatLayout(
            @RequestParam String busServiceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate departureDate) {
        return seatBookingService.getSeatLayoutAndAvailability(busServiceId, departureDate);
    }

    @PostMapping("/hold")
    public CreateSeatHoldResponse createSeatHold(@RequestBody CreateSeatHoldRequest request) {
        return seatBookingService.createSeatHold(request);
    }

    @PostMapping("/confirm")
    public ConfirmSeatBookingResponse confirmBooking(@RequestBody ConfirmSeatBookingRequest request) {
        return seatBookingService.confirmBooking(request);
    }

    @GetMapping("/booking/{bookingRef}")
    public ConfirmSeatBookingResponse getBooking(@PathVariable String bookingRef) {
        return seatBookingService.getBookingByReference(bookingRef);
    }
}
