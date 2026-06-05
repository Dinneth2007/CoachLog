package com.crick.parent;

import com.crick.auth.CurrentUser;
import com.crick.auth.User;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class ParentLinkController {

    private final ParentService parentService;

    @PostMapping("/api/players/{id}/parent-link")
    @ResponseStatus(HttpStatus.CREATED)
    public ParentLinkResponse generate(@CurrentUser User coach, @PathVariable Long id) {
        return parentService.generateLink(id, coach.getId());
    }

    @GetMapping("/api/players/{id}/parent-links")
    public List<ParentLinkSummary> list(@CurrentUser User coach, @PathVariable Long id) {
        return parentService.getActiveLinks(id, coach.getId());
    }

    @DeleteMapping("/api/parent-links/{linkId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@CurrentUser User coach, @PathVariable Long linkId) {
        parentService.revokeLink(linkId, coach.getId());
    }
}
