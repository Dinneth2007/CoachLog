CREATE TABLE drills (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    name             VARCHAR(100) NOT NULL,
    description      TEXT         NOT NULL,
    skill_area       VARCHAR(20)  NOT NULL,
    target_issue     VARCHAR(30)  NOT NULL,
    difficulty       VARCHAR(15)  NOT NULL,
    equipment        VARCHAR(500),
    age_min          INT,
    age_max          INT,
    duration_minutes INT,
    video_url        VARCHAR(500),
    variations       TEXT,
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_drills_skill_area (skill_area),
    KEY idx_drills_target_issue (target_issue),
    KEY idx_drills_difficulty (difficulty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
