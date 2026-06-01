package com.crick.session;

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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    @PostMapping
    public ResponseEntity<SessionResponse> create(@CurrentUser User coach,
                                                  @Valid @RequestBody CreateSessionRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(sessionService.create(coach, req));
    }

    @GetMapping
    public Page<SessionSummaryResponse> list(@CurrentUser User coach,
                                             @PageableDefault(size = 20) Pageable pageable) {
        return sessionService.list(coach.getId(), pageable);
    }

    @GetMapping("/{id}")
    public SessionDetailResponse get(@CurrentUser User coach, @PathVariable Long id) {
        return sessionService.getDetail(coach.getId(), id);
    }

    @PutMapping("/{id}/attendance")
    public AttendanceResponse setAttendance(@CurrentUser User coach,
                                            @PathVariable Long id,
                                            @Valid @RequestBody AttendanceRequest req) {
        return sessionService.setAttendance(coach.getId(), id, req);
    }

    @PostMapping("/{id}/observations")
    public SubmitObservationsResponse submitObservations(@CurrentUser User coach,
                                                         @PathVariable Long id,
                                                         @Valid @RequestBody SubmitObservationsRequest req) {
        return sessionService.submitObservations(coach.getId(), id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@CurrentUser User coach, @PathVariable Long id) {
        sessionService.delete(coach.getId(), id);
        return ResponseEntity.noContent().build();
    }
}
