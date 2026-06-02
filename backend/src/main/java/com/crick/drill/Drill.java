package com.crick.drill;

import com.crick.common.BaseEntity;
import com.crick.session.Category;
import com.crick.session.TechniqueDimension;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "drills")
@Getter
@Setter
@NoArgsConstructor
public class Drill extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "skill_area", nullable = false, length = 20)
    private Category skillArea;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_issue", nullable = false, length = 30)
    private TechniqueDimension targetIssue;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private Difficulty difficulty;

    @Column(length = 500)
    private String equipment;

    @Column(name = "age_min")
    private Integer ageMin;

    @Column(name = "age_max")
    private Integer ageMax;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(name = "video_url", length = 500)
    private String videoUrl;

    @Column(columnDefinition = "TEXT")
    private String variations;

    @Column(columnDefinition = "LONGTEXT")
    @Convert(converter = DrillEmbeddingConverter.class)
    private List<Double> embedding;
}
