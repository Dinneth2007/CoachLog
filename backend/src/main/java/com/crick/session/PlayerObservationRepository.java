package com.crick.session;

import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    @Query("""
            SELECT DISTINCT o FROM PlayerObservation o
            LEFT JOIN FETCH o.scores
            JOIN FETCH o.session s
            WHERE o.player.id = :playerId
            ORDER BY s.date ASC, o.id ASC
            """)
    List<PlayerObservation> findByPlayerIdWithScoresAndSession(@Param("playerId") Long playerId);

    @Query(value = """
            SELECT o FROM PlayerObservation o
            JOIN FETCH o.session s
            WHERE o.player.id = :playerId
            ORDER BY s.date DESC, o.id DESC
            """,
            countQuery = "SELECT COUNT(o) FROM PlayerObservation o WHERE o.player.id = :playerId")
    Page<PlayerObservation> findPageByPlayerId(@Param("playerId") Long playerId, Pageable pageable);

    @Query("""
            SELECT DISTINCT o FROM PlayerObservation o
            LEFT JOIN FETCH o.scores
            WHERE o.id IN :ids
            """)
    List<PlayerObservation> findWithScoresByIdIn(@Param("ids") Collection<Long> ids);

    @Query("""
            SELECT DISTINCT o FROM PlayerObservation o
            LEFT JOIN FETCH o.scores
            JOIN FETCH o.player p
            JOIN FETCH o.session s
            WHERE p.coach.id = :coachId
            ORDER BY p.id ASC, s.date ASC, o.id ASC
            """)
    List<PlayerObservation> findByCoachIdWithScoresAndSession(@Param("coachId") Long coachId);
}
