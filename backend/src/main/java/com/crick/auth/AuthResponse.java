package com.crick.auth;

public record AuthResponse(String token, UserSummary user) {

    public record UserSummary(Long id, String email, String name) {}
}
