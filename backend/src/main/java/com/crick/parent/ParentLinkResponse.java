package com.crick.parent;

import java.time.LocalDateTime;

public record ParentLinkResponse(String token, String url, LocalDateTime expiresAt, String playerName) {}
