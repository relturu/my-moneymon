-- ============================================================
-- Moneymon Seed Data
-- Run AFTER 01_schema.sql in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- Default Categories
-- ============================================================
INSERT INTO categories (name, is_default, icon, color) VALUES
  ('Food & Dining', true, '🍔', '#FF6B6B'),
  ('Groceries', true, '🛒', '#4ECDC4'),
  ('Transportation', true, '🚗', '#45B7D1'),
  ('Entertainment', true, '🎮', '#96CEB4'),
  ('Shopping', true, '🛍️', '#FFEAA7'),
  ('Health & Fitness', true, '💪', '#DDA0DD'),
  ('Utilities', true, '💡', '#98D8C8'),
  ('Housing & Rent', true, '🏠', '#F7DC6F'),
  ('Education', true, '📚', '#85C1E9'),
  ('Personal Care', true, '✨', '#F1948A'),
  ('Subscriptions', true, '📱', '#82E0AA'),
  ('Income', true, '💰', '#52BE80');

-- ============================================================
-- Fountain Upgrades (levels 1–5)
-- ============================================================
INSERT INTO fountain_upgrades (level, name, description, fairy_slots, xp_required) VALUES
  (1, 'Mossy Spring',    'A humble mossy spring. One fairy can visit at a time.',       1, 0),
  (2, 'Crystal Pool',   'The water shimmers. Two fairies can visit at once.',           2, 100),
  (3, 'Silver Grotto',  'Silver light dances on the surface. Fairies flock here.',     3, 300),
  (4, 'Golden Basin',   'A luminous golden basin. Rare fairies take notice.',           4, 700),
  (5, 'Celestial Fount','The fountain radiates pure magic. All fairies are drawn to it.',5, 1500);

-- ============================================================
-- Materials
-- ============================================================
INSERT INTO materials (name, description, rarity, xp_min, xp_max) VALUES
  ('Dewdrop',        'A tiny droplet of morning dew. Shimmers in sunlight.',      'common',    5,  15),
  ('Pebble',         'A smooth river pebble worn by time.',                       'common',    5,  15),
  ('Clover Leaf',    'A lucky four-leaf clover. Slightly magical.',               'common',    5,  20),
  ('Feather',        'A soft iridescent feather left behind by a fairy.',         'uncommon', 20,  40),
  ('Moonstone Shard','A glowing fragment of pale moonstone.',                     'uncommon', 20,  45),
  ('Pixie Dust',     'Shimmering dust that smells faintly of flowers.',           'uncommon', 25,  50),
  ('Star Fragment',  'A tiny shard fallen from a shooting star.',                 'rare',     50, 100),
  ('Enchanted Bloom','A flower that blooms only in fairy light.',                 'rare',     55, 110),
  ('Prism Crystal',  'A perfect crystal that splits light into all colors.',      'legendary',100, 200),
  ('Aether Essence', 'Pure concentrated magic. Extremely rare.',                  'legendary',120, 250);

-- ============================================================
-- Fairy Definitions
-- ============================================================
INSERT INTO fairy_definitions (name, rarity, lore, material_drop_type, portrait_url, visit_duration_hours) VALUES
  ('Webster', 'common',    'A quiet, dark-cloaked fairy who lingers near mossy stones and still water.',        'Dewdrop',       'webster',  12),
  ('Felicity','common',    'A cheery fairy in a blue coat who brings good luck to careful spenders.',           'Clover Leaf',   'felicity', 12),
  ('Mallow',  'uncommon',  'A soft-spoken fairy with big ears who loves warm places and cozy things.',          'Feather',       'mallow',   18),
  ('Pepper',  'rare',      'A fiery red-haired fairy who visits in bursts of energy. Hard to catch.',          'Star Fragment', 'pepper',   24),
  ('Pearl',   'legendary', 'A serene fairy of the deep tide. She appears only to the most devoted fountains.', 'Prism Crystal', null,       48);

-- ============================================================
-- Quest Definitions
-- ============================================================
INSERT INTO quest_definitions (title, description, quest_type, coin_reward, requirement_type, requirement_value, is_active) VALUES
  -- Daily quests
  ('Log a Transaction',
   'Record any purchase or income today.',
   'daily', 10, 'log_transactions', '{"count": 1}', true),

  ('Log 3 Transactions',
   'Record 3 transactions today to keep your budget on track.',
   'daily', 25, 'log_transactions', '{"count": 3}', true),

  ('Log Your Income',
   'Record any income source today.',
   'daily', 15, 'log_income', '{"count": 1}', true),

  -- Weekly quests
  ('Budget Watcher',
   'Stay under budget in any one category this week.',
   'weekly', 50, 'stay_under_budget', '{"categories": 1}', true),

  ('Transaction Tracker',
   'Log at least 10 transactions this week.',
   'weekly', 75, 'log_transactions', '{"count": 10}', true),

  ('Income Logger',
   'Record 3 income transactions this week.',
   'weekly', 60, 'log_income', '{"count": 3}', true),

  ('Savings Champion',
   'Stay under budget in 3 or more categories this week.',
   'weekly', 100, 'stay_under_budget', '{"categories": 3}', true);
