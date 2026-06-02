package com.crick.drill;

import com.crick.player.AgeGroup;
import com.crick.session.Category;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DrillService {

    private final DrillRepository drillRepository;

    public Page<DrillSummaryResponse> list(Category skillArea,
                                           Difficulty difficulty,
                                           AgeGroup ageGroup,
                                           String search,
                                           Pageable pageable) {
        Integer ageCap = (ageGroup == null || ageGroup == AgeGroup.OPEN) ? null : upperBound(ageGroup);
        String s = (search == null || search.isBlank()) ? null : search.trim();
        Pageable safe = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
        return drillRepository.search(skillArea, difficulty, ageCap, s, safe).map(DrillSummaryResponse::from);
    }

    public DrillDetailResponse get(Long id) {
        Drill d = drillRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Drill not found"));
        return DrillDetailResponse.from(d);
    }

    private static int upperBound(AgeGroup ag) {
        return switch (ag) {
            case U11 -> 11;
            case U13 -> 13;
            case U15 -> 15;
            case U17 -> 17;
            case OPEN -> Integer.MAX_VALUE;
        };
    }
}
