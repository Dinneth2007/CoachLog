package com.crick.drill;

import com.crick.session.Category;
import com.crick.session.TechniqueDimension;
import java.util.Arrays;
import java.util.List;

public record DrillDetailResponse(
        Long id,
        String name,
        String description,
        Category skillArea,
        TechniqueDimension targetIssue,
        Difficulty difficulty,
        List<String> equipment,
        Integer ageMin,
        Integer ageMax,
        Integer durationMinutes,
        String videoUrl,
        String variations) {

    public static DrillDetailResponse from(Drill d) {
        List<String> equipment = (d.getEquipment() == null || d.getEquipment().isBlank())
                ? List.of()
                : Arrays.stream(d.getEquipment().split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList();
        return new DrillDetailResponse(
                d.getId(),
                d.getName(),
                d.getDescription(),
                d.getSkillArea(),
                d.getTargetIssue(),
                d.getDifficulty(),
                equipment,
                d.getAgeMin(),
                d.getAgeMax(),
                d.getDurationMinutes(),
                d.getVideoUrl(),
                d.getVariations());
    }
}
