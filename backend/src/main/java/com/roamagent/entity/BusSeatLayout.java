package com.roamagent.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "bus_seat_layouts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BusSeatLayout {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id", nullable = false)
    private Vehicle vehicle;

    @Column(nullable = false)
    private String layoutName;

    @Column(nullable = false)
    private String coachType; // SEATER_2X2, SLEEPER_2X1, etc.

    @Column(nullable = false)
    private Integer totalRows;

    @Column(nullable = false)
    private Integer totalCols;

    @Column(nullable = false)
    private Integer totalSeats;

    @Column
    private Boolean hasUpperDeck;
}
