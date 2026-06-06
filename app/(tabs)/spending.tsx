import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Transaction } from '@/types/database';

export default function SpendingScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('posted_date', { ascending: false });

      setTransactions(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>My Spending</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.tint }]}
          onPress={() => { /* TODO: open add transaction modal */ }}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {transactions.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.icon }]}>No transactions yet</Text>
          <Text style={[styles.emptyHint, { color: colors.icon }]}>
            Tap + Add to log your first one
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
          )}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: colors.card }]}>
              <View style={styles.rowLeft}>
                <Text style={[styles.merchant, { color: colors.text }]}>
                  {item.merchant_name ?? 'Transaction'}
                </Text>
                <Text style={[styles.date, { color: colors.icon }]}>
                  {item.posted_date ?? '—'}
                </Text>
              </View>
              <Text style={[
                styles.amount,
                { color: item.transaction_type === 'income' ? colors.income : colors.expense },
              ]}>
                {item.transaction_type === 'income' ? '+' : '-'}${Math.abs(Number(item.amount)).toFixed(2)}
              </Text>
            </View>
          )}
        />
      )}
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
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  separator: { height: 1 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLeft: { gap: 2 },
  merchant: { fontSize: 15, fontWeight: '500' },
  date: { fontSize: 12 },
  amount: { fontSize: 15, fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptyHint: { fontSize: 14 },
});
