package com.crick.recommendation;

import com.crick.common.BaseEntity;
import com.crick.drill.Drill;
import com.crick.player.Player;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "drill_recommendations")
@Getter
@Setter
@NoArgsConstructor
public class DrillRecommendation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "player_id", nullable = false)
    private Player player;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "drill_id", nullable = false)
    private Drill drill;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String rationale;

    @Column(name = "expected_outcome", columnDefinition = "TEXT", nullable = false)
    private String expectedOutcome;

    @Column(name = "similarity_score")
    private Double similarityScore;

    @Column(name = "is_current", nullable = false)
    private boolean isCurrent = true;

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt;
}
