package com.crick.dashboard;

import com.crick.player.AgeGroup;
import com.crick.session.Category;
import java.time.LocalDate;
import java.util.List;

public record DashboardResponse(
        String coachName,
        StatsResponse stats,
        List<RecentSessionResponse> recentSessions,
        List<AttentionPlayerResponse> playersNeedingAttention) {

    public record StatsResponse(
            long totalPlayers,
            long totalSessions,
            long sessionsThisMonth,
            Long daysSinceLastSession) {}

    public record RecentSessionResponse(
            Long id,
            LocalDate date,
            String title,
            int playerCount) {}

    public record AttentionPlayerResponse(
            Long playerId,
            String playerName,
            AgeGroup ageGroup,
            String issue,
            Category category,
            String dimension,
            double avgScore,
            String trend) {}
}
