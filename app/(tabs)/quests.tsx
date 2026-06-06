import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { QuestDefinition, UserQuest } from '@/types/database';

type QuestWithStatus = QuestDefinition & { userQuest?: UserQuest };

export default function QuestsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [daily, setDaily] = useState<QuestWithStatus[]>([]);
  const [weekly, setWeekly] = useState<QuestWithStatus[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: quests }, { data: userQuests }] = await Promise.all([
        supabase.from('quest_definitions').select('*').eq('is_active', true),
        supabase.from('user_quests').select('*').eq('user_id', user.id),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const weekStart = getWeekStart();

      const merged: QuestWithStatus[] = (quests ?? []).map((q) => {
        const periodStart = q.quest_type === 'daily' ? today : weekStart;
        const uq = (userQuests ?? []).find(
          (uq) => uq.quest_id === q.id && uq.period_start === periodStart
        );
        return { ...q, userQuest: uq };
      });

      setDaily(merged.filter((q) => q.quest_type === 'daily'));
      setWeekly(merged.filter((q) => q.quest_type === 'weekly'));
    }
    load();
  }, []);

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
    });

    // Refresh
    const { data: uq } = await supabase
      .from('user_quests')
      .select('*')
      .eq('user_id', user.id)
      .eq('quest_id', quest.id)
      .eq('period_start', periodStart)
      .single();

    const update = (list: QuestWithStatus[]) =>
      list.map((q) => (q.id === quest.id ? { ...q, userQuest: uq ?? undefined } : q));

    if (quest.quest_type === 'daily') setDaily(update);
    else setWeekly(update);
  }

  const sections = [
    { title: 'Daily', data: daily },
    { title: 'Weekly', data: weekly },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Quests</Text>

      <SectionList
        sections={sections}
        keyExtractor={(q) => q.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={[styles.sectionHeader, { color: colors.icon }]}>{title}</Text>
        )}
        renderItem={({ item: q }) => {
          const accepted = !!q.userQuest;
          const completed = !!q.userQuest?.completed_at;
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={[styles.questTitle, { color: colors.text }]}>{q.title}</Text>
                  <Text style={[styles.questDesc, { color: colors.icon }]}>{q.description}</Text>
                </View>
                <Text style={[styles.reward, { color: colors.coin }]}>✦{q.coin_reward}</Text>
              </View>

              {completed ? (
                <Text style={[styles.badge, { color: colors.income }]}>✓ Completed</Text>
              ) : accepted ? (
                <Text style={[styles.badge, { color: colors.tint }]}>In progress</Text>
              ) : (
                <TouchableOpacity
                  style={[styles.acceptButton, { borderColor: colors.tint }]}
                  onPress={() => acceptQuest(q)}>
                  <Text style={[styles.acceptText, { color: colors.tint }]}>Accept</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  list: { padding: 20, gap: 10 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardLeft: { flex: 1, gap: 3 },
  questTitle: { fontSize: 15, fontWeight: '600' },
  questDesc: { fontSize: 13 },
  reward: { fontSize: 15, fontWeight: '700' },
  badge: { fontSize: 13, fontWeight: '600' },
  acceptButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  acceptText: { fontSize: 13, fontWeight: '600' },
});
