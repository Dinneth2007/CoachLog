package com.crick.drill;

import com.crick.session.Category;
import com.crick.session.TechniqueDimension;

public record DrillSummaryResponse(
        Long id,
        String name,
        Category skillArea,
        TechniqueDimension targetIssue,
        Difficulty difficulty,
        Integer durationMinutes) {

    public static DrillSummaryResponse from(Drill d) {
        return new DrillSummaryResponse(
                d.getId(),
                d.getName(),
                d.getSkillArea(),
                d.getTargetIssue(),
                d.getDifficulty(),
                d.getDurationMinutes());
    }
}
