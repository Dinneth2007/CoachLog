package com.crick.player;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlayerRepository extends JpaRepository<Player, Long> {

    Optional<Player> findByIdAndCoachId(Long id, Long coachId);

    @Query("""
            SELECT p FROM Player p
            WHERE p.coach.id = :coachId
              AND (:ageGroup IS NULL OR p.ageGroup = :ageGroup)
              AND (:search IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')))
            """)
    Page<Player> search(@Param("coachId") Long coachId,
                        @Param("ageGroup") AgeGroup ageGroup,
                        @Param("search") String search,
                        Pageable pageable);
}
