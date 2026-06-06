import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Budget, Category } from '@/types/database';

type BudgetWithCategory = Budget & { category: Category | null };

export default function BudgetsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('budgets')
        .select('*, category:categories(*)')
        .eq('user_id', user.id)
        .eq('is_active', true);

      setBudgets((data as BudgetWithCategory[]) ?? []);
    }
    load();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>My Budgets</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.tint }]}
          onPress={() => { /* TODO: open add budget modal */ }}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {budgets.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.icon }]}>No budgets yet</Text>
            <Text style={[styles.emptyHint, { color: colors.icon }]}>
              Tap + Add to set a spending limit
            </Text>
          </View>
        ) : (
          budgets.map((b) => (
            <View
              key={b.id}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.categoryRow}>
                  {b.category?.icon ? (
                    <Text style={styles.icon}>{b.category.icon}</Text>
                  ) : null}
                  <Text style={[styles.categoryName, { color: colors.text }]}>
                    {b.category?.name ?? 'Uncategorized'}
                  </Text>
                </View>
                <Text style={[styles.limit, { color: colors.tint }]}>
                  ${Number(b.amount_limit).toFixed(2)}
                </Text>
              </View>
              <Text style={[styles.duration, { color: colors.icon }]}>
                {b.duration_type ?? 'Monthly'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '700' },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  list: { padding: 20, gap: 12 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { fontSize: 20 },
  categoryName: { fontSize: 16, fontWeight: '600' },
  limit: { fontSize: 18, fontWeight: '700' },
  duration: { fontSize: 13 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptyHint: { fontSize: 14 },
});
