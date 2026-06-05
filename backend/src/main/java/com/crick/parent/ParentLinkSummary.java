package com.crick.parent;

import java.time.LocalDateTime;

public record ParentLinkSummary(Long id, LocalDateTime expiresAt, LocalDateTime createdAt) {}
