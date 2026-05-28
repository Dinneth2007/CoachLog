package com.crick.player;

import java.time.LocalDateTime;

public record PlayerResponse(
        Long id,
        String name,
        AgeGroup ageGroup,
        String notes,
        LocalDateTime createdAt) {

    public static PlayerResponse from(Player p) {
        return new PlayerResponse(p.getId(), p.getName(), p.getAgeGroup(), p.getNotes(), p.getCreatedAt());
    }
}
