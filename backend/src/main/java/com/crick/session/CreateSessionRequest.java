package com.crick.session;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record CreateSessionRequest(
        @NotNull LocalDate date,
        @NotBlank @Size(max = 100) String title,
        @Size(max = 500) String notes) {}

