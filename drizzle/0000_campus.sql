CREATE TABLE IF NOT EXISTS mp_sessions (
    token_hash TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    profile_key TEXT NOT NULL,
    expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mp_sessions_expiry ON mp_sessions(expires_at);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS mp_requests (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    client_id TEXT NOT NULL,
    type TEXT NOT NULL,
    note TEXT NOT NULL,
    slot_id TEXT,
    created_at INTEGER NOT NULL,
    preset TEXT,
    UNIQUE(owner, client_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mp_requests_owner ON mp_requests(owner, created_at);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS mp_requests_slot ON mp_requests(owner, slot_id)
    WHERE slot_id IS NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS mp_read (
    owner TEXT NOT NULL,
    notice_id TEXT NOT NULL,
    PRIMARY KEY(owner, notice_id)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS mp_login_attempts (
    bucket TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
