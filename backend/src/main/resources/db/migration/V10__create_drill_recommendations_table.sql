CREATE TABLE drill_recommendations (
    id               BIGINT      NOT NULL AUTO_INCREMENT,
    player_id        BIGINT      NOT NULL,
    drill_id         BIGINT      NOT NULL,
    rationale        TEXT        NOT NULL,
    expected_outcome TEXT        NOT NULL,
    similarity_score DOUBLE,
    is_current       BOOLEAN     NOT NULL DEFAULT TRUE,
    generated_at     TIMESTAMP   NOT NULL,
    created_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_drill_recs_player_current (player_id, is_current),
    CONSTRAINT fk_drill_recs_player
        FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
    CONSTRAINT fk_drill_recs_drill
        FOREIGN KEY (drill_id)  REFERENCES drills (id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
