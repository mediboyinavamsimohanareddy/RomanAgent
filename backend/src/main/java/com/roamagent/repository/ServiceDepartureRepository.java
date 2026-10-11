package com.roamagent.repository;

import com.roamagent.entity.ServiceDeparture;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.Optional;

public interface ServiceDepartureRepository extends JpaRepository<ServiceDeparture, String> {
    Optional<ServiceDeparture> findByBusServiceIdAndDepartureDate(String busServiceId, LocalDate departureDate);
}
