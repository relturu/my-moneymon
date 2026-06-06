# Moneymon — Claude Code Guide

## What This App Is
Moneymon is a financial planning app for college students that combines budgeting tools with a gamified fairy fountain experience (Neko Atsume-inspired). Users earn coins (called "wishes" ♥) by completing financial quests, then toss coins into a fountain to summon fairies. Target: 10–20 users.

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
  _layout.tsx            — Root stack. Wraps everything in NotifProvider. Handles auth redirect.
  (auth)/                — Sign in + sign up screens
  (tabs)/                — Main tab navigator (5 tabs)
    _layout.tsx          — Tab bar config + notification dot logic + initial fountain DB check
    index.tsx            — Fountain screen (home) — fairy visits, mailbox collect, pat
    finance.tsx          — Finance screen (3 sub-tabs: Overview, Transactions, Budgets)
    inventory.tsx        — Inventory grid (materials collected from fairies)
    fairy-log.tsx        — Fairy compendium (all fairies, discovered vs undiscovered)
    profile.tsx          — User profile + sign out
  quests.tsx             — Quests screen (pushed from fountain top bar, not a tab)
  toss.tsx               — Coin toss / fairy summoning screen
  fairy-log-detail.tsx   — Detail view for a discovered fairy

components/
  haptic-tab.tsx         — Tab bar button with haptic feedback
  themed-text.tsx        — Text component that respects color scheme
  themed-view.tsx        — View component that respects color scheme
  ui/icon-symbol.tsx     — Cross-platform icons (SF Symbols on iOS, Material on Android)
  ui/icon-symbol.ios.tsx

constants/
  theme.ts               — App color palette (light + dark). Includes coin, income, expense colors.

lib/
  supabase.ts            — Supabase client (typed)
  dev-test.ts            — Dev-only state for testing fairy material flow end-to-end
  notifications.tsx      — NotifProvider + useNotifs() hook — shared notification dot state

types/
  database.ts            — TypeScript types for all 14 DB tables + COIN_COST_BY_RARITY constant

supabase/
  01_schema.sql          — Full DB schema (drop old tables + recreate all 14)
  02_seed.sql            — Seed data: categories, fairies, materials, quests, fountain levels
  03_rls_policies.sql    — Row Level Security policies for all user-specific tables
  04_functions.sql       — get_email_by_username() function for username-based login

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
| `budgets` | Per-category spending limits with `start_date` and `end_date` |

### Quests + coins
| Table | Purpose |
|---|---|
| `quest_definitions` | Admin-seeded quest templates (daily/weekly) |
| `user_quests` | Tracks which quests a user has accepted + completed. `period_start` = date key for reset |
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
- Budget spending is matched by `category_id` + date range (`start_date`..`end_date`) in app code, not DB views

---

## Auth Flow
1. `app/_layout.tsx` checks Supabase session on load
2. No session → redirects to `/(auth)/sign-in`
3. Sign-in supports **email OR username** (username lookup uses `get_email_by_username` RPC)
4. Sign-up creates auth user → trigger auto-creates `public.users` row → app sets username
5. Session is stored by Supabase client automatically; auto-refreshed in background
6. Passwords are bcrypt-hashed by Supabase — never readable

---

## Fountain Screen (`index.tsx`)

### State
- `activeFairy` — a fairy currently visiting (departs_at in future, materials_claimed = false)
- `mailboxVisits` — expired visits (departs_at in past, materials_claimed = false) awaiting collection
- `sheetOpen` — bottom sheet for fairy interaction (pat, shoo, see drops)

### Events
| Event | What happens |
|---|---|
| Fairy visits | `fountain_visits` row inserted via toss screen. Active fairy shows on fountain. |
| User pats fairy | `fountain_visits.interacted_at` updated; `user_fairy_collection.friendship_level` incremented |
| Fairy leaves (timer expires) | Visit moves from active → mailbox (detected via `departs_at < now`) |
| User collects mailbox | Materials added to `user_inventory`; XP applied to `users`; visit marked `materials_claimed=true, is_active=false`; fairy logged in `user_fairy_collection` |
| Level-up on collect | Checked by comparing new XP against all `fountain_upgrades` thresholds |

### Pat cooldown
8 hours between pats per visit (`INTERACTION_COOLDOWN_HOURS = 8`). Cooldown text shown when unavailable.

### Dev test button
"Test Fairy Material Functionality" on the fountain screen creates a synthetic expired visit so developers can test the full mailbox → collect → inventory → fairy-log flow without waiting for real visits. Dev test visits are cleaned up automatically (no XP awarded, collection/inventory entries removed when user navigates away from fairy-log).

---

## Finance Screen (`finance.tsx`) — 3 sub-tabs

