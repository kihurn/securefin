-- =====================================================================
-- SecureFin Supabase Migration
-- Run this in the Supabase Dashboard → SQL Editor → New Query
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  job_title TEXT,
  organization TEXT,
  avatar_url TEXT,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  default_currency TEXT NOT NULL DEFAULT 'USD ($) - United States Dollar',
  language TEXT NOT NULL DEFAULT 'English (Global)',
  email_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  push_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  sms_marketing BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  description TEXT NOT NULL,
  merchant TEXT NOT NULL,
  category TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  attachment_name TEXT,
  attachment_size TEXT,
  icon_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL,
  last_active TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_obligations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  month TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Disable RLS on all tables (we use service_role key on server side, which bypasses RLS anyway)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_obligations DISABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Balance columns (run this after initial migration if table already exists)
-- =====================================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS balance_operational DOUBLE PRECISION NOT NULL DEFAULT 254820.00,
  ADD COLUMN IF NOT EXISTS balance_vault       DOUBLE PRECISION NOT NULL DEFAULT 1420000.00,
  ADD COLUMN IF NOT EXISTS balance_reserve     DOUBLE PRECISION NOT NULL DEFAULT 8500000.00;
