package com.crick.recommendation;

import com.crick.player.Player;
import com.crick.session.PlayerObservation;
import com.crick.session.PlayerObservationRepository;
import com.crick.session.TechniqueDimension;
import com.crick.session.TechniqueScore;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlayerWeaknessProfileBuilder {

    private static final int WINDOW = 5;
    private static final int MAX_DIMENSIONS = 5;
    private static final int MAX_NOTES = 6;
    private static final double WEAKNESS_THRESHOLD = 3.0;
    private static final double TREND_DELTA = 0.25;

    private final PlayerObservationRepository observationRepository;

    public String build(Player player) {
        List<PlayerObservation> all = observationRepository.findByPlayerIdWithScoresAndSession(player.getId());
        if (all.isEmpty()) {
            throw new IllegalStateException("Player has no observations");
        }
        List<PlayerObservation> window = all.size() > WINDOW
                ? all.subList(all.size() - WINDOW, all.size())
                : all;

        Map<TechniqueDimension, List<Integer>> byDimension = new LinkedHashMap<>();
        for (PlayerObservation observation : window) {
            for (TechniqueScore score : observation.getScores()) {
                byDimension.computeIfAbsent(score.getDimension(), k -> new ArrayList<>()).add(score.getScore());
            }
        }

        List<DimensionSummary> weakest = byDimension.entrySet().stream()
                .map(e -> new DimensionSummary(e.getKey(), average(e.getValue()), trend(e.getValue())))
                .filter(s -> s.average() <= WEAKNESS_THRESHOLD)
                .sorted(Comparator.comparingDouble(DimensionSummary::average))
                .limit(MAX_DIMENSIONS)
                .toList();

        List<String> notes = collectNotes(window);

        return assemble(player, weakest, notes);
    }

    private static List<String> collectNotes(List<PlayerObservation> window) {
        List<String> notes = new ArrayList<>();
        for (PlayerObservation observation : window) {
            if (isPresent(observation.getOverallNotes())) {
                notes.add(observation.getOverallNotes().trim());
            }
            for (TechniqueScore score : observation.getScores()) {
                if (isPresent(score.getNotes())) {
                    notes.add(score.getNotes().trim());
                }
            }
        }
        return notes.size() > MAX_NOTES ? notes.subList(0, MAX_NOTES) : notes;
    }

    private static String assemble(Player player, List<DimensionSummary> weakest, List<String> notes) {
        StringBuilder sb = new StringBuilder();
        sb.append("Player: ").append(player.getName())
                .append(", Age group: ").append(player.getAgeGroup()).append(".\n");

        String weakestText = weakest.stream()
                .map(s -> s.dimension().category() + " " + dimensionName(s.dimension())
                        + " (avg " + formatScore(s.average()) + ", " + s.trend() + ")")
                .collect(Collectors.joining(", "));
        sb.append("Weakest dimensions: ").append(weakestText.isBlank() ? "none" : weakestText).append(".\n");

        if (!notes.isEmpty()) {
            String notesText = notes.stream().map(n -> "'" + n + "'").collect(Collectors.joining(", "));
            sb.append("Coach notes: ").append(notesText).append(".\n");
        }

        String focus = weakest.stream()
                .map(s -> dimensionName(s.dimension()))
                .collect(Collectors.joining(", "));
        sb.append("Focus areas: ").append(focus.isBlank() ? "general technique" : focus).append(".");

        return sb.toString();
    }

    private String trend(List<Integer> values) {
        if (values.size() < 4) {
            return "stable";
        }
        int half = values.size() / 2;
        double earlier = average(values.subList(0, half));
        double later = average(values.subList(values.size() - half, values.size()));
        double delta = later - earlier;
        if (delta >= TREND_DELTA) {
            return "improving";
        }
        if (delta <= -TREND_DELTA) {
            return "declining";
        }
        return "stable";
    }

    private static double average(List<Integer> values) {
        return values.stream().mapToInt(Integer::intValue).average().orElse(0);
    }

    private static boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }

    private static String dimensionName(TechniqueDimension dimension) {
        return dimension.name().toLowerCase(Locale.ROOT);
    }

    private static String formatScore(double value) {
        return String.format(Locale.ROOT, "%.1f", value);
    }

    private record DimensionSummary(TechniqueDimension dimension, double average, String trend) {}
}
