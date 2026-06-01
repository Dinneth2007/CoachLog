package com.crick.player;

import com.crick.session.Category;
import com.crick.session.TechniqueDimension;
import java.time.LocalDate;
import java.util.List;

public record ObservationHistoryResponse(
        Long observationId,
        Long sessionId,
        LocalDate sessionDate,
        String sessionTitle,
        String overallNotes,
        List<HistoryScore> scores) {

    public record HistoryScore(
            Category category,
            TechniqueDimension dimension,
            int score,
            String notes) {}
}
