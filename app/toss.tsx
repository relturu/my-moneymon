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

import CoinSvg from '@/assets/images/coin.svg';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { captureSnapshot } from '@/lib/admin';
import type { User, FairyDefinition } from '@/types/database';
import type { Rarity } from '@/types/database';

const AMOUNTS = [25, 50, 100, 200, 300, 500];

const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common ★',
  rare: 'Rare ★★',
  mythical: 'Mythical ★★★',
  legendary: 'Legendary ★★★★',
};

const RARITY_UNLOCK_LEVEL: Record<Rarity, number> = {
  common: 1,
  rare: 2,
  mythical: 3,
  legendary: 4,
};

const ALL_RARITIES: Rarity[] = ['common', 'rare', 'mythical', 'legendary'];

function getAvailableRarities(level: number): Rarity[] {
  return ALL_RARITIES.filter((r) => level >= RARITY_UNLOCK_LEVEL[r]);
}

function computeOdds(amount: number, availableRarities: Rarity[]): Partial<Record<Rarity, number>> {
  const t = Math.max(0, Math.min(1, (amount - 25) / 475));
  const base: Record<Rarity, number> = {
    common: 70 - t * 45,
    rare: 20 + t * 5,
    mythical: 8 + t * 22,
    legendary: 2 + t * 18,
  };
  const total = availableRarities.reduce((s, r) => s + base[r], 0);
  const result: Partial<Record<Rarity, number>> = {};
  availableRarities.forEach((r) => {
    result[r] = Math.round((base[r] / total) * 100);
  });
  return result;
}

function rollRarity(odds: Partial<Record<Rarity, number>>, availableRarities: Rarity[]): Rarity {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const rarity of availableRarities) {
    cumulative += odds[rarity] ?? 0;
    if (roll < cumulative) return rarity;
  }
  return availableRarities[0] ?? 'common';
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

  const availableRarities = getAvailableRarities(user?.fountain_level ?? 1);
  const odds = computeOdds(amount, availableRarities);
  const canAfford = (user?.coin_balance ?? 0) >= amount;

  async function handleToss() {
    if (!user || !canAfford) return;
    setTossing(true);

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setTossing(false); return; }

    await captureSnapshot(authUser.id);

    const rolledRarity = rollRarity(odds, availableRarities);

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
          <CoinSvg width={16} height={16} />
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
            <CoinSvg width={20} height={20} />
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
          {availableRarities.map((rarity) => (
            <View key={rarity} style={styles.oddRow}>
              <Text style={[styles.oddLabel, { color: colors.text }]}>{RARITY_LABELS[rarity]}</Text>
              <View style={[styles.oddTrack, { backgroundColor: colors.background }]}>
                <View style={[styles.oddFill, {
                  backgroundColor: rarity === 'legendary' ? colors.coin
                    : rarity === 'mythical' ? colors.tint
                    : rarity === 'rare' ? colors.income
                    : colors.icon,
                  width: `${odds[rarity] ?? 0}%` as any,
                }]} />
              </View>
              <Text style={[styles.oddPct, { color: colors.icon }]}>{odds[rarity] ?? 0}%</Text>
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
  wishText: { fontSize: 16, fontFamily: 'Kanchenjunga_700Bold' },

  content: { padding: 20, gap: 16 },

  fountainMini: { alignItems: 'center', gap: 12 },
  miniTiers: { alignItems: 'center' },
  miniTier1: { width: 40, height: 18, borderRadius: 20, marginBottom: -3, zIndex: 3 },
  miniTier2: { width: 70, height: 20, borderRadius: 20, marginBottom: -3, zIndex: 2 },
  miniTier3: { width: 100, height: 24, borderRadius: 20, zIndex: 1 },
  fountainTitle: { fontSize: 22, fontFamily: 'Kanchenjunga_700Bold' },

  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Kanchenjunga_700Bold',
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
  amountText: { fontSize: 36, fontFamily: 'Kanchenjunga_700Bold' },

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
  amountChipText: { fontSize: 15, fontFamily: 'Kanchenjunga_600SemiBold' },

  helperText: { fontSize: 13, textAlign: 'center' },

  oddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  oddLabel: { fontSize: 13, fontFamily: 'Kanchenjunga_400Regular', width: 130 },
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
