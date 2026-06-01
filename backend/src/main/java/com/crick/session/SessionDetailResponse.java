package com.crick.session;

import com.crick.player.Player;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

public record SessionDetailResponse(
        Long id,
        LocalDate date,
        String title,
        String notes,
        LocalDateTime createdAt,
        List<PlayerObservationView> players) {

    public record PlayerObservationView(
            Long playerId,
            String playerName,
            String overallNotes,
            List<TechniqueScoreView> scores) {}

    public record TechniqueScoreView(
            Category category,
            TechniqueDimension dimension,
            int score,
            String notes) {}

    public static SessionDetailResponse from(Session session, List<PlayerObservation> observations) {
        Map<Long, PlayerObservation> byPlayerId = observations.stream()
                .collect(Collectors.toMap(o -> o.getPlayer().getId(), Function.identity()));

        List<PlayerObservationView> players = session.getPlayers().stream()
                .sorted(Comparator.comparing(Player::getName))
                .map(p -> {
                    PlayerObservation obs = byPlayerId.get(p.getId());
                    List<TechniqueScoreView> scores = obs == null
                            ? List.of()
                            : obs.getScores().stream()
                                    .map(s -> new TechniqueScoreView(
                                            s.getCategory(), s.getDimension(), s.getScore(), s.getNotes()))
                                    .toList();
                    return new PlayerObservationView(
                            p.getId(),
                            p.getName(),
                            obs != null ? obs.getOverallNotes() : null,
                            scores);
                })
                .toList();

        return new SessionDetailResponse(
                session.getId(),
                session.getDate(),
                session.getTitle(),
                session.getNotes(),
                session.getCreatedAt(),
                players);
    }
}
