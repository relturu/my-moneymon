import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { QuestDefinition, UserQuest } from '@/types/database';

type QuestWithStatus = QuestDefinition & { userQuest?: UserQuest };
type Period = 'daily' | 'weekly';

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export default function QuestsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [period, setPeriod] = useState<Period>('daily');
  const [daily, setDaily] = useState<QuestWithStatus[]>([]);
  const [weekly, setWeekly] = useState<QuestWithStatus[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);
  const [completing, setCompleting] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

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
      user_id: user.id,
      quest_id: quest.id,
      period_start: periodStart,
    } as any);

    await load();
  }

  async function completeQuest(quest: QuestWithStatus) {
    if (!quest.userQuest) return;

    Alert.alert(
      'Complete quest?',
      `Did you really complete: "${quest.title}"?\n\nYou'll earn ♥ ${quest.coin_reward} wishes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete!',
          onPress: async () => {
            setCompleting(quest.id);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setCompleting(null); return; }

            const now = new Date().toISOString();

            await (supabase
              .from('user_quests')
              .update({ completed_at: now, coins_earned: quest.coin_reward }) as any)
              .eq('id', quest.userQuest!.id);

            const { data: profile } = await supabase
              .from('users').select('coin_balance').eq('id', user.id).single();
            const currentBalance = (profile as any)?.coin_balance ?? 0;
            const newBalance = currentBalance + quest.coin_reward;

            await (supabase
              .from('users')
              .update({ coin_balance: newBalance }) as any)
              .eq('id', user.id);

            await supabase.from('coin_transactions').insert({
              user_id: user.id,
              amount: quest.coin_reward,
              source_type: 'quest',
              source_id: quest.userQuest!.id,
              description: `Completed: ${quest.title}`,
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}>
          <IconSymbol size={20} name="arrow.left" color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Daily Goals</Text>
        <View style={[styles.wishBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <IconSymbol size={16} name="heart.fill" color={colors.coin} />
          <Text style={[styles.wishText, { color: colors.coin }]}>{coinBalance}</Text>
        </View>
      </View>

      <FlatList
        data={quests}
        keyExtractor={(q) => q.id}
        contentContainerStyle={[styles.list, quests.length === 0 && styles.emptyList]}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.icon }]}>
            No {period} quests available
          </Text>
        }
        renderItem={({ item: q }) => {
          const accepted = !!q.userQuest;
          const completed = !!q.userQuest?.completed_at;
          const isCompleting = completing === q.id;

          return (
            <View style={[
              styles.card,
              {
                backgroundColor: completed
                  ? colors.background
                  : colors.card,
                borderColor: completed ? colors.border : colors.border,
                opacity: completed ? 0.7 : 1,
              },
            ]}>
              {/* Reward chip */}
              <View style={[
                styles.rewardChip,
                { backgroundColor: completed ? colors.income : colors.card, borderColor: completed ? colors.income : colors.border },
              ]}>
                <IconSymbol size={14} name="heart.fill" color={completed ? '#fff' : colors.coin} />
                <Text style={[styles.rewardText, { color: completed ? '#fff' : colors.coin }]}>
                  {q.coin_reward}
                </Text>
              </View>

              {/* Quest info */}
              <View style={styles.questInfo}>
                <Text style={[
                  styles.questTitle,
                  {
                    color: completed ? colors.icon : colors.text,
                    textDecorationLine: completed ? 'line-through' : 'none',
                  },
                ]}>
                  {q.title}
                </Text>
                {q.description ? (
                  <Text style={[styles.questDesc, { color: colors.icon }]}>{q.description}</Text>
                ) : null}

                {completed ? (
                  <Text style={[styles.statusText, { color: colors.income }]}>✓ Completed</Text>
                ) : accepted ? (
                  <TouchableOpacity
                    style={[styles.completeButton, { backgroundColor: colors.tint }]}
                    onPress={() => completeQuest(q)}
                    disabled={isCompleting}>
                    <Text style={styles.completeButtonText}>
                      {isCompleting ? 'Completing...' : 'Mark Complete'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.acceptButton, { borderColor: colors.tint }]}
                    onPress={() => acceptQuest(q)}>
                    <Text style={[styles.acceptText, { color: colors.tint }]}>Accept</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Period switcher (bottom) */}
      <View style={[styles.periodBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.periodBtn, period === 'daily' && { backgroundColor: colors.tint }]}
          onPress={() => setPeriod('daily')}>
          <Text style={[styles.periodBtnText, { color: period === 'daily' ? '#fff' : colors.icon }]}>
            Daily
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodBtn, period === 'weekly' && { backgroundColor: colors.tint }]}
          onPress={() => setPeriod('weekly')}>
          <Text style={[styles.periodBtnText, { color: period === 'weekly' ? '#fff' : colors.icon }]}>
            Weekly
          </Text>
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
    paddingBottom: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '700' },
  wishBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  wishText: { fontSize: 15, fontWeight: '700' },

  list: { padding: 16, gap: 12, paddingBottom: 24 },
  emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15 },

  card: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  rewardChip: {
    width: 52,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    padding: 6,
    flexShrink: 0,
  },
  rewardText: { fontSize: 13, fontWeight: '700' },

  questInfo: { flex: 1, gap: 8 },
  questTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  questDesc: { fontSize: 13, lineHeight: 18 },
  statusText: { fontSize: 13, fontWeight: '600' },

  completeButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  completeButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  acceptButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  acceptText: { fontSize: 13, fontWeight: '600' },

  periodBar: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  periodBtnText: { fontSize: 15, fontWeight: '600' },
});
