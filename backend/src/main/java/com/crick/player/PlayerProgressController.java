package com.crick.player;

import com.crick.auth.CurrentUser;
import com.crick.auth.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/players")
@RequiredArgsConstructor
public class PlayerProgressController {

    private final PlayerProgressService playerProgressService;

    @GetMapping("/{id}/progress")
    public PlayerProgressResponse getProgress(@CurrentUser User coach, @PathVariable Long id) {
        return playerProgressService.getProgress(coach.getId(), id);
    }

    @GetMapping("/{id}/observations")
    public Page<ObservationHistoryResponse> getObservations(@CurrentUser User coach,
                                                            @PathVariable Long id,
                                                            @PageableDefault(size = 20) Pageable pageable) {
        return playerProgressService.getObservations(coach.getId(), id, pageable);
    }
}
