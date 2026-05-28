package com.crick.player;

import com.crick.auth.CurrentUser;
import com.crick.auth.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/players")
@RequiredArgsConstructor
public class PlayerController {

    private final PlayerService playerService;

    @PostMapping
    public ResponseEntity<PlayerResponse> create(@CurrentUser User coach,
                                                 @Valid @RequestBody CreatePlayerRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(playerService.create(coach, req));
    }

    @GetMapping
    public Page<PlayerResponse> list(@CurrentUser User coach,
                                     @RequestParam(required = false) AgeGroup ageGroup,
                                     @RequestParam(required = false) String search,
                                     @PageableDefault(size = 20) Pageable pageable) {
        return playerService.list(coach.getId(), ageGroup, search, pageable);
    }

    @GetMapping("/{id}")
    public PlayerResponse get(@CurrentUser User coach, @PathVariable Long id) {
        return playerService.get(coach.getId(), id);
    }

    @PutMapping("/{id}")
    public PlayerResponse update(@CurrentUser User coach,
                                 @PathVariable Long id,
                                 @Valid @RequestBody CreatePlayerRequest req) {
        return playerService.update(coach.getId(), id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@CurrentUser User coach, @PathVariable Long id) {
        playerService.delete(coach.getId(), id);
        return ResponseEntity.noContent().build();
    }
}
