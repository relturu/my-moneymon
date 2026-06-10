import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import CoinSvg from '@/assets/images/coin.svg';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { captureSnapshot } from '@/lib/admin';
import type { QuestDefinition, UserQuest } from '@/types/database';

type QuestWithStatus = QuestDefinition & { userQuest?: UserQuest };
type Period = 'daily' | 'weekly';

const QUEST_FINANCE_MAP: Record<string, { tab: string; hint: string }> = {
  log_transactions: { tab: 'transactions', hint: 'Log a transaction to complete this quest ✨' },
  log_income:       { tab: 'transactions', hint: 'Record income to complete this quest ✨' },
  stay_under_budget:{ tab: 'budgets',      hint: 'Keep your spending under budget to complete this quest ✨' },
  complete_goal:    { tab: 'overview',     hint: 'Review your financial overview to complete this quest ✨' },
};

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export default function QuestsScreen() {
  const [period, setPeriod] = useState<Period>('daily');
  const [daily, setDaily] = useState<QuestWithStatus[]>([]);
  const [weekly, setWeekly] = useState<QuestWithStatus[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);
  const [completing, setCompleting] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from('users').select('coin_balance').eq('id', user.id).single();
    setCoinBalance((profile as any)?.coin_balance ?? 0);

    const today = new Date().toISOString().split('T')[0];
    const weekStart = getWeekStart();

    const [{ data: quests }, { data: userQuests }] = await Promise.all([
      supabase.from('quest_definitions').select('*').eq('is_active', true),
      supabase.from('user_quests').select('*').eq('user_id', user.id),
    ]);

    const merged: QuestWithStatus[] = ((quests as QuestDefinition[] | null) ?? []).map((q) => {
      const periodStart = q.quest_type === 'daily' ? today : weekStart;
      const uq = ((userQuests as UserQuest[] | null) ?? []).find(
        (uq) => uq.quest_id === q.id && uq.period_start === periodStart
      );
      return { ...q, userQuest: uq };
    });

    setDaily(merged.filter((q) => q.quest_type === 'daily'));
    setWeekly(merged.filter((q) => q.quest_type === 'weekly'));
  }

  async function acceptQuest(quest: QuestWithStatus) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const periodStart = quest.quest_type === 'daily'
      ? new Date().toISOString().split('T')[0]
      : getWeekStart();
    await supabase.from('user_quests').insert({
      user_id: user.id, quest_id: quest.id, period_start: periodStart,
    } as any);
    if (quest.requirement_type) {
      const map = QUEST_FINANCE_MAP[quest.requirement_type];
      if (map) {
        router.push({ pathname: '/(tabs)/finance', params: { tab: map.tab, hint: map.hint } } as any);
        return;
      }
    }
    await load();
  }

  async function completeQuest(quest: QuestWithStatus) {
    if (!quest.userQuest) return;
    Alert.alert(
      'Complete quest?',
      `Did you really complete: "${quest.title}"?\n\nYou'll earn ${quest.coin_reward} wishes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete!',
          onPress: async () => {
            setCompleting(quest.id);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setCompleting(null); return; }
            await captureSnapshot(user.id);
            const now = new Date().toISOString();
            await (supabase.from('user_quests')
              .update({ completed_at: now, coins_earned: quest.coin_reward }) as any)
              .eq('id', quest.userQuest!.id);
            const { data: profile } = await supabase
              .from('users').select('coin_balance').eq('id', user.id).single();
            const newBalance = ((profile as any)?.coin_balance ?? 0) + quest.coin_reward;
            await (supabase.from('users').update({ coin_balance: newBalance }) as any).eq('id', user.id);
            await supabase.from('coin_transactions').insert({
              user_id: user.id, amount: quest.coin_reward, source_type: 'quest',
              source_id: quest.userQuest!.id, description: `Completed: ${quest.title}`,
            } as any);
            setCoinBalance(newBalance);
            await load();
            setCompleting(null);
          },
        },
      ]
    );
  }

  const quests = period === 'daily' ? daily : weekly;

  return (
    <ImageBackground
      source={require('@/assets/images/home-background.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* Coin badge on background */}
        <View style={styles.topArea}>
          <View style={styles.coinBadge}>
            <CoinSvg width={15} height={15} />
            <Text style={styles.coinText}>{coinBalance}</Text>
          </View>
        </View>

        {/* Main panel */}
        <View style={styles.panel}>
          <View style={styles.handle} />

          {/* Panel header */}
          <View style={styles.panelHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <IconSymbol size={20} name="arrow.left" color="#2A3A1E" />
            </TouchableOpacity>
            <Text style={styles.panelTitle}>Daily Goals</Text>
          </View>

          {/* Daily / Weekly toggle */}
          <View style={styles.toggle}>
            {(['daily', 'weekly'] as Period[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.toggleBtn, period === p && styles.toggleBtnActive]}
                onPress={() => setPeriod(p)}>
                <Text style={[styles.toggleText, { color: period === p ? '#425F4F' : 'rgba(0,0,0,0.4)' }]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={quests}
            keyExtractor={(q) => q.id}
            contentContainerStyle={[styles.list, quests.length === 0 && styles.listEmpty]}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            ListEmptyComponent={
              <View style={styles.emptyContent}>
                <Text style={styles.emptyEmoji}>📜</Text>
                <Text style={styles.emptyTitle}>No {period} quests</Text>
                <Text style={styles.emptyHint}>Check back soon for new goals</Text>
              </View>
            }
            renderItem={({ item: q }) => {
              const accepted = !!q.userQuest;
              const completed = !!q.userQuest?.completed_at;
              const isCompleting = completing === q.id;

              return (
                <View style={[styles.card, completed && styles.cardDone]}>
                  {/* Reward chip */}
                  <View style={[styles.rewardChip, completed && styles.rewardChipDone]}>
                    {completed ? (
                      <Text style={styles.checkmark}>✓</Text>
                    ) : (
                      <>
                        <CoinSvg width={14} height={14} />
                        <Text style={styles.rewardText}>{q.coin_reward}</Text>
                      </>
                    )}
                  </View>

                  {/* Quest info */}
                  <View style={styles.questInfo}>
                    <Text style={[styles.questTitle, completed && styles.questTitleDone]}>
                      {q.title}
                    </Text>
                    {q.description ? (
                      <Text style={styles.questDesc}>{q.description}</Text>
                    ) : null}
                    {completed ? (
                      <Text style={styles.completedLabel}>✓ Completed</Text>
                    ) : accepted ? (
                      <TouchableOpacity
                        style={styles.completeBtn}
                        onPress={() => completeQuest(q)}
                        disabled={isCompleting}>
                        <Text style={styles.completeBtnText}>
                          {isCompleting ? 'Completing...' : 'Mark Complete'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => acceptQuest(q)}>
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />
        </View>

      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safeArea: { flex: 1 },

  topArea: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 20,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  coinText: { fontSize: 15, fontFamily: 'Kanchenjunga_700Bold', color: '#FCD34D' },

  panel: {
    flex: 1,
    backgroundColor: '#E8EDE4',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backBtn: {
    width: 40, height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    fontSize: 28,
    fontFamily: 'Kanchenjunga_700Bold',
    color: '#425F4F',
  },

  toggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: 'rgba(0,0,0,0.10)' },
  toggleText: { fontSize: 14, fontFamily: 'Kanchenjunga_600SemiBold' },

  list: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 4 },
  listEmpty: { flex: 1 },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginVertical: 12 },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 16,
    padding: 14,
  },
  cardDone: { backgroundColor: 'rgba(66,95,79,0.10)' },

  rewardChip: {
    width: 54, minHeight: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    padding: 6,
    flexShrink: 0,
  },
  rewardChipDone: { backgroundColor: 'rgba(66,95,79,0.15)' },
  rewardText: { fontSize: 14, fontFamily: 'Kanchenjunga_700Bold', color: '#FCD34D' },
  checkmark: { fontSize: 22, color: '#425F4F' },

  questInfo: { flex: 1, gap: 6 },
  questTitle: { fontSize: 16, fontFamily: 'Kanchenjunga_600SemiBold', color: '#425F4F', lineHeight: 22 },
  questTitleDone: { color: 'rgba(0,0,0,0.35)', textDecorationLine: 'line-through' },
  questDesc: { fontSize: 13, color: 'rgba(0,0,0,0.5)', lineHeight: 18 },
  completedLabel: { fontSize: 13, fontFamily: 'Kanchenjunga_600SemiBold', color: '#425F4F' },

  completeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(66,95,79,0.75)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  completeBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Kanchenjunga_600SemiBold' },

  acceptBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  acceptBtnText: { color: '#425F4F', fontSize: 13, fontFamily: 'Kanchenjunga_600SemiBold' },

  emptyContent: { alignItems: 'center', gap: 12, paddingTop: 60 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontFamily: 'Kanchenjunga_600SemiBold', color: '#425F4F' },
  emptyHint: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32, color: 'rgba(0,0,0,0.45)' },
});
