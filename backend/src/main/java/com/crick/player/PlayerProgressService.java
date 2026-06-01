package com.crick.player;

import com.crick.session.PlayerObservation;
import com.crick.session.PlayerObservationRepository;
import com.crick.session.TechniqueScore;
import jakarta.persistence.EntityNotFoundException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PlayerProgressService {

    private final PlayerRepository playerRepository;
    private final PlayerObservationRepository observationRepository;

    public PlayerProgressResponse getProgress(Long coachId, Long playerId) {
        Player player = loadPlayer(coachId, playerId);
        List<PlayerObservation> observations = observationRepository.findByPlayerIdWithScoresAndSession(playerId);
        List<SessionTrendEntry> trends = observations.stream()
                .map(o -> new SessionTrendEntry(
                        o.getSession().getId(),
                        o.getSession().getDate(),
                        o.getSession().getTitle(),
                        toTrendScores(o.getScores())))
                .toList();
        return new PlayerProgressResponse(
                player.getId(), player.getName(), player.getAgeGroup(), trends);
    }

    public Page<ObservationHistoryResponse> getObservations(Long coachId, Long playerId, Pageable pageable) {
        loadPlayer(coachId, playerId);
        Pageable safe = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
        Page<PlayerObservation> page = observationRepository.findPageByPlayerId(playerId, safe);
        List<Long> ids = page.getContent().stream().map(PlayerObservation::getId).toList();
        Map<Long, List<TechniqueScore>> scoresById = ids.isEmpty()
                ? Map.of()
                : observationRepository.findWithScoresByIdIn(ids).stream()
                        .collect(Collectors.toMap(PlayerObservation::getId, PlayerObservation::getScores));
        return page.map(o -> {
            List<TechniqueScore> scores = scoresById.getOrDefault(o.getId(), List.of());
            return new ObservationHistoryResponse(
                    o.getId(),
                    o.getSession().getId(),
                    o.getSession().getDate(),
                    o.getSession().getTitle(),
                    o.getOverallNotes(),
                    toHistoryScores(scores));
        });
    }

    private Player loadPlayer(Long coachId, Long playerId) {
        return playerRepository.findByIdAndCoachId(playerId, coachId)
                .orElseThrow(() -> new EntityNotFoundException("Player not found"));
    }

    private static List<SessionTrendEntry.TrendScore> toTrendScores(List<TechniqueScore> scores) {
        return scores.stream()
                .sorted(Comparator
                        .comparing((TechniqueScore s) -> s.getCategory().ordinal())
                        .thenComparing(s -> s.getDimension().ordinal()))
                .map(s -> new SessionTrendEntry.TrendScore(s.getCategory(), s.getDimension(), s.getScore()))
                .toList();
    }

    private static List<ObservationHistoryResponse.HistoryScore> toHistoryScores(List<TechniqueScore> scores) {
        return scores.stream()
                .sorted(Comparator
                        .comparing((TechniqueScore s) -> s.getCategory().ordinal())
                        .thenComparing(s -> s.getDimension().ordinal()))
                .map(s -> new ObservationHistoryResponse.HistoryScore(
                        s.getCategory(), s.getDimension(), s.getScore(), s.getNotes()))
                .toList();
    }
}
