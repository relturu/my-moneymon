# Moneymon

A financial planning app for college students with a gamified fairy fountain experience. Built with React Native + Expo and Supabase.

---

## Prerequisites

Install these before cloning the repo.

### 1. Node.js (v18 or later)
Download from [nodejs.org](https://nodejs.org) or use a version manager:
```bash
# with nvm
nvm install 18
nvm use 18
```

### 2. npm (comes with Node)
Verify: `npm --version`

### 3. Expo CLI
```bash
npm install -g expo-cli
```

### 4. Expo Go (on your phone — for quick testing)
- iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
- Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

> **Note:** Expo Go works for most development. If you need native modules not supported by Expo Go, you'll need a development build (see below).

### 5. (Optional) iOS Simulator — macOS only
Requires Xcode from the Mac App Store. After installing:
```bash
xcode-select --install
```
Then open Xcode once to accept the license.

### 6. (Optional) Android Emulator
Requires [Android Studio](https://developer.android.com/studio). After installing:
- Open Android Studio → Virtual Device Manager → create a device
- Make sure `ANDROID_HOME` is set in your shell profile

---

## Getting Started

### 1. Clone the repo
```bash
git clone <repo-url>
cd my-moneymon
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env.local` file in the project root (never commit this):
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```
Get these values from the Supabase dashboard under **Project Settings → API**.

> See the [Environment Variables & API Keys](#environment-variables--api-keys) section below for a full explanation of what these are and how they work.

### 4. Set up the Supabase database
In the Supabase dashboard → **SQL Editor**, run these files in order:
1. `supabase/01_schema.sql` — creates all 14 tables
2. `supabase/02_seed.sql` — seeds categories, fairies, quests, etc.
3. `supabase/03_rls_policies.sql` — enables Row Level Security
4. `supabase/04_functions.sql` — username-based login function

Then run this trigger manually (also in SQL Editor):
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

Also disable email confirmation for development: **Supabase → Auth → Settings → Disable email confirmations**.

### 5. Start the dev server
```bash
npx expo start
```

From the terminal output, press:
- `i` — open iOS Simulator
- `a` — open Android Emulator
- `w` — open in browser
- Scan the QR code with Expo Go on your phone

---

## Running on a Physical Device (Expo Go)

1. Make sure your phone and computer are on the **same Wi-Fi network**
2. Run `npx expo start`
3. Open the Expo Go app and scan the QR code in the terminal

---

## Development Builds (if Expo Go isn't enough)

If you add native modules that Expo Go doesn't support:
```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```
This requires Xcode (iOS) or Android Studio (Android) to be installed.

---

## Useful Scripts

| Command | Description |
|---|---|
| `npx expo start` | Start the Expo dev server |
| `npx expo start --ios` | Start and open iOS simulator |
| `npx expo start --android` | Start and open Android emulator |
| `npx expo start --web` | Start and open in browser |
| `npm run lint` | Run ESLint |

---

## Environment Variables & API Keys

### Why this setup exists

Supabase credentials are sensitive — they connect directly to your database. They must never be committed to git. The `.env.local` file is listed in `.gitignore` so it stays off GitHub.

The two values you need are:

| Variable | What it is |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | The URL of your Supabase project (e.g. `https://abcdefgh.supabase.co`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | A public, read-limited JWT key — safe to ship in the client app |

The **anon key** is not a secret in the traditional sense — it's intentionally public and is the only key used in the app. It is limited by Supabase's Row Level Security (RLS) policies, which are defined in `supabase/03_rls_policies.sql`. Never use the **service role key** in the app; that key bypasses all RLS and should only ever be used in trusted server-side code.

### How the values flow through the app

```
.env.local
  └── process.env.EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
        └── app.config.js  (reads process.env, puts values in `extra`)
              └── lib/supabase.ts  (reads Constants.expoConfig.extra, initializes client)
```

Expo reads `.env.local` automatically at startup — you don't need any extra dotenv library.

### Where to get the keys

**If you're connecting to the existing Moneymon Supabase project**, ask the project owner to share the URL and anon key directly (via a secure channel, not Slack/Discord DMs in a shared server).

**If you're setting up your own Supabase project** (e.g. a personal dev environment):
1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for it to finish provisioning (~1 min)
4. Go to **Project Settings → API**
5. Copy **Project URL** → paste as `EXPO_PUBLIC_SUPABASE_URL`
6. Copy **anon / public** key → paste as `EXPO_PUBLIC_SUPABASE_ANON_KEY`
7. Run the SQL files in `supabase/` in order (see step 4 in Getting Started above) to set up the schema in your new project

### Verifying it works

If the keys are missing or wrong, the app will throw immediately on launch:
```
Error: Missing Supabase URL or anon key. Check your app.config.js and .env.local.
```
This comes from `lib/supabase.ts:8`. Double-check that `.env.local` exists in the project root (not a subdirectory) and that both variable names are spelled exactly as shown above.

---

## Tech Stack

- **React Native** + **Expo** (expo-router for file-based navigation)
- **Supabase** — PostgreSQL database, Auth, Row Level Security
- **TypeScript**

For a full breakdown of the architecture, database schema, and screen structure, see [CLAUDE.md](./CLAUDE.md).
