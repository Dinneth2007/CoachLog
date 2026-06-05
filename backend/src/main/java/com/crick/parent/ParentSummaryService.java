package com.crick.parent;

import com.crick.embedding.AiException;
import com.crick.player.Player;
import com.crick.recommendation.LlmService;
import com.crick.session.PlayerObservation;
import com.crick.session.PlayerObservationRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ParentSummaryService {

    private static final int CACHE_DAYS = 7;
    private static final int SESSION_WINDOW = 3;
    private static final String SYSTEM_PROMPT =
            "You are summarising a young cricketer's recent progress for their parent. "
                    + "Be encouraging, specific, and actionable. 3-4 sentences. Use the player's name.";

    private final ParentSummaryRepository summaryRepository;
    private final PlayerObservationRepository observationRepository;
    private final LlmService llmService;

    @Transactional
    public String getOrGenerateSummary(Player player) {
        Optional<ParentSummary> existing = summaryRepository.findByPlayerId(player.getId());
        if (existing.isPresent()
                && existing.get().getGeneratedAt().isAfter(LocalDateTime.now().minusDays(CACHE_DAYS))) {
            return existing.get().getSummary();
        }

        String userMessage = buildUserMessage(player);
        if (userMessage == null) {
            return existing.map(ParentSummary::getSummary).orElse(null);
        }

        String summary;
        try {
            summary = llmService.complete(SYSTEM_PROMPT, userMessage);
        } catch (AiException e) {
            return existing.map(ParentSummary::getSummary).orElse(null);
        }

        ParentSummary entity = existing.orElseGet(ParentSummary::new);
        entity.setPlayer(player);
        entity.setSummary(summary);
        entity.setGeneratedAt(LocalDateTime.now());
        summaryRepository.save(entity);
        return summary;
    }

    private String buildUserMessage(Player player) {
        List<PlayerObservation> all = observationRepository.findByPlayerIdWithScoresAndSession(player.getId());
        if (all.isEmpty()) {
            return null;
        }
        List<PlayerObservation> window = all.size() > SESSION_WINDOW
                ? all.subList(all.size() - SESSION_WINDOW, all.size())
                : all;

        StringBuilder sb = new StringBuilder();
        sb.append("Player: ").append(player.getName())
                .append(", age group ").append(player.getAgeGroup()).append(".\n");
        sb.append("Last ").append(window.size()).append(" sessions:\n");
        for (PlayerObservation observation : window) {
            sb.append("- ").append(observation.getSession().getDate())
                    .append(" ").append(observation.getSession().getTitle()).append(": ");
            String scores = observation.getScores().stream()
                    .map(s -> s.getDimension().name().toLowerCase(Locale.ROOT) + " " + s.getScore() + "/5")
                    .collect(Collectors.joining(", "));
            sb.append(scores).append("\n");
        }
        return sb.toString();
    }
}
