package com.crick.embedding;

import com.crick.drill.Drill;

public record DrillMatch(Long drillId, Drill drill, double similarityScore) {}
