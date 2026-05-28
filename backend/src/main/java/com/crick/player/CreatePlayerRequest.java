package com.crick.player;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreatePlayerRequest(
        @NotBlank @Size(max = 100) String name,
        @NotNull AgeGroup ageGroup,
        @Size(max = 500) String notes) {}
