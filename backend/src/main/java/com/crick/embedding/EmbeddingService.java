package com.crick.embedding;

import com.crick.config.AiConfig;
import com.crick.drill.DrillRepository;
import java.net.URI;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Service
@RequiredArgsConstructor
public class EmbeddingService {

    private final AiConfig aiConfig;
    private final RestTemplate aiRestTemplate;
    private final DrillRepository drillRepository;

    public List<Double> getEmbedding(String text) {
        URI uri = UriComponentsBuilder
                .fromHttpUrl(aiConfig.getEmbeddingApiUrl() + "/models/gemini-embedding-001:embedContent")
                .queryParam("key", aiConfig.getEmbeddingApiKey())
                .encode()
                .build()
                .toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> body = Map.of(
                "content", Map.of("parts", List.of(Map.of("text", text))));

        GeminiEmbeddingResponse parsed;
        try {
            ResponseEntity<GeminiEmbeddingResponse> response = aiRestTemplate.exchange(
                    uri, HttpMethod.POST, new HttpEntity<>(body, headers), GeminiEmbeddingResponse.class);
            parsed = response.getBody();
        } catch (RestClientException e) {
            throw new AiException("Embedding request failed", e);
        }

        if (parsed == null || parsed.embedding() == null
                || parsed.embedding().values() == null || parsed.embedding().values().isEmpty()) {
            throw new AiException("Embedding request returned no vector");
        }
        return parsed.embedding().values();
    }

    public double cosineSimilarity(List<Double> a, List<Double> b) {
        if (a.size() != b.size()) {
            throw new IllegalArgumentException("Embedding dimension mismatch — re-run /api/admin/drills/embed");
        }
        double dot = 0;
        double magA = 0;
        double magB = 0;
        for (int i = 0; i < a.size(); i++) {
            double x = a.get(i);
            double y = b.get(i);
            dot += x * y;
            magA += x * x;
            magB += y * y;
        }
        if (magA == 0 || magB == 0) {
            return 0;
        }
        return dot / (Math.sqrt(magA) * Math.sqrt(magB));
    }

    public List<DrillMatch> findSimilarDrills(String queryText, int topK) {
        var drills = drillRepository.findAllByEmbeddingIsNotNull();
        if (drills.isEmpty()) {
            throw new AiException("No embedded drills found — run /api/admin/drills/embed first");
        }
        List<Double> query = getEmbedding(queryText);
        return drills.stream()
                .map(d -> new DrillMatch(d.getId(), d, cosineSimilarity(query, d.getEmbedding())))
                .sorted(Comparator.comparingDouble(DrillMatch::similarityScore).reversed())
                .limit(topK)
                .toList();
    }
}
