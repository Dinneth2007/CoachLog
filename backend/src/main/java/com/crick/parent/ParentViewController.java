package com.crick.parent;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/parent")
@RequiredArgsConstructor
public class ParentViewController {

    private final ParentService parentService;
    private final ParentViewRateLimiter rateLimiter;

    @GetMapping("/view/{token}")
    public ParentViewResponse view(@PathVariable String token) {
        if (!rateLimiter.allow(token)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many requests");
        }
        return parentService.getParentView(token);
    }
}
