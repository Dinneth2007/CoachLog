package com.crick.recommendation;

import com.crick.drill.DrillRepository;
import com.crick.embedding.AiException;
import com.crick.embedding.DrillMatch;
import com.crick.embedding.EmbeddingService;
import com.crick.player.Player;
import com.crick.player.PlayerRepository;
import jakarta.persistence.EntityNotFoundException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RecommendationService {

    private static final int TOP_K = 8;
    private static final int MAX_RECOMMENDATIONS = 5;
    private static final int CACHE_HOURS = 24;

    private final PlayerRepository playerRepository;
    private final DrillRecommendationRepository recommendationRepository;
    private final PlayerWeaknessProfileBuilder weaknessProfileBuilder;
    private final EmbeddingService embeddingService;
    private final LlmService llmService;
    private final DrillRepository drillRepository;

    @Transactional(readOnly = true)
    public RecommendationResponse getCurrent(Long coachId, Long playerId) {
        loadPlayer(coachId, playerId);
        return RecommendationResponse.from(playerId, recommendationRepository.findCurrentByPlayerId(playerId));
    }

    @Transactional
    public RecommendationResponse generate(Long coachId, Long playerId, boolean force) {
        Player player = loadPlayer(coachId, playerId);
        LocalDateTime now = LocalDateTime.now();

        List<DrillRecommendation> current = recommendationRepository.findCurrentByPlayerId(playerId);
        if (!force && !current.isEmpty()
                && current.get(0).getGeneratedAt().isAfter(now.minusHours(CACHE_HOURS))) {
            return RecommendationResponse.from(playerId, current);
        }

        String profile = weaknessProfileBuilder.build(player);
        List<DrillMatch> matches = embeddingService.findSimilarDrills(profile, TOP_K);
        List<LlmDrillRecommendation> picks = llmService.generateRecommendations(profile, matches);

        Set<Long> allowed = matches.stream().map(DrillMatch::drillId).collect(Collectors.toSet());
        List<LlmDrillRecommendation> valid = picks.stream()
                .filter(p -> p.drillId() != null && allowed.contains(p.drillId()))
                .collect(Collectors.collectingAndThen(
                        Collectors.toMap(LlmDrillRecommendation::drillId, p -> p, (a, b) -> a, LinkedHashMap::new),
                        m -> new ArrayList<>(m.values())));
        if (valid.isEmpty()) {
            throw new AiException("LLM returned no valid drill recommendations");
        }
        if (valid.size() > MAX_RECOMMENDATIONS) {
            valid = valid.subList(0, MAX_RECOMMENDATIONS);
        }

        Map<Long, Double> similarityById = matches.stream()
                .collect(Collectors.toMap(DrillMatch::drillId, DrillMatch::similarityScore));

        recommendationRepository.markAllNotCurrent(playerId);

        List<DrillRecommendation> toSave = valid.stream().map(pick -> {
            DrillRecommendation rec = new DrillRecommendation();
            rec.setPlayer(player);
            rec.setDrill(drillRepository.getReferenceById(pick.drillId()));
            rec.setRationale(pick.rationale());
            rec.setExpectedOutcome(pick.expectedOutcome());
            rec.setSimilarityScore(similarityById.get(pick.drillId()));
            rec.setCurrent(true);
            rec.setGeneratedAt(now);
            return rec;
        }).toList();
        recommendationRepository.saveAll(toSave);

        return RecommendationResponse.from(playerId, recommendationRepository.findCurrentByPlayerId(playerId));
    }

    private Player loadPlayer(Long coachId, Long playerId) {
        return playerRepository.findByIdAndCoachId(playerId, coachId)
                .orElseThrow(() -> new EntityNotFoundException("Player not found"));
    }
}
