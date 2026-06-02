package com.crick.recommendation;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DrillRecommendationRepository extends JpaRepository<DrillRecommendation, Long> {

    @Query("""
            SELECT r FROM DrillRecommendation r
            JOIN FETCH r.drill
            WHERE r.player.id = :playerId AND r.isCurrent = true
            ORDER BY r.similarityScore DESC
            """)
    List<DrillRecommendation> findCurrentByPlayerId(@Param("playerId") Long playerId);

    @Modifying
    @Query("UPDATE DrillRecommendation r SET r.isCurrent = false WHERE r.player.id = :playerId AND r.isCurrent = true")
    void markAllNotCurrent(@Param("playerId") Long playerId);
}
