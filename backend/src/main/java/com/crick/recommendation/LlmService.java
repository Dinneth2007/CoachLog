package com.crick.recommendation;

import com.crick.config.AiConfig;
import com.crick.drill.Drill;
import com.crick.embedding.AiException;
import com.crick.embedding.DrillMatch;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
public class LlmService {

    private static final String SYSTEM_PROMPT = """
            You are a cricket coaching assistant. Given a player's recent technique observations and a set of \
            relevant drills retrieved for their weaknesses, recommend 3-5 drills that best target the player's \
            most consistent weaknesses.

            Rules:
            - Only recommend drills from the provided set. Reference them by their exact ID.
            - Prioritise dimensions where the player scores consistently low (1-2) or is declining.
            - Consider the player's age group — do not recommend drills outside their age range.
            - For each recommendation, explain WHY this drill addresses the observed weakness, citing specific \
            scores and coach notes.
            - Respond ONLY with a JSON array. No other text.

            Response format:
            [
              {
                "drillId": <number>,
                "rationale": "<why this drill targets the observed weakness, citing specific evidence>",
                "expectedOutcome": "<what improvement the coach should expect>"
              }
            ]
            """;

    private final AiConfig aiConfig;
    private final RestTemplate aiRestTemplate;
    private final ObjectMapper objectMapper;

    public List<LlmDrillRecommendation> generateRecommendations(String playerSummary, List<DrillMatch> retrieved) {
        String content = chat(SYSTEM_PROMPT, buildUserMessage(playerSummary, retrieved));
        try {
            return objectMapper.readValue(stripFences(content), new TypeReference<List<LlmDrillRecommendation>>() {});
        } catch (Exception e) {
            throw new AiException("Failed to parse AI response", e);
        }
    }

    public String complete(String systemPrompt, String userMessage) {
        return chat(systemPrompt, userMessage);
    }

    private String chat(String systemPrompt, String userMessage) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(aiConfig.getChatApiKey());

        var body = java.util.Map.of(
                "model", aiConfig.getChatModel(),
                "messages", List.of(
                        java.util.Map.of("role", "system", "content", systemPrompt),
                        java.util.Map.of("role", "user", "content", userMessage)),
                "temperature", 0.3);

        try {
            ResponseEntity<DeepSeekResponse> response = aiRestTemplate.exchange(
                    aiConfig.getChatApiUrl(), HttpMethod.POST,
                    new HttpEntity<>(body, headers), DeepSeekResponse.class);
            DeepSeekResponse parsed = response.getBody();
            if (parsed == null || parsed.choices() == null || parsed.choices().isEmpty()
                    || parsed.choices().get(0).message() == null) {
                throw new AiException("AI chat returned no choices");
            }
            return parsed.choices().get(0).message().content();
        } catch (RestClientException e) {
            throw new AiException("AI chat request failed", e);
        }
    }

    private static String buildUserMessage(String playerSummary, List<DrillMatch> retrieved) {
        StringBuilder sb = new StringBuilder();
        sb.append(playerSummary).append("\n\nRetrieved drills:\n");
        for (DrillMatch match : retrieved) {
            Drill d = match.drill();
            sb.append("- ID ").append(d.getId())
                    .append(": ").append(d.getName())
                    .append(" | skill area: ").append(d.getSkillArea())
                    .append(" | target issue: ").append(d.getTargetIssue().name().toLowerCase(Locale.ROOT))
                    .append(" | difficulty: ").append(d.getDifficulty())
                    .append(" | age ").append(d.getAgeMin()).append("-").append(d.getAgeMax())
                    .append("\n  ").append(d.getDescription()).append("\n");
        }
        return sb.toString();
    }

    private static String stripFences(String raw) {
        String text = raw.strip();
        if (text.startsWith("```")) {
            int firstNewline = text.indexOf('\n');
            if (firstNewline >= 0) {
                text = text.substring(firstNewline + 1);
            }
            if (text.endsWith("```")) {
                text = text.substring(0, text.length() - 3);
            }
        }
        return text.strip();
    }
}
