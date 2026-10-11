package com.roamagent.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "bus_seats")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BusSeat {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "layout_id", nullable = false)
    private BusSeatLayout layout;

    @Column(nullable = false)
    private String seatNumber;

    @Column(nullable = false)
    private Integer rowNum;

    @Column(nullable = false)
    private Integer colNum;

    @Column
    private String deck; // LOWER / UPPER

    @Column
    private String seatType; // SEATER, SLEEPER_SINGLE, SLEEPER_DOUBLE

    @Column
    private Boolean isWindow;

    @Column
    private BigDecimal extraFare;
}
