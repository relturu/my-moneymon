-- ============================================================
-- Moneymon Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ============================================================
-- STEP 1: Drop all existing tables (order matters for FKs)
-- ============================================================
DROP TABLE IF EXISTS rewards CASCADE;
DROP TABLE IF EXISTS pets CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- STEP 2: Recreate core tables (modified from original schema)
-- ============================================================

-- Users (linked to Supabase Auth via uuid)
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  user_name text,
  email text,
  coin_balance int8 DEFAULT 0,
  fountain_xp int8 DEFAULT 0,
  fountain_level int8 DEFAULT 1,
  avatar_url text
);

-- Categories (global defaults + user custom)
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  is_default bool DEFAULT false,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  icon text,
  color text
);

-- Transactions
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  transaction_type text DEFAULT 'expense', -- 'income' or 'expense'
  merchant_name text,
  posted_date date,
  category_id uuid REFERENCES categories(id),
  notes text,
  account_id uuid, -- FK added after accounts table is created
  plaid_transaction_id text
);

-- Budgets
CREATE TABLE budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id),
  amount_limit numeric(10,2) NOT NULL,
  duration_type text,
  start_date date,
  end_date date,
  is_active bool DEFAULT true
);

-- ============================================================
-- STEP 3: New tables
-- ============================================================

-- Financial accounts (mock now, Plaid-extensible later)
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_type text, -- 'checking', 'savings', 'credit', 'cash'
  balance numeric(10,2) DEFAULT 0,
  institution_name text,
  is_mock bool DEFAULT true,
  plaid_account_id text,
  plaid_item_id text,
  is_active bool DEFAULT true
);

-- Add FK from transactions to accounts (now that accounts exists)
ALTER TABLE transactions
  ADD CONSTRAINT fk_transaction_account
  FOREIGN KEY (account_id) REFERENCES accounts(id);

-- Quest definitions (admin-seeded templates)
CREATE TABLE quest_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  title text NOT NULL,
  description text,
  quest_type text NOT NULL, -- 'daily' or 'weekly'
  coin_reward int8 NOT NULL,
  requirement_type text, -- 'log_transactions', 'stay_under_budget', 'log_income', 'complete_goal'
  requirement_value jsonb,
  is_active bool DEFAULT true,
  created_by uuid REFERENCES users(id) -- null = admin quest, set = user-created (future)
);

-- User quest opt-ins and completions
CREATE TABLE user_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  quest_id uuid REFERENCES quest_definitions(id),
  period_start date NOT NULL,
  accepted_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  coins_earned int8 DEFAULT 0
);

-- Coin transaction audit log (replaces rewards)
CREATE TABLE coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  amount int8 NOT NULL, -- positive = earned, negative = spent
  source_type text, -- 'quest', 'fountain_toss', 'admin'
  source_id uuid,
  description text
);

-- Fairy catalog (admin-seeded, Pokédex-style)
CREATE TABLE fairy_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rarity text NOT NULL, -- 'common', 'uncommon', 'rare', 'legendary'
  lore text,
  portrait_url text,
  material_drop_type text,
  visit_duration_hours int8 DEFAULT 24
);

-- User fairy collection (discovered fairies — replaces pets)
CREATE TABLE user_fairy_collection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  fairy_id uuid REFERENCES fairy_definitions(id),
  discovered_at timestamptz DEFAULT now(),
  friendship_level int8 DEFAULT 0,
  total_visits int8 DEFAULT 0,
  last_interaction_at timestamptz
);

-- Active and historical fountain visits
CREATE TABLE fountain_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  fairy_id uuid REFERENCES fairy_definitions(id),
  coins_spent int8 DEFAULT 0,
  arrived_at timestamptz DEFAULT now(),
  departs_at timestamptz,
  is_active bool DEFAULT true,
  interacted_at timestamptz
);

-- Material catalog (admin-seeded collectible items)
CREATE TABLE materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  rarity text NOT NULL, -- 'common', 'uncommon', 'rare', 'legendary'
  xp_min int8 NOT NULL,
  xp_max int8 NOT NULL
);

-- User material inventory
CREATE TABLE user_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  material_id uuid REFERENCES materials(id),
  quantity int8 DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Fountain level progression definitions (admin-seeded)
CREATE TABLE fountain_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level int8 UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  fairy_slots int8 DEFAULT 1,
  xp_required int8 NOT NULL
);
