package com.crick.session;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record SessionResponse(
        Long id,
        LocalDate date,
        String title,
        String notes,
        LocalDateTime createdAt) {

    public static SessionResponse from(Session s) {
        return new SessionResponse(s.getId(), s.getDate(), s.getTitle(), s.getNotes(), s.getCreatedAt());
    }
}
