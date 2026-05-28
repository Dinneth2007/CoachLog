package com.crick.player;

import com.crick.auth.User;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class PlayerService {

    private final PlayerRepository playerRepository;

    public PlayerResponse create(User coach, CreatePlayerRequest req) {
        Player p = new Player();
        apply(p, req);
        p.setCoach(coach);
        return PlayerResponse.from(playerRepository.save(p));
    }

    @Transactional(readOnly = true)
    public Page<PlayerResponse> list(Long coachId, AgeGroup ageGroup, String search, Pageable pageable) {
        String s = (search == null || search.isBlank()) ? null : search.trim();
        return playerRepository.search(coachId, ageGroup, s, pageable).map(PlayerResponse::from);
    }

    @Transactional(readOnly = true)
    public PlayerResponse get(Long coachId, Long playerId) {
        return PlayerResponse.from(load(coachId, playerId));
    }

    public PlayerResponse update(Long coachId, Long playerId, CreatePlayerRequest req) {
        Player p = load(coachId, playerId);
        apply(p, req);
        return PlayerResponse.from(playerRepository.save(p));
    }

    public void delete(Long coachId, Long playerId) {
        playerRepository.delete(load(coachId, playerId));
    }

    private Player load(Long coachId, Long playerId) {
        return playerRepository.findByIdAndCoachId(playerId, coachId)
                .orElseThrow(() -> new EntityNotFoundException("Player not found"));
    }

    private static void apply(Player p, CreatePlayerRequest req) {
        p.setName(req.name().trim());
        p.setAgeGroup(req.ageGroup());
        p.setNotes(req.notes() != null ? req.notes().trim() : null);
    }
}
