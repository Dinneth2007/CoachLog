package com.crick.recommendation;

import com.crick.session.Category;
import java.time.LocalDateTime;
import java.util.List;

public record RecommendationResponse(Long playerId, LocalDateTime generatedAt, List<Item> recommendations) {

    public record Item(Long drillId, String drillName, Category skillArea,
                       String rationale, String expectedOutcome, Double similarityScore) {}

    public static RecommendationResponse from(Long playerId, List<DrillRecommendation> recs) {
        List<Item> items = recs.stream()
                .map(r -> new Item(
                        r.getDrill().getId(),
                        r.getDrill().getName(),
                        r.getDrill().getSkillArea(),
                        r.getRationale(),
                        r.getExpectedOutcome(),
                        r.getSimilarityScore()))
                .toList();
        LocalDateTime generatedAt = recs.isEmpty() ? null : recs.get(0).getGeneratedAt();
        return new RecommendationResponse(playerId, generatedAt, items);
    }
}
