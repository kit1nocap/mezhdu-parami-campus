CREATE TABLE IF NOT EXISTS mp_account_profiles (
    login TEXT PRIMARY KEY REFERENCES mp_accounts(login),
    profile_json TEXT NOT NULL
);