### Overview sub-tab
- Shows income, expenses, net (format: `+$X.XX` / `-$X.XX` — never `$-X.XX`)
- "Recent" = transactions from the last 7 days, with edit + delete buttons

### Transactions sub-tab
- All transactions grouped by month (e.g. "June 2026")
- Edit (pencil) and delete (trash) buttons on each row
- Delete requires confirmation alert
- Amount fields show `$` prefix; auto-format `.00` on blur

### Budgets sub-tab
- **Overall spending limit** (optional) — budget with `category_id = NULL`, shown at top
- **Category budgets** — each card shows:
  - Category name + icon
  - Date range (e.g. `6/1/26–6/30/26`) derived from `start_date`/`end_date`
  - Spent vs limit summary
  - Tap to expand: progress bar + matching transactions list
  - Over-budget shown in red
- **All other spending** — read-only card at bottom; sums expense transactions not matched by any category budget
- **Manage Categories** button — modal to add custom categories (name + emoji) or delete user-owned ones
- Budget modal: monthly/weekly toggle (auto-computes dates) OR custom date range toggle

### Quest reset logic
Quests reset automatically by period — the app matches `user_quests.period_start` to today's date (daily) or the current week's Monday (weekly). Yesterday's completed daily quest won't appear completed today because the date key doesn't match. No DB cleanup required.

---

## Notification Dot System (`lib/notifications.tsx`)

A React Context (`NotifProvider`) wraps the entire app and provides three boolean flags:

| Flag | Set when | Cleared when |
|---|---|---|
| `fountain` | Fairy is visiting OR mailbox has uncollected items (DB-driven, updated by `load()`) | `load()` finds nothing active |
| `inventory` | Mailbox collected and materials were added | User opens Inventory tab |
| `fairyLog` | Mailbox collected and a NEW fairy was discovered | User opens Fairy Log tab |

**How dots appear**: The tab `_layout.tsx` renders a small red circle (`position: absolute, top: -1, right: -5, 9×9px`) over the relevant tab icon when the flag is true.

**Initial check**: The tab `_layout.tsx` runs a DB query on mount to check for active/mailbox visits — this ensures the fountain dot appears even if the user hasn't opened the fountain tab yet this session.

---

## Colors (`constants/theme.ts`)
| Key | Use |
|---|---|
| `tint` | Primary violet — buttons, active states |
| `coin` | Gold/amber — coin balance displays |
| `income` | Green — positive transactions |
| `expense` | Red — expenses |
| `card` | Card background |
| `border` | Dividers and card borders |

---

## Icon Mappings (`components/ui/icon-symbol.tsx`)
SF Symbols (iOS) map to Material Icons (Android/web). Current mappings include:
`house.fill`, `sparkles`, `creditcard.fill`, `chart.bar.fill`, `chart.pie.fill`, `scroll.fill`, `person.fill`, `bag.fill`, `book.closed.fill`, `clipboard.fill`, `plus`, `xmark`, `trash`, `pencil`, `gear`, `arrow.left`, `magnifyingglass`, `heart.fill`, `star.fill`, `drop.fill`, `chevron.up`, `chevron.down`, `chevron.right`

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
- Every screen that needs auth-protected data calls `supabase.auth.getUser()` at the top of its `useEffect`/`useFocusEffect`
- All tab screens use `SafeAreaView` from `react-native-safe-area-context` as root wrapper
- The tab bar handles bottom safe area automatically — don't add extra bottom padding on tab screens
- Safe area was already applied: do NOT add `paddingTop: 60` hacks
- `useColorScheme() ?? 'light'` is the pattern for getting the current theme
- All Supabase queries should handle the `user_id` filter for user-specific data
- `(supabase as any)` cast is used on write operations (insert/update/delete) where TS types are strict — this is intentional

---

## Screen → Data Mapping
| Screen | Tables |
|---|---|
| Fountain (home) | `fountain_visits`, `fountain_upgrades`, `users`, `fairy_definitions`, `user_fairy_collection`, `materials`, `user_inventory` |
| Finance → Overview | `users`, `transactions` |
| Finance → Transactions | `transactions`, `categories` |
| Finance → Budgets | `budgets`, `categories`, `transactions` |
| Inventory | `user_inventory`, `materials`, `users` |
| Fairy Log | `fairy_definitions`, `user_fairy_collection`, `users` |
| Quests | `quest_definitions`, `user_quests`, `users` |
| Profile | `users` |

---

## Not Yet Built (future work)
- Analytics / trends screen
- Plaid integration (accounts table is already schema-ready)
- Push notifications (fairy arrival / mailbox ready)
- In-app fairy dialogue / story screen
