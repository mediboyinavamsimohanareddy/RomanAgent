package com.roamagent.repository;

import com.roamagent.entity.BookingPassenger;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BookingPassengerRepository extends JpaRepository<BookingPassenger, String> {
    List<BookingPassenger> findByBookingId(String bookingId);
}
