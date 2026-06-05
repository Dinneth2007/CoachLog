package com.crick.embedding;

import com.crick.drill.Drill;
import com.crick.drill.DrillRepository;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class DrillEmbeddingService {

    private final DrillRepository drillRepository;
    private final EmbeddingService embeddingService;

    public int embedAll() {
        List<Drill> drills = drillRepository.findAll();
        for (Drill drill : drills) {
            drill.setEmbedding(embeddingService.getEmbedding(buildText(drill)));
        }
        drillRepository.saveAll(drills);
        return drills.size();
    }

    private static String buildText(Drill drill) {
        return "Skill area: " + drill.getSkillArea()
                + ". Target issue: " + drill.getTargetIssue().name().toLowerCase(Locale.ROOT)
                + ". Difficulty: " + drill.getDifficulty()
                + ". " + drill.getName() + " — " + drill.getDescription();
    }

}
