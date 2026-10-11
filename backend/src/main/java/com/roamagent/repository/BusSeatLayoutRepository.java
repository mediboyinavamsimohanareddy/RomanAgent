package com.roamagent.repository;

import com.roamagent.entity.BusSeatLayout;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface BusSeatLayoutRepository extends JpaRepository<BusSeatLayout, String> {
    Optional<BusSeatLayout> findByVehicleId(String vehicleId);
}
