CREATE TABLE parent_summaries (
    id           BIGINT     NOT NULL AUTO_INCREMENT,
    player_id    BIGINT     NOT NULL,
    summary      TEXT,
    generated_at TIMESTAMP  NOT NULL,
    created_at   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_parent_summaries_player (player_id),
    CONSTRAINT fk_parent_summaries_player
        FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
