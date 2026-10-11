package com.roamagent.repository;

import com.roamagent.entity.SeatInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import javax.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

public interface SeatInventoryRepository extends JpaRepository<SeatInventory, String> {

    List<SeatInventory> findByServiceDepartureId(String serviceDepartureId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT si FROM SeatInventory si WHERE si.serviceDeparture.id = :departureId AND si.busSeat.seatNumber IN :seatNumbers")
    List<SeatInventory> findForUpdateByDepartureAndSeatNumbers(
            @Param("departureId") String departureId,
            @Param("seatNumbers") List<String> seatNumbers
    );

    Optional<SeatInventory> findByServiceDepartureIdAndHoldTokenAndBusSeatSeatNumber(String departureId, String holdToken, String seatNumber);

    List<SeatInventory> findByServiceDepartureIdAndHoldToken(String departureId, String holdToken);
}
