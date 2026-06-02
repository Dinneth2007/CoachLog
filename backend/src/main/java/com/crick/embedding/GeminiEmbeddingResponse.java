package com.crick.embedding;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GeminiEmbeddingResponse(Embedding embedding) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Embedding(List<Double> values) {}
}
