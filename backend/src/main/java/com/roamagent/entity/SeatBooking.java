package com.roamagent.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "seat_bookings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatBooking {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String bookingReference;

    @Column
    private String itineraryId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_departure_id", nullable = false)
    private ServiceDeparture serviceDeparture;

    @Column(nullable = false)
    private Integer passengerCount;

    @Column(nullable = false)
    private BigDecimal totalFare;

    @Column(nullable = false)
    private String status; // HELD, CONFIRMED, CANCELLED

    @Column
    private LocalDateTime createdAt;
}
