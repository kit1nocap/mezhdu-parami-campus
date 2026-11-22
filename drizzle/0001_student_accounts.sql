CREATE TABLE IF NOT EXISTS mp_accounts (
    login TEXT PRIMARY KEY,
    profile_key TEXT NOT NULL CHECK (profile_key IN ('mira', 'lev')),
    salt TEXT NOT NULL,
    hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
