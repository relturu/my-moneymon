import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { User, Transaction } from '@/types/database';

export default function OverviewScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [user, setUser] = useState<User | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const [{ data: profile }, { data: txns }] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      setUser(profile);
      setRecentTransactions(txns ?? []);
    }
    load();
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}>

      <Text style={[styles.greeting, { color: colors.text }]}>
        Hey{user?.user_name ? `, ${user.user_name}` : ''}! 👋
      </Text>

      {/* Coin balance */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.icon }]}>Coin Balance</Text>
        <Text style={[styles.coinAmount, { color: colors.coin }]}>
          ✦ {user?.coin_balance ?? 0}
        </Text>
      </View>

      {/* Recent transactions */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Recent Transactions</Text>
        {recentTransactions.length === 0 ? (
          <Text style={[styles.empty, { color: colors.icon }]}>No transactions yet</Text>
        ) : (
          recentTransactions.map((t) => (
            <View key={t.id} style={[styles.txnRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.txnName, { color: colors.text }]}>
                {t.merchant_name ?? 'Transaction'}
              </Text>
              <Text style={[
                styles.txnAmount,
                { color: t.transaction_type === 'income' ? colors.income : colors.expense },
              ]}>
                {t.transaction_type === 'income' ? '+' : '-'}${Math.abs(Number(t.amount)).toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>

    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 20, gap: 16 },
  greeting: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  cardLabel: { fontSize: 13, fontWeight: '500' },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  coinAmount: { fontSize: 28, fontWeight: '800' },
  empty: { fontSize: 14 },
  txnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  txnName: { fontSize: 14 },
  txnAmount: { fontSize: 14, fontWeight: '600' },
});
