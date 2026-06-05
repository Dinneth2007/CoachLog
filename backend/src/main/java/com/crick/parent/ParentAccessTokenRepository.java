package com.crick.parent;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ParentAccessTokenRepository extends JpaRepository<ParentAccessToken, Long> {

    Optional<ParentAccessToken> findByTokenHash(String tokenHash);

    List<ParentAccessToken> findByPlayerIdAndExpiresAtAfter(Long playerId, LocalDateTime now);

    Optional<ParentAccessToken> findByIdAndPlayerCoachId(Long id, Long coachId);
}
