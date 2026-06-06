# Moneymon — Claude Code Guide

## What This App Is
Moneymon is a financial planning app for college students that combines budgeting tools with a gamified fairy fountain experience (Neko Atsume-inspired). Users earn coins by completing financial quests, then toss coins into a fountain to summon fairies. The "pet" is a fairy. Target: 10–20 users.

---

## Tech Stack
- **Framework:** React Native + Expo (expo-router for file-based navigation)
- **Backend/DB/Auth:** Supabase (PostgreSQL, Auth, RLS)
- **Language:** TypeScript
- **Config:** `app.config.js` (replaces `app.json`) — reads env vars for Supabase keys

---

## Environment Setup
Credentials live in `.env.local` (gitignored):
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```
The Supabase client is at `lib/supabase.ts` and is typed with `types/database.ts`.

---

## Project Structure
```
app/
  _layout.tsx           — Root stack. Handles auth redirect (sign-in if no session).
  (auth)/               — Sign in + sign up screens
  (tabs)/               — Main tab navigator (6 tabs)
    _layout.tsx         — Tab bar config
    index.tsx           — Fountain screen (home)
    overview.tsx        — Overview / dashboard
    spending.tsx        — Transaction list
    budgets.tsx         — Budget management
    quests.tsx          — Quest list
    profile.tsx         — User profile + sign out

components/
  haptic-tab.tsx        — Tab bar button with haptic feedback
  themed-text.tsx       — Text component that respects color scheme
  themed-view.tsx       — View component that respects color scheme
  ui/icon-symbol.tsx    — Cross-platform icons (SF Symbols on iOS, Material on Android)
  ui/icon-symbol.ios.tsx

constants/
  theme.ts              — App color palette (light + dark). Includes coin, income, expense colors.

lib/
  supabase.ts           — Supabase client (typed)

types/
  database.ts           — TypeScript types for all 14 DB tables + COIN_COST_BY_RARITY constant

supabase/
  01_schema.sql         — Full DB schema (drop old tables + recreate all 14)
  02_seed.sql           — Seed data: categories, fairies, materials, quests, fountain levels
  03_rls_policies.sql   — Row Level Security policies for all user-specific tables
  04_functions.sql      — get_email_by_username() function for username-based login

hooks/
  use-color-scheme.ts
  use-theme-color.ts
```

---

## Database (14 tables)

### Core financial
| Table | Purpose |
|---|---|
| `users` | Extends auth.users — stores username, coin_balance, fountain_xp, fountain_level |
| `categories` | Spending categories. `is_default=true` = global, `user_id` set = user custom |
| `accounts` | Mock bank accounts (Plaid-extensible via plaid_account_id/plaid_item_id) |
| `transactions` | Income + expense records. `transaction_type` = 'income' or 'expense' |
| `budgets` | Per-category spending limits |

### Quests + coins
| Table | Purpose |
|---|---|
| `quest_definitions` | Admin-seeded quest templates (daily/weekly) |
| `user_quests` | Tracks which quests a user has accepted + completed |
| `coin_transactions` | Audit log for all coin changes (positive = earned, negative = spent) |

### Fairy + fountain
| Table | Purpose |
|---|---|
| `fairy_definitions` | Admin-seeded fairy catalog (rarity, lore, material_drop_type) |
| `user_fairy_collection` | Discovered fairies per user (friendship_level, total_visits) |
| `fountain_visits` | Active + historical fairy visits at the fountain |
| `fountain_upgrades` | Level progression (xp_required, fairy_slots per level) |
| `materials` | Collectible items fairies drop (xp_min, xp_max ranges) |
| `user_inventory` | User's collected material quantities |

### Key decisions
- `users.id` is a UUID that references `auth.users(id)` — Supabase Auth is the source of truth
- A database trigger `on_auth_user_created` auto-inserts a row into `public.users` on signup
- Money fields use `numeric(10,2)` — never `int8`
- Coin cost per fairy rarity is derived in code via `COIN_COST_BY_RARITY` in `types/database.ts`, not stored in DB
- XP from collecting materials is a random roll between `xp_min` and `xp_max` at collection time (handled in app code)

---

## Auth Flow
1. `app/_layout.tsx` checks Supabase session on load
2. No session → redirects to `/(auth)/sign-in`
3. Sign-in supports **email OR username** (username lookup uses `get_email_by_username` RPC)
4. Sign-up creates auth user → trigger auto-creates `public.users` row → app sets username
5. Session is stored by Supabase client automatically; auto-refreshed in background
6. Passwords are bcrypt-hashed by Supabase — never readable

---

## Colors (constants/theme.ts)
| Key | Use |
|---|---|
| `tint` | Primary violet — buttons, active states |
| `coin` | Gold/amber — coin balance displays |
| `income` | Green — positive transactions |
| `expense` | Red — expenses |
| `card` | Card background |
| `border` | Dividers and card borders |

---

## Icon Mappings (components/ui/icon-symbol.tsx)
SF Symbols (iOS) map to Material Icons (Android/web). Current mappings include:
`house.fill`, `sparkles`, `creditcard.fill`, `chart.pie.fill`, `scroll.fill`, `person.fill`, `bag.fill`, `book.closed.fill`, `clipboard.fill`, `plus`, `xmark`, `trash`, `pencil`, `gear`

To add a new icon: add it to the `MAPPING` object in `icon-symbol.tsx`. Find Material Icon names at https://icons.expo.fyi.

---

## Supabase Dashboard Checklist
All SQL files must be run manually in Supabase Dashboard → SQL Editor:
- [x] `01_schema.sql` — creates all tables
- [x] `02_seed.sql` — seeds static data
- [x] `03_rls_policies.sql` — enables Row Level Security
- [x] `04_functions.sql` — `get_email_by_username` for username login
- [x] Auth trigger — auto-creates `public.users` row on signup:
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email) VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```
- [x] Email confirmation disabled (Auth → Settings) for development
- [x] Test user created: `test@moneymon.app` / `moneymon123`

---

## Known Patterns & Conventions
- Every screen that needs auth-protected data calls `supabase.auth.getUser()` at the top of its `useEffect`
- All tab screens use `SafeAreaView` from `react-native-safe-area-context` with `edges={['top']}` or as root wrapper to avoid the notch
- The tab bar handles bottom safe area automatically — don't add extra bottom padding on tab screens
- Safe area was already applied: do NOT add `paddingTop: 60` hacks
- `useColorScheme() ?? 'light'` is the pattern for getting the current theme
- All Supabase queries should handle the `user_id` filter for user-specific data

---

## Screen → Data Mapping
| Screen | Tables |
|---|---|
| Fountain | `fountain_visits`, `fountain_upgrades`, `users` |
| Overview | `users`, `accounts`, `transactions` |
| Spending | `transactions`, `categories` |
| Budgets | `budgets`, `categories` |
| Quests | `quest_definitions`, `user_quests` |
| Profile | `users` |

---

## Not Yet Built (future work)
- Toss coins / fairy summoning logic (fountain_visits insert + coin deduction)
- Fairy interaction / dialogue screen
- Inventory screen (user_inventory + materials)
- Fairy compendium / log screen (fairy_definitions + user_fairy_collection)
- Add transaction / add budget modals
- Material collection when fairy leaves (user_inventory update + fountain_xp increment)
- Fountain level-up logic (check xp threshold → update fountain_level)
- Analytics / trends screen
- Plaid integration (accounts table is already schema-ready)
