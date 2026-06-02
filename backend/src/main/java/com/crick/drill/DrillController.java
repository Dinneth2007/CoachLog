package com.crick.drill;

import com.crick.player.AgeGroup;
import com.crick.session.Category;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/drills")
@RequiredArgsConstructor
public class DrillController {

    private final DrillService drillService;

    @GetMapping
    public Page<DrillSummaryResponse> list(@RequestParam(required = false) Category skillArea,
                                           @RequestParam(required = false) Difficulty difficulty,
                                           @RequestParam(required = false) AgeGroup ageGroup,
                                           @RequestParam(required = false) String search,
                                           @PageableDefault(size = 20) Pageable pageable) {
        return drillService.list(skillArea, difficulty, ageGroup, search, pageable);
    }

    @GetMapping("/{id}")
    public DrillDetailResponse get(@PathVariable Long id) {
        return drillService.get(id);
    }
}
