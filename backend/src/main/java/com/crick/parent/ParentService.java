package com.crick.parent;

import com.crick.player.Player;
import com.crick.player.PlayerProgressResponse;
import com.crick.player.PlayerProgressService;
import com.crick.player.PlayerRepository;
import com.crick.player.SessionTrendEntry;
import com.crick.recommendation.DrillRecommendationRepository;
import com.crick.recommendation.RecommendationResponse;
import jakarta.persistence.EntityNotFoundException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ParentService {

    private static final int LINK_VALIDITY_DAYS = 30;
    private static final int RECENT_SESSIONS = 5;

    @Value("${parent.link.base-url}")
    private String baseUrl;

    private final PlayerRepository playerRepository;
    private final ParentAccessTokenRepository tokenRepository;
    private final PlayerProgressService playerProgressService;
    private final DrillRecommendationRepository recommendationRepository;
    private final ParentSummaryService parentSummaryService;

    @Transactional
    public ParentLinkResponse generateLink(Long playerId, Long coachId) {
        Player player = loadPlayer(playerId, coachId);
        String rawToken = UUID.randomUUID().toString();
        ParentAccessToken token = new ParentAccessToken();
        token.setPlayer(player);
        token.setTokenHash(sha256Hex(rawToken));
        token.setExpiresAt(LocalDateTime.now().plusDays(LINK_VALIDITY_DAYS));
        tokenRepository.save(token);
        return new ParentLinkResponse(rawToken, baseUrl + "/" + rawToken, token.getExpiresAt(), player.getName());
    }

    @Transactional(readOnly = true)
    public List<ParentLinkSummary> getActiveLinks(Long playerId, Long coachId) {
        loadPlayer(playerId, coachId);
        return tokenRepository.findByPlayerIdAndExpiresAtAfter(playerId, LocalDateTime.now()).stream()
                .map(t -> new ParentLinkSummary(t.getId(), t.getExpiresAt(), t.getCreatedAt()))
                .toList();
    }

    @Transactional
    public void revokeLink(Long linkId, Long coachId) {
        ParentAccessToken token = tokenRepository.findByIdAndPlayerCoachId(linkId, coachId)
                .orElseThrow(() -> new EntityNotFoundException("Link not found"));
        tokenRepository.delete(token);
    }

    @Transactional
    public ParentViewResponse getParentView(String rawToken) {
        ParentAccessToken token = tokenRepository.findByTokenHash(sha256Hex(rawToken))
                .filter(t -> t.getExpiresAt().isAfter(LocalDateTime.now()))
                .orElseThrow(() -> new EntityNotFoundException("Link not found or expired"));

        Player player = token.getPlayer();
        PlayerProgressResponse progress =
                playerProgressService.getProgress(player.getCoach().getId(), player.getId());
        List<SessionTrendEntry> trends = progress.trends();
        List<RecommendationResponse.Item> recommendations = RecommendationResponse
                .from(player.getId(), recommendationRepository.findCurrentByPlayerId(player.getId()))
                .recommendations();
        String weeklySummary = parentSummaryService.getOrGenerateSummary(player);

        return new ParentViewResponse(
                player.getName(),
                player.getAgeGroup(),
                player.getCoach().getName(),
                weeklySummary,
                trends,
                recentObservations(trends),
                recommendations);
    }

    private Player loadPlayer(Long playerId, Long coachId) {
        return playerRepository.findByIdAndCoachId(playerId, coachId)
                .orElseThrow(() -> new EntityNotFoundException("Player not found"));
    }

    private static List<SessionTrendEntry> recentObservations(List<SessionTrendEntry> trends) {
        int from = Math.max(0, trends.size() - RECENT_SESSIONS);
        List<SessionTrendEntry> recent = new ArrayList<>(trends.subList(from, trends.size()));
        Collections.reverse(recent);
        return recent;
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
