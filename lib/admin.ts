import { supabase } from '@/lib/supabase';

export const ADMIN_EMAIL = 'test@moneymon.app';

export function isAdmin(email: string | null | undefined): boolean {
  return email === ADMIN_EMAIL;
}

type UndoSnapshot = {
  users: {
    coin_balance: number;
    fountain_xp: number;
    fountain_level: number;
    next_toss_available_at: string | null;
  };
  fountain_visits: any[];
  user_inventory: any[];
  user_fairy_collection: any[];
  user_quests: any[];
  snapshotAt: string;
} | null;

let snapshot: UndoSnapshot = null;

export function getSnapshot(): UndoSnapshot {
  return snapshot;
}

export function clearSnapshot(): void {
  snapshot = null;
}

export async function captureSnapshot(userId: string): Promise<void> {
  const snapshotAt = new Date().toISOString();

  const [
    { data: userData },
    { data: visits },
    { data: inventory },
    { data: collection },
    { data: quests },
  ] = await Promise.all([
    supabase.from('users').select('coin_balance,fountain_xp,fountain_level,next_toss_available_at').eq('id', userId).single(),
    supabase.from('fountain_visits').select('*').eq('user_id', userId),
    supabase.from('user_inventory').select('*').eq('user_id', userId),
    supabase.from('user_fairy_collection').select('*').eq('user_id', userId),
    supabase.from('user_quests').select('*').eq('user_id', userId),
  ]);

  snapshot = {
    users: userData as any,
    fountain_visits: (visits as any[] | null) ?? [],
    user_inventory: (inventory as any[] | null) ?? [],
    user_fairy_collection: (collection as any[] | null) ?? [],
    user_quests: (quests as any[] | null) ?? [],
    snapshotAt,
  };
}

export async function restoreSnapshot(userId: string): Promise<boolean> {
  if (!snapshot) return false;
  const s = snapshot;
  const db = supabase as any;

  await db.from('users')
    .update({
      coin_balance: s.users.coin_balance,
      fountain_xp: s.users.fountain_xp,
      fountain_level: s.users.fountain_level,
      next_toss_available_at: s.users.next_toss_available_at,
    })
    .eq('id', userId);

  await db.from('fountain_visits').delete().eq('user_id', userId);
  if (s.fountain_visits.length > 0) {
    await db.from('fountain_visits').insert(s.fountain_visits);
  }

  await db.from('user_inventory').delete().eq('user_id', userId);
  if (s.user_inventory.length > 0) {
    await db.from('user_inventory').insert(s.user_inventory);
  }

  await db.from('user_fairy_collection').delete().eq('user_id', userId);
  if (s.user_fairy_collection.length > 0) {
    await db.from('user_fairy_collection').insert(s.user_fairy_collection);
  }

  await db.from('user_quests').delete().eq('user_id', userId);
  if (s.user_quests.length > 0) {
    await db.from('user_quests').insert(s.user_quests);
  }

  // Remove coin_transactions created after snapshot (don't re-add audit rows)
  await db.from('coin_transactions')
    .delete()
    .eq('user_id', userId)
    .gte('created_at', s.snapshotAt);

  snapshot = null;
  return true;
}

export async function jumpToLevel(userId: string, level: number): Promise<void> {
  await captureSnapshot(userId);

  const { data: upgrade } = await supabase
    .from('fountain_upgrades')
    .select('xp_required')
    .eq('level', level)
    .single();

  const xp = (upgrade as any)?.xp_required ?? 0;

  await (supabase as any).from('users')
    .update({ fountain_level: level, fountain_xp: xp })
    .eq('id', userId);
}

