package com.crick.recommendation;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record LlmDrillRecommendation(Long drillId, String rationale, String expectedOutcome) {}
