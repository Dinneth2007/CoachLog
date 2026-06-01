CREATE TABLE player_observations (
    id            BIGINT    NOT NULL AUTO_INCREMENT,
    session_id    BIGINT    NOT NULL,
    player_id     BIGINT    NOT NULL,
    overall_notes TEXT,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_observations_session_player (session_id, player_id),
    KEY idx_observations_player_created (player_id, created_at),
    CONSTRAINT fk_observations_session
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
    CONSTRAINT fk_observations_player
        FOREIGN KEY (player_id)  REFERENCES players (id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE technique_scores (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    observation_id BIGINT       NOT NULL,
    category       VARCHAR(20)  NOT NULL,
    dimension      VARCHAR(30)  NOT NULL,
    score          TINYINT      NOT NULL,
    notes          VARCHAR(500),
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_scores_observation_category_dimension (observation_id, category, dimension),
    KEY idx_scores_observation (observation_id),
    CONSTRAINT fk_scores_observation
        FOREIGN KEY (observation_id) REFERENCES player_observations (id) ON DELETE CASCADE,
    CONSTRAINT chk_scores_range CHECK (score BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
