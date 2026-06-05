package com.crick.parent;

import com.crick.player.AgeGroup;
import com.crick.player.SessionTrendEntry;
import com.crick.recommendation.RecommendationResponse;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ParentViewResponse(
        String playerName,
        AgeGroup ageGroup,
        String coachName,
        String weeklySummary,
        List<SessionTrendEntry> trends,
        List<SessionTrendEntry> recentObservations,
        List<RecommendationResponse.Item> recommendations) {}
