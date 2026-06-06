-- ============================================================
-- Postgres Functions
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Looks up a user's email by username (used for username-based sign-in)
CREATE OR REPLACE FUNCTION get_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT email FROM users WHERE lower(user_name) = lower(p_username) LIMIT 1;
$$;
