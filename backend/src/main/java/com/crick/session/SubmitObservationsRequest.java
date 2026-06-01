package com.crick.session;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record SubmitObservationsRequest(
        @NotNull @Valid List<@Valid ObservationItem> observations) {

    public record ObservationItem(
            @NotNull Long playerId,
            @Size(max = 500) String overallNotes,
            @NotNull @Valid List<@Valid ScoreItem> scores) {}

    public record ScoreItem(
            @NotNull Category category,
            @NotNull TechniqueDimension dimension,
            @NotNull @Min(1) @Max(5) Integer score,
            @Size(max = 500) String notes) {}
}
