CREATE TABLE players (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    name        VARCHAR(100) NOT NULL,
    age_group   VARCHAR(10)  NOT NULL,
    notes       VARCHAR(500),
    coach_id    BIGINT       NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_players_coach_id (coach_id),
    CONSTRAINT fk_players_coach FOREIGN KEY (coach_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
