-- =====================================================================
-- SecureFin Supabase Migration
-- Run this in the Supabase Dashboard → SQL Editor → New Query
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  job_title TEXT,
  organization TEXT,
  avatar_url TEXT,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  default_currency TEXT NOT NULL DEFAULT 'USD ($) - United States Dollar',
  language TEXT NOT NULL DEFAULT 'English (Global)',
  email_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  push_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  sms_marketing BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT,
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
  ADD COLUMN IF NOT EXISTS balance_reserve     DOUBLE PRECISION NOT NULL DEFAULT 8500000.00,
  ADD COLUMN IF NOT EXISTS role                TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS password_hash       TEXT DEFAULT 'password',
  ADD COLUMN IF NOT EXISTS face_descriptor     TEXT;

-- =====================================================================
-- Seed Default User ('user') & Accompanying Data
-- =====================================================================

-- 1. Insert default user with UID 'default-user-uid' and name 'user'
INSERT INTO users (
  uid,
  email,
  name,
  job_title,
  organization,
  avatar_url,
  two_factor_enabled,
  default_currency,
  language,
  email_alerts,
  push_notifications,
  sms_marketing,
  balance_operational,
  balance_vault,
  balance_reserve,
  password_hash
) VALUES (
  'default-user-uid',
  'user@fintrust.global',
  'user',
  'Corporate Node Administrator',
  'FinTrust Global Node',
  'https://api.dicebear.com/7.x/initials/svg?seed=user',
  true,
  'USD ($) - United States Dollar',
  'English (Global)',
  true,
  false,
  false,
  254820.00,
  1420000.00,
  8500000.00,
  'password'
) ON CONFLICT (uid) DO UPDATE 
SET name = EXCLUDED.name, email = EXCLUDED.email, password_hash = EXCLUDED.password_hash;

-- 2. Seed initial transactional records, device telemetry, and obligations
DO $$
DECLARE
  default_user_id INTEGER;
BEGIN
  -- Retrieve serial id of the default user
  SELECT id INTO default_user_id FROM users WHERE uid = 'default-user-uid';

  IF default_user_id IS NOT NULL THEN
    -- Clear out old seed data to prevent duplicate keys or stale records on re-runs
    DELETE FROM sessions WHERE user_id = default_user_id;
    DELETE FROM transactions WHERE user_id = default_user_id;
    DELETE FROM scheduled_obligations WHERE user_id = default_user_id;

    -- Insert sessions
    INSERT INTO sessions (user_id, device, location, status, last_active)
    VALUES 
      (default_user_id, 'MacBook Pro 16" • London, UK', 'Current Session • Chrome', 'active', 'Just now'),
      (default_user_id, 'iPhone 15 Pro • Zurich, CH', 'Last active: 2 hours ago • FinTrust App', 'inactive', '2 hours ago');

    -- Insert transactions
    INSERT INTO transactions (user_id, date, time, description, merchant, category, amount, status, notes, attachment_name, attachment_size, icon_name)
    VALUES
      (default_user_id, 'Oct 24, 2024', '14:32 PM', 'Amazon Web Services', 'Amazon Web Services', 'Technology', -1420.00, 'Verified', 'Monthly compute usage for production cluster ''Sigma''. Approved by Financial Controller.', 'Invoiced_94821.pdf', '2.4 MB', 'cloud'),
      (default_user_id, 'Oct 22, 2024', '09:15 AM', 'Internal Transfer', 'From Savings *4920', 'Financial Services', 15000.00, 'Verified', 'Quarterly liquidity rebalancing between operational vault and main vault.', 'Transfer_Receipt_94822.pdf', '1.1 MB', 'account_balance'),
      (default_user_id, 'Oct 21, 2024', '18:45 PM', 'Delta Air Lines', 'Delta Air Lines', 'Travel', -840.50, 'Pending', 'Round-trip flights for Q4 investment board meeting in Geneva.', 'E-Ticket_Delta_94823.pdf', '950 KB', 'flight'),
      (default_user_id, 'Oct 20, 2024', '11:02 AM', 'Cloudflare Inc.', 'Cloudflare Inc.', 'Infrastructure', -2100.00, 'Verified', 'Enterprise DDoS protection and SSL certificate renewals for primary trading gateway.', 'Cloudflare_Invoice_Oct.pdf', '1.8 MB', 'security'),
      (default_user_id, 'Oct 18, 2024', '20:10 PM', 'The Grillhouse', 'The Grillhouse', 'Dining', -342.15, 'Verified', 'Executive client dinner with principal officers from Sterling Partners.', 'Grillhouse_Receipt_94825.pdf', '430 KB', 'restaurant'),
      (default_user_id, 'Oct 15, 2024', '12:00 PM', 'Apple Store', 'Apple Store Regent St', 'Technology', -2499.00, 'Verified', 'Hardware upgrade: MacBook Pro M3 for quantitative analysis development.', 'Apple_Store_Invoice_94826.pdf', '3.2 MB', 'shopping_bag'),
      (default_user_id, 'Oct 12, 2024', '08:00 AM', 'Monthly Dividend', 'Investment Portfolio SPY', 'Income', 1250.00, 'Verified', 'Automated reinvested dividend payout from SPDR S&P 500 ETF Trust.', 'Dividend_Statement_Oct.pdf', '1.5 MB', 'south_west');

    -- Insert scheduled obligations
    INSERT INTO scheduled_obligations (user_id, day, month, description, category, amount, status)
    VALUES
      (default_user_id, '24', 'Oct', 'Vanguard Global REIT Fund', 'Recurring Investment • Monthly', 12500.00, 'Processing'),
      (default_user_id, '01', 'Nov', 'Manhattan Sky Residence', 'Lease Payment • Automatic', 8200.00, 'Scheduled');
  END IF;
END $$;
