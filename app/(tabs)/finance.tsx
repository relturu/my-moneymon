import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Transaction, Budget, Category } from '@/types/database';

type BudgetWithCategory = Budget & { category: Category | null };
type SubTab = 'overview' | 'transactions' | 'budgets';

function formatMonthKey(key: string): string {
  const [year, month] = key.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function groupByMonth(txns: Transaction[]): { month: string; label: string; items: Transaction[] }[] {
  const map = new Map<string, Transaction[]>();
  for (const t of txns) {
    const key = t.posted_date ? t.posted_date.slice(0, 7) : 'Unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.keys())
    .sort()
    .reverse()
    .map((k) => ({
      month: k,
      label: k === 'Unknown' ? 'Unknown' : formatMonthKey(k),
      items: map.get(k)!,
    }));
}

function formatAmount(raw: string): string {
  const n = parseFloat(raw);
  return isNaN(n) ? raw : n.toFixed(2);
}

export default function FinanceScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);
  const [userName, setUserName] = useState('');

  // Add/edit transaction modal
  const [txnModal, setTxnModal] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [txnName, setTxnName] = useState('');
  const [txnAmount, setTxnAmount] = useState('');
  const [txnType, setTxnType] = useState<'expense' | 'income'>('expense');
  const [txnCategoryId, setTxnCategoryId] = useState<string | null>(null);
  const [txnCategoryExpanded, setTxnCategoryExpanded] = useState(false);
  const [savingTxn, setSavingTxn] = useState(false);

  // Add/edit budget modal
  const [budgetModal, setBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithCategory | null>(null);
  const [budgetCategoryId, setBudgetCategoryId] = useState<string | null>(null);
  const [budgetLimit, setBudgetLimit] = useState('');
  const [budgetDuration, setBudgetDuration] = useState<'monthly' | 'weekly'>('monthly');
  const [budgetCategoryExpanded, setBudgetCategoryExpanded] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('users').select('coin_balance, user_name').eq('id', user.id).single();
    setCoinBalance((profile as any)?.coin_balance ?? 0);
    setUserName((profile as any)?.user_name ?? '');

    const { data: txns } = await supabase
      .from('transactions').select('*').eq('user_id', user.id)
      .order('posted_date', { ascending: false });
    setTransactions((txns as Transaction[] | null) ?? []);

    const { data: bdgs } = await supabase
      .from('budgets').select('*, category:categories(*)')
      .eq('user_id', user.id).eq('is_active', true);
    setBudgets((bdgs as BudgetWithCategory[] | null) ?? []);

    const { data: cats } = await supabase
      .from('categories').select('*')
      .or('is_default.eq.true,user_id.eq.' + user.id)
      .order('name', { ascending: true });
    setCategories((cats as Category[] | null) ?? []);
  }

  function openAddTxn() {
    setEditingTxn(null);
    setTxnName(''); setTxnAmount(''); setTxnType('expense'); setTxnCategoryId(null);
    setTxnModal(true);
  }

  function openEditTxn(t: Transaction) {
    setEditingTxn(t);
    setTxnName(t.merchant_name ?? '');
    setTxnAmount(Math.abs(Number(t.amount)).toFixed(2));
    setTxnType(t.transaction_type);
    setTxnCategoryId(t.category_id);
    setTxnCategoryExpanded(false);
    setTxnModal(true);
  }

  function closeTxnModal() {
    setTxnModal(false);
    setTxnCategoryExpanded(false);
    setEditingTxn(null);
  }

  function openAddBudget() {
    setEditingBudget(null);
    setBudgetCategoryId(null); setBudgetLimit(''); setBudgetDuration('monthly');
    setBudgetModal(true);
  }

  function openEditBudget(b: BudgetWithCategory) {
    setEditingBudget(b);
    setBudgetCategoryId(b.category_id);
    setBudgetLimit(Number(b.amount_limit).toFixed(2));
    setBudgetDuration((b.duration_type as 'monthly' | 'weekly') ?? 'monthly');
    setBudgetCategoryExpanded(false);
    setBudgetModal(true);
  }

  function closeBudgetModal() {
    setBudgetModal(false);
    setBudgetCategoryExpanded(false);
    setEditingBudget(null);
  }

  async function saveTransaction() {
    if (!txnName.trim() || !txnAmount) return;
    setSavingTxn(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingTxn(false); return; }

    if (editingTxn) {
      await (supabase as any).from('transactions').update({
        merchant_name: txnName.trim(),
        amount: parseFloat(txnAmount),
        transaction_type: txnType,
        category_id: txnCategoryId ?? null,
      }).eq('id', editingTxn.id);
    } else {
      await (supabase as any).from('transactions').insert({
        user_id: user.id,
        merchant_name: txnName.trim(),
        amount: parseFloat(txnAmount),
        transaction_type: txnType,
        category_id: txnCategoryId ?? null,
        posted_date: new Date().toISOString().split('T')[0],
      });
    }

    setSavingTxn(false);
    closeTxnModal();
    await load();
  }

  function confirmDeleteTxn(t: Transaction) {
    Alert.alert(
      'Delete Transaction',
      `Delete "${t.merchant_name ?? 'this transaction'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await (supabase as any).from('transactions').delete().eq('id', t.id);
            await load();
          },
        },
      ]
    );
  }

  async function saveBudget() {
    if (!budgetLimit) return;
    setSavingBudget(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingBudget(false); return; }

    if (editingBudget) {
      await (supabase as any).from('budgets').update({
        category_id: budgetCategoryId ?? null,
        amount_limit: parseFloat(budgetLimit),
        duration_type: budgetDuration,
      }).eq('id', editingBudget.id);
    } else {
      await (supabase as any).from('budgets').insert({
        user_id: user.id,
        category_id: budgetCategoryId ?? null,
        amount_limit: parseFloat(budgetLimit),
        duration_type: budgetDuration,
        is_active: true,
      });
    }

    setSavingBudget(false);
    closeBudgetModal();
    await load();
  }

  function confirmDeleteBudget(b: BudgetWithCategory) {
    Alert.alert(
      'Delete Budget',
      `Delete budget for "${b.category?.name ?? 'All categories'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await (supabase as any).from('budgets').delete().eq('id', b.id);
            await load();
          },
        },
      ]
    );
  }

  const income = transactions.filter((t) => t.transaction_type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);
  const expenses = transactions.filter((t) => t.transaction_type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);
  const net = income - expenses;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const recentTxns = transactions.filter((t) => {
    if (!t.posted_date) return false;
    return new Date(t.posted_date) >= oneWeekAgo;
  });

  const txnGroups = groupByMonth(transactions);
  const selectedTxnCategory = categories.find((c) => c.id === txnCategoryId);
  const selectedBudgetCategory = categories.find((c) => c.id === budgetCategoryId);

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
        {(['overview', 'transactions', 'budgets'] as SubTab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, subTab === t && { backgroundColor: colors.tint }]}
            onPress={() => setSubTab(t)}>
            <Text style={[styles.tabBtnText, { color: subTab === t ? '#fff' : colors.icon }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Overview */}
      {subTab === 'overview' && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.greeting, { color: colors.text }]}>
            Hey{userName ? `, ${userName}` : ''}!
          </Text>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.icon }]}>Income</Text>
              <Text style={[styles.summaryAmount, { color: colors.income }]}>+${income.toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.icon }]}>Expenses</Text>
              <Text style={[styles.summaryAmount, { color: colors.expense }]}>-${expenses.toFixed(2)}</Text>
            </View>
          </View>
          <View style={[styles.netCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.netLabel, { color: colors.icon }]}>Net</Text>
            <Text style={[styles.netAmount, { color: net >= 0 ? colors.income : colors.expense }]}>
              {net >= 0 ? '+' : '-'}${Math.abs(net).toFixed(2)}
            </Text>
          </View>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent</Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.tint }]}
              onPress={openAddTxn}>
              <IconSymbol size={14} name="plus" color="#fff" />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {recentTxns.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.icon }]}>No transactions in the last week</Text>
          ) : (
            recentTxns.map((t) => (
              <TxnRow
                key={t.id}
                item={t}
                colors={colors}
                onEdit={() => openEditTxn(t)}
                onDelete={() => confirmDeleteTxn(t)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Transactions */}
      {subTab === 'transactions' && (
        <>
          <View style={styles.listHeader}>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.tint }]}
              onPress={openAddTxn}>
              <IconSymbol size={14} name="plus" color="#fff" />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={[styles.content, txnGroups.length === 0 && styles.centerContent]}>
            {txnGroups.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.icon }]}>No transactions yet</Text>
            ) : (
              txnGroups.map((group) => (
                <View key={group.month} style={styles.monthGroup}>
                  <Text style={[styles.monthLabel, { color: colors.icon }]}>{group.label}</Text>
                  {group.items.map((t) => (
                    <TxnRow
                      key={t.id}
                      item={t}
                      colors={colors}
                      onEdit={() => openEditTxn(t)}
                      onDelete={() => confirmDeleteTxn(t)}
                    />
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        </>
      )}

      {/* Budgets */}
      {subTab === 'budgets' && (
        <>
          <View style={styles.listHeader}>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.tint }]}
              onPress={openAddBudget}>
              <IconSymbol size={14} name="plus" color="#fff" />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={[styles.content, budgets.length === 0 && styles.centerContent]}>
            {budgets.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.icon }]}>No budgets set yet</Text>
            ) : (
              budgets.map((b) => (
                <View key={b.id} style={[styles.budgetCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.budgetRow}>
                    <View style={styles.budgetLeft}>
                      {b.category?.icon ? <Text style={styles.budgetIcon}>{b.category.icon}</Text> : null}
                      <Text style={[styles.budgetName, { color: colors.text }]}>
                        {b.category?.name ?? 'All categories'}
                      </Text>
                    </View>
                    <View style={styles.budgetRight}>
                      <Text style={[styles.budgetLimit, { color: colors.tint }]}>
                        ${Number(b.amount_limit).toFixed(2)}
                      </Text>
                      <TouchableOpacity onPress={() => openEditBudget(b)} style={styles.iconBtn}>
                        <IconSymbol size={16} name="pencil" color={colors.icon} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmDeleteBudget(b)} style={styles.iconBtn}>
                        <IconSymbol size={16} name="trash" color={colors.expense} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={[styles.budgetDuration, { color: colors.icon }]}>
                    {b.duration_type ?? 'Monthly'}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </>
      )}

      {/* ── Add/Edit Transaction Modal ── */}
      <Modal visible={txnModal} transparent animationType="slide" onRequestClose={closeTxnModal}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeTxnModal} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {editingTxn ? 'Edit Transaction' : 'Add Transaction'}
            </Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetBody}>

              <View style={[styles.typeToggle, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {(['expense', 'income'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeBtn, txnType === type && {
                      backgroundColor: type === 'income' ? colors.income : colors.expense,
                    }]}
                    onPress={() => setTxnType(type)}>
                    <Text style={[styles.typeBtnText, { color: txnType === type ? '#fff' : colors.icon }]}>
                      {type === 'income' ? '+ Income' : '− Expense'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Description (e.g. Coffee)"
                placeholderTextColor={colors.icon}
                value={txnName}
                onChangeText={setTxnName}
              />

              <View style={[styles.amountRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.currencySymbol, { color: colors.text }]}>$</Text>
                <TextInput
                  style={[styles.amountInput, { color: colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.icon}
                  value={txnAmount}
                  onChangeText={setTxnAmount}
                  onBlur={() => setTxnAmount((v) => formatAmount(v))}
                  keyboardType="decimal-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.picker, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => setTxnCategoryExpanded(!txnCategoryExpanded)}>
                <Text style={[styles.pickerText, { color: selectedTxnCategory ? colors.text : colors.icon }]}>
                  {selectedTxnCategory
                    ? `${selectedTxnCategory.icon ?? ''} ${selectedTxnCategory.name}`
                    : 'Category (optional)'}
                </Text>
                <IconSymbol
                  size={16}
                  name={txnCategoryExpanded ? 'chevron.up' : 'chevron.down'}
                  color={colors.icon}
                />
              </TouchableOpacity>

              {txnCategoryExpanded && (
                <View style={[styles.catList, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.catRow, { borderBottomColor: colors.border }]}
                    onPress={() => { setTxnCategoryId(null); setTxnCategoryExpanded(false); }}>
                    <Text style={[styles.catText, { color: colors.icon }]}>None</Text>
                  </TouchableOpacity>
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.catRow, { borderBottomColor: colors.border }]}
                      onPress={() => { setTxnCategoryId(c.id); setTxnCategoryExpanded(false); }}>
                      <Text style={styles.catEmoji}>{c.icon ?? '•'}</Text>
                      <Text style={[styles.catText, { color: colors.text }]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: txnName && txnAmount ? colors.tint : colors.border }]}
              onPress={saveTransaction}
              disabled={!txnName.trim() || !txnAmount || savingTxn}>
              <Text style={[styles.saveBtnText, { color: txnName && txnAmount ? '#fff' : colors.icon }]}>
                {savingTxn ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add/Edit Budget Modal ── */}
      <Modal visible={budgetModal} transparent animationType="slide" onRequestClose={closeBudgetModal}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeBudgetModal} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {editingBudget ? 'Edit Budget' : 'Set Budget'}
            </Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetBody}>

              <TouchableOpacity
                style={[styles.picker, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => setBudgetCategoryExpanded(!budgetCategoryExpanded)}>
                <Text style={[styles.pickerText, { color: selectedBudgetCategory ? colors.text : colors.icon }]}>
                  {selectedBudgetCategory
                    ? `${selectedBudgetCategory.icon ?? ''} ${selectedBudgetCategory.name}`
                    : 'Category (optional)'}
                </Text>
                <IconSymbol
                  size={16}
                  name={budgetCategoryExpanded ? 'chevron.up' : 'chevron.down'}
                  color={colors.icon}
                />
              </TouchableOpacity>

              {budgetCategoryExpanded && (
                <View style={[styles.catList, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.catRow, { borderBottomColor: colors.border }]}
                    onPress={() => { setBudgetCategoryId(null); setBudgetCategoryExpanded(false); }}>
                    <Text style={[styles.catText, { color: colors.icon }]}>None</Text>
                  </TouchableOpacity>
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.catRow, { borderBottomColor: colors.border }]}
                      onPress={() => { setBudgetCategoryId(c.id); setBudgetCategoryExpanded(false); }}>
                      <Text style={styles.catEmoji}>{c.icon ?? '•'}</Text>
                      <Text style={[styles.catText, { color: colors.text }]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={[styles.amountRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.currencySymbol, { color: colors.text }]}>$</Text>
                <TextInput
                  style={[styles.amountInput, { color: colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.icon}
                  value={budgetLimit}
                  onChangeText={setBudgetLimit}
                  onBlur={() => setBudgetLimit((v) => formatAmount(v))}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={[styles.typeToggle, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {(['monthly', 'weekly'] as const).map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.typeBtn, budgetDuration === d && { backgroundColor: colors.tint }]}
                    onPress={() => setBudgetDuration(d)}>
                    <Text style={[styles.typeBtnText, { color: budgetDuration === d ? '#fff' : colors.icon }]}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: budgetLimit ? colors.tint : colors.border }]}
              onPress={saveBudget}
              disabled={!budgetLimit || savingBudget}>
              <Text style={[styles.saveBtnText, { color: budgetLimit ? '#fff' : colors.icon }]}>
                {savingBudget ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

function TxnRow({
  item,
  colors,
  onEdit,
  onDelete,
}: {
  item: Transaction;
  colors: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[txnStyles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={txnStyles.left}>
        <Text style={[txnStyles.name, { color: colors.text }]}>{item.merchant_name ?? 'Transaction'}</Text>
        <Text style={[txnStyles.date, { color: colors.icon }]}>{item.posted_date ?? '—'}</Text>
      </View>
      <View style={txnStyles.right}>
        <Text style={[txnStyles.amount, {
          color: item.transaction_type === 'income' ? colors.income : colors.expense,
        }]}>
          {item.transaction_type === 'income' ? '+' : '-'}${Math.abs(Number(item.amount)).toFixed(2)}
        </Text>
        <TouchableOpacity onPress={onEdit} style={txnStyles.iconBtn}>
          <IconSymbol size={15} name="pencil" color={colors.icon} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={txnStyles.iconBtn}>
          <IconSymbol size={15} name="trash" color={colors.expense} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const txnStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  left: { flex: 1, marginRight: 8 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14, fontWeight: '500' },
  date: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '700' },
  iconBtn: { padding: 4 },
});

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
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabBtnText: { fontSize: 13, fontWeight: '600' },

  content: { padding: 16, gap: 10 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  listHeader: { paddingHorizontal: 20, paddingBottom: 8, alignItems: 'flex-end' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  greeting: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
  summaryLabel: { fontSize: 12, fontWeight: '500' },
  summaryAmount: { fontSize: 20, fontWeight: '700' },
  netCard: {
    borderRadius: 14, borderWidth: 1, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  netLabel: { fontSize: 14, fontWeight: '500' },
  netAmount: { fontSize: 22, fontWeight: '800' },

  emptyText: { fontSize: 15 },

  monthGroup: { gap: 0 },
  monthLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 },

  budgetCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  budgetRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  budgetIcon: { fontSize: 20 },
  budgetName: { fontSize: 15, fontWeight: '600' },
  budgetLimit: { fontSize: 16, fontWeight: '700' },
  budgetDuration: { fontSize: 13 },
  iconBtn: { padding: 6 },

  // Modal
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  sheetBody: { gap: 12, paddingBottom: 16 },

  typeToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  typeBtnText: { fontSize: 14, fontWeight: '600' },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencySymbol: { fontSize: 15, marginRight: 4 },
  amountInput: { flex: 1, paddingVertical: 14, fontSize: 15 },

  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerText: { fontSize: 15 },

  catList: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  catEmoji: { fontSize: 18, width: 24, textAlign: 'center' },
  catText: { fontSize: 15 },

  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700' },
});
