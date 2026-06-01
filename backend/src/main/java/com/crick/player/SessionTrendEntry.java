package com.crick.player;

import com.crick.session.Category;
import com.crick.session.TechniqueDimension;
import java.time.LocalDate;
import java.util.List;

public record SessionTrendEntry(
        Long sessionId,
        LocalDate sessionDate,
        String sessionTitle,
        List<TrendScore> scores) {

    public record TrendScore(Category category, TechniqueDimension dimension, int score) {}
}
