package com.crick.session;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record SessionSummaryResponse(
        Long id,
        LocalDate date,
        String title,
        int playerCount,
        LocalDateTime createdAt) {}
