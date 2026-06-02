package com.crick.embedding;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/drills")
@RequiredArgsConstructor
public class AdminController {

    private final DrillEmbeddingService drillEmbeddingService;

    @PostMapping("/embed")
    public Map<String, Integer> embed() {
        return Map.of("embedded", drillEmbeddingService.embedAll());
    }
}
