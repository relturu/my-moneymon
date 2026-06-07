-- ============================================================
-- Reseed Fairy Definitions
-- Replaces all fairy_definitions. Cascades clear user_fairy_collection
-- and fountain_visits referencing old fairies. Safe for dev reset.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Clear dependent tables first to avoid FK violations
DELETE FROM fountain_visits;
DELETE FROM user_fairy_collection;
DELETE FROM fairy_definitions;

INSERT INTO fairy_definitions (name, rarity, lore, material_drop_type, portrait_url, visit_duration_hours) VALUES
  ('Webster', 'common',    'A quiet, dark-cloaked fairy who lingers near mossy stones and still water.',        'Dewdrop',       'webster',  12),
  ('Felicity','common',    'A cheery fairy in a blue coat who brings good luck to careful spenders.',           'Clover Leaf',   'felicity', 12),
  ('Mallow',  'uncommon',  'A soft-spoken fairy with big ears who loves warm places and cozy things.',          'Feather',       'mallow',   18),
  ('Pepper',  'rare',      'A fiery red-haired fairy who visits in bursts of energy. Hard to catch.',          'Star Fragment', 'pepper',   24),
  ('Pearl',   'legendary', 'A serene fairy of the deep tide. She appears only to the most devoted fountains.', 'Prism Crystal', null,       48);
