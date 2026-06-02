package com.crick.recommendation;

import com.crick.auth.CurrentUser;
import com.crick.auth.User;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/players")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationService recommendationService;

    @PostMapping("/{id}/recommendations/generate")
    public RecommendationResponse generate(@CurrentUser User coach,
                                           @PathVariable Long id,
                                           @RequestParam(defaultValue = "false") boolean force) {
        return recommendationService.generate(coach.getId(), id, force);
    }

    @GetMapping("/{id}/recommendations")
    public RecommendationResponse get(@CurrentUser User coach, @PathVariable Long id) {
        return recommendationService.getCurrent(coach.getId(), id);
    }
}
