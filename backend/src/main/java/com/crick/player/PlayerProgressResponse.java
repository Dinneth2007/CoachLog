package com.crick.player;

import java.util.List;

public record PlayerProgressResponse(
        Long playerId,
        String playerName,
        AgeGroup ageGroup,
        List<SessionTrendEntry> trends) {}
