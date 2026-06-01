CREATE TABLE session_players (
    session_id  BIGINT NOT NULL,
    player_id   BIGINT NOT NULL,
    PRIMARY KEY (session_id, player_id),
    KEY idx_session_players_player (player_id),
    CONSTRAINT fk_session_players_session
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
    CONSTRAINT fk_session_players_player
        FOREIGN KEY (player_id)  REFERENCES players (id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
