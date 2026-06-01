package com.crick.session;

import com.crick.player.AgeGroup;
import java.util.List;

public record AttendanceResponse(List<PlayerSummary> players) {

    public record PlayerSummary(Long id, String name, AgeGroup ageGroup) {}
}
