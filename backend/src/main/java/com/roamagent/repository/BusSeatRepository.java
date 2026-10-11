package com.roamagent.repository;

import com.roamagent.entity.BusSeat;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BusSeatRepository extends JpaRepository<BusSeat, String> {
    List<BusSeat> findByLayoutIdOrderByRowNumAscColNumAsc(String layoutId);
}
