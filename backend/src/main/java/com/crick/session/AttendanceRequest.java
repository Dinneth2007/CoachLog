package com.crick.session;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record AttendanceRequest(
        @NotNull @Size(max = 100) List<@NotNull Long> playerIds) {}
