package com.crick.session;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SessionRepository extends JpaRepository<Session, Long> {

    Optional<Session> findByIdAndCoachId(Long id, Long coachId);

    @Query("""
            SELECT s FROM Session s
            LEFT JOIN FETCH s.players
            WHERE s.id = :id AND s.coach.id = :coachId
            """)
    Optional<Session> findDetailByIdAndCoachId(@Param("id") Long id, @Param("coachId") Long coachId);

    @Query("""
            SELECT new com.crick.session.SessionSummaryResponse(
                s.id, s.date, s.title, SIZE(s.players), s.createdAt)
            FROM Session s
            WHERE s.coach.id = :coachId
            ORDER BY s.date DESC, s.id DESC
            """)
    Page<SessionSummaryResponse> findSummariesByCoachId(@Param("coachId") Long coachId, Pageable pageable);
}
