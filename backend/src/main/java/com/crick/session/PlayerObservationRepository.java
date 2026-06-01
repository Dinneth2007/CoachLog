package com.crick.session;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlayerObservationRepository extends JpaRepository<PlayerObservation, Long> {

    @Modifying
    @Query("DELETE FROM PlayerObservation o WHERE o.session.id = :sessionId")
    int deleteAllBySessionId(@Param("sessionId") Long sessionId);

    @Query("""
            SELECT DISTINCT o FROM PlayerObservation o
            LEFT JOIN FETCH o.scores
            JOIN FETCH o.player
            WHERE o.session.id = :sessionId
            """)
    List<PlayerObservation> findBySessionIdWithScores(@Param("sessionId") Long sessionId);
}
