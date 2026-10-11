package com.roamagent.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "seat_inventories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatInventory {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_departure_id", nullable = false)
    private ServiceDeparture serviceDeparture;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "bus_seat_id", nullable = false)
    private BusSeat busSeat;

    @Column(nullable = false)
    private String status; // AVAILABLE, HELD, BOOKED

    @Column
    private String holdToken;

    @Column
    private LocalDateTime holdExpiresAt;

    @Column
    private LocalDateTime updatedAt;
}
