package com.crick.dashboard;

import com.crick.auth.User;
import com.crick.dashboard.DashboardResponse.AttentionPlayerResponse;
import com.crick.dashboard.DashboardResponse.RecentSessionResponse;
import com.crick.dashboard.DashboardResponse.StatsResponse;
import com.crick.player.Player;
import com.crick.player.PlayerRepository;
import com.crick.session.PlayerObservation;
import com.crick.session.PlayerObservationRepository;
import com.crick.session.SessionRepository;
import com.crick.session.SessionSummaryResponse;
import com.crick.session.TechniqueDimension;
import com.crick.session.TechniqueScore;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {

    private static final int RECENT_SESSIONS = 5;
    private static final int ATTENTION_WINDOW = 3;
    private static final int MAX_ATTENTION = 5;
    private static final double LOW_THRESHOLD = 2.0;
    private static final double DECLINE_THRESHOLD = 3.0;

    private final PlayerRepository playerRepository;
    private final SessionRepository sessionRepository;
    private final PlayerObservationRepository observationRepository;

    public DashboardResponse getDashboard(User coach) {
        Long coachId = coach.getId();

        List<RecentSessionResponse> recentSessions = sessionRepository
                .findSummariesByCoachId(coachId, PageRequest.of(0, RECENT_SESSIONS))
                .getContent().stream()
                .map(DashboardService::toRecentSession)
                .toList();

        LocalDate today = LocalDate.now();
        long sessionsThisMonth = sessionRepository.countByCoachIdAndDateBetween(
                coachId, today.withDayOfMonth(1), today.withDayOfMonth(today.lengthOfMonth()));
        Long daysSinceLastSession = recentSessions.isEmpty()
                ? null
                : Math.max(0, ChronoUnit.DAYS.between(recentSessions.get(0).date(), today));

        StatsResponse stats = new StatsResponse(
                playerRepository.countByCoachId(coachId),
                sessionRepository.countByCoachId(coachId),
                sessionsThisMonth,
                daysSinceLastSession);

        return new DashboardResponse(coach.getName(), stats, recentSessions, computeAttention(coachId));
    }

    private List<AttentionPlayerResponse> computeAttention(Long coachId) {
        Map<Long, List<PlayerObservation>> byPlayer = observationRepository
                .findByCoachIdWithScoresAndSession(coachId).stream()
                .collect(Collectors.groupingBy(o -> o.getPlayer().getId(), LinkedHashMap::new, Collectors.toList()));

        List<AttentionPlayerResponse> flagged = new ArrayList<>();
        for (List<PlayerObservation> playerObs : byPlayer.values()) {
            List<PlayerObservation> window = playerObs.size() > ATTENTION_WINDOW
                    ? playerObs.subList(playerObs.size() - ATTENTION_WINDOW, playerObs.size())
                    : playerObs;
            toAttention(window).ifPresent(flagged::add);
        }

        return flagged.stream()
                .sorted(Comparator.comparingDouble(AttentionPlayerResponse::avgScore))
                .limit(MAX_ATTENTION)
                .toList();
    }

    private static java.util.Optional<AttentionPlayerResponse> toAttention(List<PlayerObservation> window) {
        Map<TechniqueDimension, List<Integer>> byDimension = new LinkedHashMap<>();
        for (PlayerObservation observation : window) {
            for (TechniqueScore score : observation.getScores()) {
                byDimension.computeIfAbsent(score.getDimension(), k -> new ArrayList<>()).add(score.getScore());
            }
        }

        AttentionPlayerResponse worst = null;
        for (Map.Entry<TechniqueDimension, List<Integer>> entry : byDimension.entrySet()) {
            List<Integer> scores = entry.getValue();
            double avg = scores.stream().mapToInt(Integer::intValue).average().orElse(0);
            boolean declining = scores.get(scores.size() - 1) < scores.get(0);
            boolean flagged = avg <= LOW_THRESHOLD || (declining && avg <= DECLINE_THRESHOLD);
            if (!flagged) {
                continue;
            }
            if (worst == null || avg < worst.avgScore()) {
                worst = build(window.get(0).getPlayer(), entry.getKey(), scores, avg, declining, window.size());
            }
        }
        return java.util.Optional.ofNullable(worst);
    }

    private static AttentionPlayerResponse build(Player player, TechniqueDimension dimension,
                                                 List<Integer> scores, double avg, boolean declining, int windowSize) {
        double rounded = Math.round(avg * 10) / 10.0;
        String dimensionName = dimension.name().toLowerCase(Locale.ROOT);
        String trend = trend(scores);
        String state = declining ? "declining" : "consistently low";
        String issue = dimension.category() + " " + dimensionName + " " + state
                + " (avg " + String.format(Locale.ROOT, "%.1f", rounded)
                + " over last " + windowSize + (windowSize == 1 ? " session)" : " sessions)");
        return new AttentionPlayerResponse(
                player.getId(), player.getName(), player.getAgeGroup(),
                issue, dimension.category(), dimensionName, rounded, trend);
    }

    private static String trend(List<Integer> scores) {
        int first = scores.get(0);
        int last = scores.get(scores.size() - 1);
        if (last < first) {
            return "DECLINING";
        }
        if (last > first) {
            return "IMPROVING";
        }
        return "STABLE";
    }

    private static RecentSessionResponse toRecentSession(SessionSummaryResponse s) {
        return new RecentSessionResponse(s.id(), s.date(), s.title(), s.playerCount());
    }
}
