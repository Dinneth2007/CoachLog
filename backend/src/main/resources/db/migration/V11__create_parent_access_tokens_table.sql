CREATE TABLE parent_access_tokens (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    player_id   BIGINT       NOT NULL,
    token_hash  VARCHAR(64)  NOT NULL,
    expires_at  TIMESTAMP    NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_parent_tokens_hash (token_hash),
    CONSTRAINT fk_parent_tokens_player
        FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
