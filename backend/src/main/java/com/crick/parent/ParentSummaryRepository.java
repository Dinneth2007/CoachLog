package com.crick.parent;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ParentSummaryRepository extends JpaRepository<ParentSummary, Long> {

    Optional<ParentSummary> findByPlayerId(Long playerId);
}
