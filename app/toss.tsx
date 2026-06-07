import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { User, FairyDefinition } from '@/types/database';
import type { Rarity } from '@/types/database';

const AMOUNTS = [25, 50, 100, 200, 300, 500];

const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common ★',
  uncommon: 'Uncommon ★★',
  rare: 'Rare ★★★',
  legendary: 'Legendary ★★★★',
};

function computeOdds(amount: number): Record<Rarity, number> {
  const t = Math.max(0, Math.min(1, (amount - 25) / 475));
  const raw = {
    common: 70 - t * 45,
    uncommon: 20 + t * 5,
    rare: 8 + t * 22,
    legendary: 2 + t * 18,
  };
  const total = raw.common + raw.uncommon + raw.rare + raw.legendary;
  return {
    common: Math.round((raw.common / total) * 100),
    uncommon: Math.round((raw.uncommon / total) * 100),
    rare: Math.round((raw.rare / total) * 100),
    legendary: Math.round((raw.legendary / total) * 100),
  };
}

function rollRarity(odds: Record<Rarity, number>): Rarity {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const rarity of ['common', 'uncommon', 'rare', 'legendary'] as Rarity[]) {
    cumulative += odds[rarity];
    if (roll < cumulative) return rarity;
  }
  return 'common';
}

export default function TossScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [user, setUser] = useState<User | null>(null);
  const [amount, setAmount] = useState(100);
  const [tossing, setTossing] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single();
    setUser(data as User | null);
  }

  const odds = computeOdds(amount);
  const canAfford = (user?.coin_balance ?? 0) >= amount;

  async function handleToss() {
    if (!user || !canAfford) return;
    setTossing(true);

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setTossing(false); return; }

    const rolledRarity = rollRarity(odds);

    const { data: fairiesOfRarity } = await supabase
      .from('fairy_definitions')
      .select('*')
      .eq('rarity', rolledRarity);

    const fairies = fairiesOfRarity as FairyDefinition[] | null;
    if (!fairies || fairies.length === 0) {
      Alert.alert('No fairies available of that rarity yet.');
      setTossing(false);
      return;
    }

    const fairy = fairies[Math.floor(Math.random() * fairies.length)];
    const now = new Date();
    const visitHours = Math.floor(Math.random() * 6) + 1; // 1–6 hours
    const departsAt = new Date(now.getTime() + visitHours * 60 * 60 * 1000);

    // Slot 0 is always immediately available; slots 1 and 2 are spread across the rest of the visit
    const total = departsAt.getTime() - now.getTime();
    const segment = total / 3;
    const convoSlots = [
      now.toISOString(),
      new Date(now.getTime() + segment + Math.random() * segment).toISOString(),
      new Date(now.getTime() + 2 * segment + Math.random() * segment).toISOString(),
    ];

    await (supabase.from('fountain_visits').insert({
      user_id: authUser.id,
      fairy_id: fairy.id,
      coins_spent: amount,
      arrived_at: now.toISOString(),
      departs_at: departsAt.toISOString(),
      is_active: true,
      materials_claimed: false,
      convo_slots: convoSlots,
      convo_count: 0,
    }) as any);

    const newBalance = user.coin_balance - amount;
    await (supabase
      .from('users')
      .update({ coin_balance: newBalance }) as any)
      .eq('id', authUser.id);

    await supabase.from('coin_transactions').insert({
      user_id: authUser.id,
      amount: -amount,
      source_type: 'fountain_toss',
      description: `Tossed ${amount} wishes for ${fairy.name}`,
    } as any);

    // Clear the toss cooldown — it will be set again when this fairy leaves
    await (supabase.from('users').update({ next_toss_available_at: null }) as any)
      .eq('id', authUser.id);

    setTossing(false);
    router.replace('/(tabs)' as any);
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}>
          <IconSymbol size={20} name="arrow.left" color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.wishBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <IconSymbol size={16} name="heart.fill" color={colors.coin} />
          <Text style={[styles.wishText, { color: colors.coin }]}>{user?.coin_balance ?? 0}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Fountain mini */}
        <View style={styles.fountainMini}>
          <View style={styles.miniTiers}>
            <View style={[styles.miniTier1, { backgroundColor: colors.tint }]} />
            <View style={[styles.miniTier2, { backgroundColor: colors.tint, opacity: 0.8 }]} />
            <View style={[styles.miniTier3, { backgroundColor: colors.tint, opacity: 0.6 }]} />
          </View>
          <Text style={[styles.fountainTitle, { color: colors.text }]}>Make a Wish</Text>
        </View>

        {/* Amount selector */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.icon }]}>WISHES TO TOSS</Text>
          <View style={[styles.amountDisplay, { borderColor: colors.border }]}>
            <IconSymbol size={20} name="heart.fill" color={colors.coin} />
            <Text style={[styles.amountText, { color: colors.coin }]}>{amount}</Text>
          </View>
          <View style={styles.amountGrid}>
            {AMOUNTS.map((a) => (
              <TouchableOpacity
                key={a}
                style={[
                  styles.amountChip,
                  {
                    backgroundColor: amount === a ? colors.tint : colors.background,
                    borderColor: amount === a ? colors.tint : colors.border,
                  },
                ]}
                onPress={() => setAmount(a)}>
                <Text style={[
                  styles.amountChipText,
                  { color: amount === a ? '#fff' : colors.text },
                ]}>
                  {a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.helperText, { color: colors.icon }]}>
            Tossing {amount} wishes — higher amounts improve your odds
          </Text>
        </View>

        {/* Rarity odds */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.icon }]}>SUMMON ODDS</Text>
          {(['common', 'uncommon', 'rare', 'legendary'] as Rarity[]).map((rarity) => (
            <View key={rarity} style={styles.oddRow}>
              <Text style={[styles.oddLabel, { color: colors.text }]}>{RARITY_LABELS[rarity]}</Text>
              <View style={[styles.oddTrack, { backgroundColor: colors.background }]}>
                <View style={[styles.oddFill, {
                  backgroundColor: rarity === 'legendary' ? colors.coin
                    : rarity === 'rare' ? colors.tint
                    : rarity === 'uncommon' ? colors.income
                    : colors.icon,
                  width: `${odds[rarity]}%` as any,
                }]} />
              </View>
              <Text style={[styles.oddPct, { color: colors.icon }]}>{odds[rarity]}%</Text>
            </View>
          ))}
        </View>

        {/* Insufficient balance warning */}
        {!canAfford && (
          <View style={[styles.warningCard, { backgroundColor: colors.card, borderColor: colors.expense }]}>
            <Text style={[styles.warningText, { color: colors.expense }]}>
              Not enough wishes. Complete quests to earn more!
            </Text>
          </View>
        )}

      </ScrollView>

      {/* Toss button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.tossButton,
            { backgroundColor: canAfford ? colors.tint : colors.border },
          ]}
          onPress={handleToss}
          disabled={!canAfford || tossing}>
          {tossing
            ? <ActivityIndicator color="#fff" />
            : (
              <>
                <IconSymbol size={20} name="heart.fill" color="#fff" />
                <Text style={styles.tossButtonText}>Toss {amount} Wishes</Text>
              </>
            )}
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  wishText: { fontSize: 16, fontWeight: '700' },

  content: { padding: 20, gap: 16 },

  fountainMini: { alignItems: 'center', gap: 12 },
  miniTiers: { alignItems: 'center' },
  miniTier1: { width: 40, height: 18, borderRadius: 20, marginBottom: -3, zIndex: 3 },
  miniTier2: { width: 70, height: 20, borderRadius: 20, marginBottom: -3, zIndex: 2 },
  miniTier3: { width: 100, height: 24, borderRadius: 20, zIndex: 1 },
  fountainTitle: { fontSize: 22, fontWeight: '700' },

  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  amountDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 12,
  },
  amountText: { fontSize: 36, fontWeight: '800' },

  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amountChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  amountChipText: { fontSize: 15, fontWeight: '600' },

  helperText: { fontSize: 13, textAlign: 'center' },

  oddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  oddLabel: { fontSize: 13, width: 130 },
  oddTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  oddFill: { height: '100%', borderRadius: 4 },
  oddPct: { fontSize: 12, fontWeight: '600', width: 34, textAlign: 'right' },

  warningCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
  },
  warningText: { fontSize: 14, textAlign: 'center' },

  footer: { padding: 20, paddingTop: 8 },
  tossButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 18,
  },
  tossButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
