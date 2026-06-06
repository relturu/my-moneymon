import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { User, Transaction, Budget, Category } from '@/types/database';

type BudgetWithCategory = Budget & { category: Category | null };
type Tab = 'overview' | 'transactions' | 'budgets';

export default function FinanceScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: profile } = await supabase
      .from('users').select('*').eq('id', authUser.id).single();
    setUser(profile as User | null);
    setCoinBalance((profile as User | null)?.coin_balance ?? 0);

    const { data: txns } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', authUser.id)
      .order('posted_date', { ascending: false });
    setTransactions((txns as Transaction[] | null) ?? []);

    const { data: bdgs } = await supabase
      .from('budgets')
      .select('*, category:categories(*)')
      .eq('user_id', authUser.id)
      .eq('is_active', true);
    setBudgets((bdgs as BudgetWithCategory[] | null) ?? []);
  }

  const income = transactions
    .filter((t) => t.transaction_type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);
  const expenses = transactions
    .filter((t) => t.transaction_type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={[styles.title, { color: colors.text }]}>Finance</Text>
        <View style={[styles.wishBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <IconSymbol size={16} name="heart.fill" color={colors.coin} />
          <Text style={[styles.wishText, { color: colors.coin }]}>{coinBalance}</Text>
        </View>
      </View>

      {/* Sub-tab switcher */}
      <View style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(['overview', 'transactions', 'budgets'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.tabBtn,
              activeTab === t && { backgroundColor: colors.tint },
            ]}
            onPress={() => setActiveTab(t)}>
            <Text style={[
              styles.tabBtnText,
              { color: activeTab === t ? '#fff' : colors.icon },
            ]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'overview' && (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Greeting */}
          <Text style={[styles.greeting, { color: colors.text }]}>
            Hey{user?.user_name ? `, ${user.user_name}` : ''}!
          </Text>

          {/* Summary cards */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.icon }]}>Income</Text>
              <Text style={[styles.summaryAmount, { color: colors.income }]}>
                +${income.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.icon }]}>Expenses</Text>
              <Text style={[styles.summaryAmount, { color: colors.expense }]}>
                -${expenses.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={[styles.netCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.netLabel, { color: colors.icon }]}>Net</Text>
            <Text style={[styles.netAmount, { color: (income - expenses) >= 0 ? colors.income : colors.expense }]}>
              {(income - expenses) >= 0 ? '+' : ''}${(income - expenses).toFixed(2)}
            </Text>
          </View>

          {/* Recent */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent</Text>
          {transactions.slice(0, 5).map((t) => (
            <View key={t.id} style={[styles.txnRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View>
                <Text style={[styles.txnName, { color: colors.text }]}>{t.merchant_name ?? 'Transaction'}</Text>
                <Text style={[styles.txnDate, { color: colors.icon }]}>{t.posted_date ?? '—'}</Text>
              </View>
              <Text style={[styles.txnAmount, {
                color: t.transaction_type === 'income' ? colors.income : colors.expense,
              }]}>
                {t.transaction_type === 'income' ? '+' : '-'}${Math.abs(Number(t.amount)).toFixed(2)}
              </Text>
            </View>
          ))}
          {transactions.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.icon }]}>No transactions yet</Text>
          )}
        </ScrollView>
      )}

      {activeTab === 'transactions' && (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id}
          contentContainerStyle={[styles.content, transactions.length === 0 && styles.centerContent]}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.icon }]}>No transactions yet</Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.txnRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View>
                <Text style={[styles.txnName, { color: colors.text }]}>{item.merchant_name ?? 'Transaction'}</Text>
                <Text style={[styles.txnDate, { color: colors.icon }]}>{item.posted_date ?? '—'}</Text>
              </View>
              <Text style={[styles.txnAmount, {
                color: item.transaction_type === 'income' ? colors.income : colors.expense,
              }]}>
                {item.transaction_type === 'income' ? '+' : '-'}${Math.abs(Number(item.amount)).toFixed(2)}
              </Text>
            </View>
          )}
        />
      )}

      {activeTab === 'budgets' && (
        <ScrollView contentContainerStyle={[styles.content, budgets.length === 0 && styles.centerContent]}>
          {budgets.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.icon }]}>No budgets set yet</Text>
          ) : (
            budgets.map((b) => (
              <View key={b.id} style={[styles.budgetCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.budgetHeader}>
                  <View style={styles.budgetLeft}>
                    {b.category?.icon ? <Text style={styles.budgetIcon}>{b.category.icon}</Text> : null}
                    <Text style={[styles.budgetName, { color: colors.text }]}>
                      {b.category?.name ?? 'Uncategorized'}
                    </Text>
                  </View>
                  <Text style={[styles.budgetLimit, { color: colors.tint }]}>
                    ${Number(b.amount_limit).toFixed(2)}
                  </Text>
                </View>
                <Text style={[styles.budgetDuration, { color: colors.icon }]}>
                  {b.duration_type ?? 'Monthly'}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

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
    paddingBottom: 8,
  },
  title: { fontSize: 26, fontWeight: '700' },
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

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabBtnText: { fontSize: 13, fontWeight: '600' },

  content: { padding: 20, gap: 12 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  greeting: { fontSize: 22, fontWeight: '700', marginBottom: 4 },

  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  summaryLabel: { fontSize: 12, fontWeight: '500' },
  summaryAmount: { fontSize: 20, fontWeight: '700' },

  netCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netLabel: { fontSize: 14, fontWeight: '500' },
  netAmount: { fontSize: 22, fontWeight: '800' },

  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 4 },

  txnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  txnName: { fontSize: 14, fontWeight: '500' },
  txnDate: { fontSize: 12, marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: '700' },

  emptyText: { fontSize: 15 },

  budgetCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 6 },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  budgetIcon: { fontSize: 20 },
  budgetName: { fontSize: 16, fontWeight: '600' },
  budgetLimit: { fontSize: 18, fontWeight: '700' },
  budgetDuration: { fontSize: 13 },
});