export async function maxEverything(userId: string): Promise<void> {
  await captureSnapshot(userId);

  const db = supabase as any;

  await db.from('users')
    .update({ fountain_level: 5, fountain_xp: 1500, coin_balance: 1000 })
    .eq('id', userId);

  const { data: fairies } = await supabase.from('fairy_definitions').select('id');
  for (const fairy of (fairies as any[] | null) ?? []) {
    const { data: existing } = await supabase
      .from('user_fairy_collection')
      .select('id')
      .eq('user_id', userId)
      .eq('fairy_id', fairy.id)
      .single();

    if (existing) {
      await db.from('user_fairy_collection')
        .update({ friendship_level: 10, total_visits: 10 })
        .eq('id', (existing as any).id);
    } else {
      await db.from('user_fairy_collection').insert({
        user_id: userId,
        fairy_id: fairy.id,
        friendship_level: 10,
        total_visits: 10,
      });
    }
  }

  const { data: materials } = await supabase.from('materials').select('id');
  for (const material of (materials as any[] | null) ?? []) {
    const { data: existing } = await supabase
      .from('user_inventory')
      .select('id')
      .eq('user_id', userId)
      .eq('material_id', material.id)
      .single();

    if (existing) {
      await db.from('user_inventory')
        .update({ quantity: 10, updated_at: new Date().toISOString() })
        .eq('id', (existing as any).id);
    } else {
      await db.from('user_inventory').insert({
        user_id: userId,
        material_id: material.id,
        quantity: 10,
      });
    }
  }
}

export async function resetToStart(userId: string): Promise<void> {
  await captureSnapshot(userId);

  const db = supabase as any;

  await Promise.all([
    db.from('user_fairy_collection').delete().eq('user_id', userId),
    db.from('user_inventory').delete().eq('user_id', userId),
    db.from('fountain_visits').delete().eq('user_id', userId),
    db.from('user_quests').delete().eq('user_id', userId),
    db.from('coin_transactions').delete().eq('user_id', userId),
  ]);

  await db.from('users')
    .update({
      coin_balance: 100,
      fountain_xp: 0,
      fountain_level: 1,
      next_toss_available_at: null,
    })
    .eq('id', userId);
}

// ── God Mode (module-level toggle, no snapshots) ───────────────────────────────
let _godModeEnabled = false;
export function isGodModeEnabled(): boolean { return _godModeEnabled; }
export function setGodModeEnabled(v: boolean): void { _godModeEnabled = v; }

export async function godAdjustCoins(userId: string, delta: number): Promise<number> {
  const { data } = await supabase.from('users').select('coin_balance').eq('id', userId).single();
  const next = Math.max(0, ((data as any)?.coin_balance ?? 0) + delta);
  await (supabase as any).from('users').update({ coin_balance: next }).eq('id', userId);
  return next;
}

export async function godAdjustXP(userId: string, delta: number): Promise<{ xp: number; level: number }> {
  const { data: userData } = await supabase.from('users').select('fountain_xp').eq('id', userId).single();
  const newXp = Math.max(0, ((userData as any)?.fountain_xp ?? 0) + delta);

  const { data: upgrades } = await supabase
    .from('fountain_upgrades').select('level,xp_required').order('level', { ascending: true });
  let newLevel = 1;
  for (const u of (upgrades as any[] | null) ?? []) {
    if (newXp >= u.xp_required) newLevel = u.level;
  }

  await (supabase as any).from('users').update({ fountain_xp: newXp, fountain_level: newLevel }).eq('id', userId);
  return { xp: newXp, level: newLevel };
}

export async function godJumpToLevel(userId: string, level: number): Promise<{ xp: number; level: number }> {
  const { data: upgrade } = await supabase
    .from('fountain_upgrades').select('xp_required').eq('level', level).single();
  const xp = (upgrade as any)?.xp_required ?? 0;
  await (supabase as any).from('users').update({ fountain_level: level, fountain_xp: xp }).eq('id', userId);
  return { xp, level };
}

export async function godAddFairy(userId: string): Promise<string | null> {
  const [{ data: allFairies }, { data: discovered }] = await Promise.all([
    supabase.from('fairy_definitions').select('id,name'),
    supabase.from('user_fairy_collection').select('fairy_id').eq('user_id', userId),
  ]);
  const discoveredIds = new Set(((discovered as any[] | null) ?? []).map((r: any) => r.fairy_id));
  const undiscovered = ((allFairies as any[] | null) ?? []).filter((f: any) => !discoveredIds.has(f.id));
  if (undiscovered.length === 0) return null;
  const fairy = undiscovered[Math.floor(Math.random() * undiscovered.length)];
  await (supabase as any).from('user_fairy_collection').insert({
    user_id: userId,
    fairy_id: fairy.id,
    friendship_level: 1,
    total_visits: 1,
  });
  return fairy.name;
}
