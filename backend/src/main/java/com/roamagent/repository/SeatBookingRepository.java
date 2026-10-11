package com.roamagent.repository;

import com.roamagent.entity.SeatBooking;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SeatBookingRepository extends JpaRepository<SeatBooking, String> {
    Optional<SeatBooking> findByBookingReference(String bookingReference);
}
