-- ============================================================
-- Row Level Security Policies
-- Run in: Supabase Dashboard → SQL Editor
-- Run AFTER 01_schema.sql and 02_seed.sql
-- ============================================================

-- ── users ─────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile"   ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- ── accounts ──────────────────────────────────────────────────
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own accounts" ON accounts FOR ALL USING (auth.uid() = user_id);

-- ── transactions ──────────────────────────────────────────────
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own transactions" ON transactions FOR ALL USING (auth.uid() = user_id);

-- ── budgets ───────────────────────────────────────────────────
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own budgets" ON budgets FOR ALL USING (auth.uid() = user_id);

-- ── user_quests ───────────────────────────────────────────────
ALTER TABLE user_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own quests" ON user_quests FOR ALL USING (auth.uid() = user_id);

-- ── coin_transactions ─────────────────────────────────────────
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own coin transactions" ON coin_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert coin transactions"   ON coin_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── user_fairy_collection ─────────────────────────────────────
ALTER TABLE user_fairy_collection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own fairy collection" ON user_fairy_collection FOR ALL USING (auth.uid() = user_id);

-- ── fountain_visits ───────────────────────────────────────────
ALTER TABLE fountain_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own fountain visits" ON fountain_visits FOR ALL USING (auth.uid() = user_id);

-- ── user_inventory ────────────────────────────────────────────
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own inventory" ON user_inventory FOR ALL USING (auth.uid() = user_id);
