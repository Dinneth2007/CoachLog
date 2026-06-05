package com.crick.parent;

import com.crick.common.BaseEntity;
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
@Table(name = "parent_summaries")
@Getter
@Setter
@NoArgsConstructor
public class ParentSummary extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "player_id", nullable = false, unique = true)
    private Player player;

    @Column(columnDefinition = "TEXT")
    private String summary;

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt;
}
