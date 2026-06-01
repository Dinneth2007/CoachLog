CREATE TABLE sessions (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    coach_id    BIGINT       NOT NULL,
    date        DATE         NOT NULL,
    title       VARCHAR(100) NOT NULL,
    notes       VARCHAR(500),
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_sessions_coach_date (coach_id, date DESC),
    CONSTRAINT fk_sessions_coach FOREIGN KEY (coach_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
