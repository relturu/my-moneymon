import { useCallback, useEffect, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Transaction, Budget, Category } from '@/types/database';

type BudgetWithCategory = Budget & { category: Category | null };
type BudgetExpanded = BudgetWithCategory & { spent: number; transactions: Transaction[] };
type SubTab = 'overview' | 'transactions' | 'budgets';

const CHART_COLORS = ['#69835C', '#A78BFA', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#B7C8BF', '#F97316'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeBudgetDates(duration: 'monthly' | 'weekly'): { start_date: string; end_date: string } {
  const now = new Date();
  let start: Date, end: Date;
  if (duration === 'monthly') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else {
    start = new Date(now);
    end = new Date(now);
    end.setDate(end.getDate() + 6);
  }
  return {
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0],
  };
}

function parseDateInput(raw: string): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return null;
}

function fmtDateStr(s: string): string {
  const [y, mo, d] = s.split('-');
  return `${parseInt(mo)}/${parseInt(d)}/${y.slice(2)}`;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (start && end) return `${fmtDateStr(start)}–${fmtDateStr(end)}`;
  if (start) return `from ${fmtDateStr(start)}`;
  return '';
}

function computeSpent(
  budget: BudgetWithCategory,
  txns: Transaction[]
): { spent: number; matched: Transaction[] } {
  const hasRange = !!(budget.start_date && budget.end_date);
  const matched = txns.filter(t => {
    if (t.transaction_type !== 'expense') return false;
    if (budget.category_id !== null && t.category_id !== budget.category_id) return false;
    if (hasRange) {
      if (!t.posted_date) return false;
      if (t.posted_date < budget.start_date! || t.posted_date > budget.end_date!) return false;
    }
    return true;
  });
  return { spent: matched.reduce((s, t) => s + Number(t.amount), 0), matched };
}

function computeAllOtherSpending(
  txns: Transaction[],
  categoryBudgets: BudgetWithCategory[]
): { amount: number; transactions: Transaction[] } {
  const budgetedIds = new Set(categoryBudgets.map(b => b.category_id).filter(Boolean));
  const matched = txns.filter(t =>
    t.transaction_type === 'expense' && !budgetedIds.has(t.category_id)
  );
  return { amount: matched.reduce((s, t) => s + Number(t.amount), 0), transactions: matched };
}

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
    .sort().reverse()
    .map(k => ({ month: k, label: k === 'Unknown' ? 'Unknown' : formatMonthKey(k), items: map.get(k)! }));
}

function formatAmount(raw: string): string {
  const n = parseFloat(raw);
  return isNaN(n) ? raw : n.toFixed(2);
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function FinanceScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const params = useLocalSearchParams<{ tab?: string; hint?: string }>();
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [questHint, setQuestHint] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);
  const [userName, setUserName] = useState('');

  // Transaction modal
  const [txnModal, setTxnModal] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [txnName, setTxnName] = useState('');
  const [txnAmount, setTxnAmount] = useState('');
  const [txnType, setTxnType] = useState<'expense' | 'income'>('expense');
  const [txnCategoryId, setTxnCategoryId] = useState<string | null>(null);
  const [txnCategoryExpanded, setTxnCategoryExpanded] = useState(false);
  const [savingTxn, setSavingTxn] = useState(false);

  // Budget modal
  const [budgetModal, setBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithCategory | null>(null);
  const [budgetCategoryId, setBudgetCategoryId] = useState<string | null>(null);
  const [budgetLimit, setBudgetLimit] = useState('');
  const [budgetDuration, setBudgetDuration] = useState<'monthly' | 'weekly'>('monthly');
  const [budgetCategoryExpanded, setBudgetCategoryExpanded] = useState(false);
  const [budgetUseCustomDates, setBudgetUseCustomDates] = useState(false);
  const [budgetCustomStart, setBudgetCustomStart] = useState('');
  const [budgetCustomEnd, setBudgetCustomEnd] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);

  // Expanded budget card
  const [expandedBudgetId, setExpandedBudgetId] = useState<string | null>(null);

  // Manage Categories modal
  const [catModal, setCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    if (params.tab && (['overview', 'transactions', 'budgets'] as string[]).includes(params.tab)) {
      setSubTab(params.tab as SubTab);
    }
    if (params.hint) setQuestHint(params.hint);
  }, [params.tab, params.hint]);

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

  // ── Transaction actions ──────────────────────────────────────────────────────

  function openAddTxn() {
    setEditingTxn(null);
    setTxnName(''); setTxnAmount(''); setTxnType('expense'); setTxnCategoryId(null);
    setTxnCategoryExpanded(false);
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
    setTxnModal(false); setTxnCategoryExpanded(false); setEditingTxn(null);
  }

  async function saveTransaction() {
    if (!txnName.trim() || !txnAmount) return;
    setSavingTxn(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingTxn(false); return; }
    if (editingTxn) {
      await (supabase as any).from('transactions').update({
        merchant_name: txnName.trim(), amount: parseFloat(txnAmount),
        transaction_type: txnType, category_id: txnCategoryId ?? null,
      }).eq('id', editingTxn.id);
    } else {
      await (supabase as any).from('transactions').insert({
        user_id: user.id, merchant_name: txnName.trim(),
        amount: parseFloat(txnAmount), transaction_type: txnType,
        category_id: txnCategoryId ?? null,
        posted_date: new Date().toISOString().split('T')[0],
      });
    }
    setSavingTxn(false); closeTxnModal(); await load();
  }

  function confirmDeleteTxn(t: Transaction) {
    Alert.alert('Delete Transaction', `Delete "${t.merchant_name ?? 'this transaction'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await (supabase as any).from('transactions').delete().eq('id', t.id);
        await load();
      }},
    ]);
  }

  // ── Budget actions ───────────────────────────────────────────────────────────

  function openAddBudget() {
    setEditingBudget(null);
    setBudgetCategoryId(null); setBudgetLimit(''); setBudgetDuration('monthly');
    setBudgetUseCustomDates(false); setBudgetCustomStart(''); setBudgetCustomEnd('');
    setBudgetCategoryExpanded(false);
    setBudgetModal(true);
  }

  function openEditBudget(b: BudgetWithCategory) {
    setEditingBudget(b);
    setBudgetCategoryId(b.category_id);
    setBudgetLimit(Number(b.amount_limit).toFixed(2));
    setBudgetDuration((b.duration_type as 'monthly' | 'weekly') ?? 'monthly');
    const isCustom = b.duration_type === 'custom';
    setBudgetUseCustomDates(isCustom);
    setBudgetCustomStart(b.start_date ?? '');
    setBudgetCustomEnd(b.end_date ?? '');
    setBudgetCategoryExpanded(false);
    setBudgetModal(true);
  }

  function closeBudgetModal() {
    setBudgetModal(false); setBudgetCategoryExpanded(false);
    setBudgetUseCustomDates(false); setBudgetCustomStart(''); setBudgetCustomEnd('');
    setEditingBudget(null);
  }

  async function saveBudget() {
    if (!budgetLimit) return;
    setSavingBudget(true);
    let startDate: string | null = null;
    let endDate: string | null = null;
    if (budgetUseCustomDates) {
      startDate = parseDateInput(budgetCustomStart);
      endDate = parseDateInput(budgetCustomEnd);
      if (!startDate || !endDate) {
        Alert.alert('Invalid dates', 'Please use MM/DD/YYYY format.');
        setSavingBudget(false); return;
      }
      if (startDate > endDate) {
        Alert.alert('Invalid dates', 'Start date must be before end date.');
        setSavingBudget(false); return;
      }
    } else {
      const d = computeBudgetDates(budgetDuration);
      startDate = d.start_date; endDate = d.end_date;
    }
    const payload = {
      category_id: budgetCategoryId ?? null,
      amount_limit: parseFloat(budgetLimit),
      duration_type: budgetUseCustomDates ? 'custom' : budgetDuration,
      start_date: startDate, end_date: endDate,
    };
    if (editingBudget) {
      await (supabase as any).from('budgets').update(payload).eq('id', editingBudget.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSavingBudget(false); return; }
      await (supabase as any).from('budgets').insert({ ...payload, user_id: user.id, is_active: true });
    }
    setSavingBudget(false); closeBudgetModal(); await load();
  }

  function confirmDeleteBudget(b: BudgetWithCategory) {
    Alert.alert('Delete Budget', `Delete budget for "${b.category?.name ?? 'Overall Spending Limit'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await (supabase as any).from('budgets').delete().eq('id', b.id);
        await load();
      }},
    ]);
  }

  // ── Category actions ─────────────────────────────────────────────────────────

  async function saveCategory() {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingCat(false); return; }
    await (supabase as any).from('categories').insert({
      name: newCatName.trim(), icon: newCatEmoji.trim() || null,
      is_default: false, user_id: user.id,
    });
    setNewCatName(''); setNewCatEmoji('');
    setSavingCat(false); await load();
  }

  function confirmDeleteCategory(c: Category) {
    Alert.alert('Delete Category', `Delete "${c.name}"? Budgets using this category will become uncategorized.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await (supabase as any).from('categories').delete().eq('id', c.id);
        await load();
      }},
    ]);
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const income = transactions.filter(t => t.transaction_type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);
  const expenses = transactions.filter(t => t.transaction_type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);
  const net = income - expenses;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const recentTxns = transactions.filter(t =>
    t.posted_date ? new Date(t.posted_date) >= oneWeekAgo : false
  );
  const txnGroups = groupByMonth(transactions);

  const overallBudget = budgets.find(b => b.category_id === null) ?? null;
  const categoryBudgets = budgets.filter(b => b.category_id !== null);
  const enrichedBudgets: BudgetExpanded[] = categoryBudgets.map(b => {
    const { spent, matched } = computeSpent(b, transactions);
    return { ...b, spent, transactions: matched };
  });
  const overallEnriched: BudgetExpanded | null = overallBudget
    ? (() => { const { spent, matched } = computeSpent(overallBudget, transactions); return { ...overallBudget, spent, transactions: matched }; })()
    : null;
  const { amount: otherSpent, transactions: otherTxns } =
    computeAllOtherSpending(transactions, categoryBudgets);

  const selectedTxnCategory = categories.find(c => c.id === txnCategoryId);
  const selectedBudgetCategory = categories.find(c => c.id === budgetCategoryId);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>

      <View style={styles.topBar}>
        <Text style={[styles.title, { color: colors.text }]}>Finance</Text>
        <View style={[styles.wishBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <IconSymbol size={16} name="heart.fill" color={colors.coin} />
          <Text style={[styles.wishText, { color: colors.coin }]}>{coinBalance}</Text>
        </View>
      </View>

      <View style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(['overview', 'transactions', 'budgets'] as SubTab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, subTab === t && { backgroundColor: colors.tint }]}
            onPress={() => { setSubTab(t); setQuestHint(null); }}>
            <Text style={[styles.tabBtnText, { color: subTab === t ? '#fff' : colors.icon }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quest hint banner */}
      {questHint && (
        <View style={[styles.hintBanner, { backgroundColor: colors.tint + '1A', borderColor: colors.tint }]}>
          <IconSymbol size={14} name="scroll.fill" color={colors.tint} />
          <Text style={[styles.hintText, { color: colors.tint }]}>{questHint}</Text>
          <TouchableOpacity onPress={() => setQuestHint(null)}>
            <IconSymbol size={14} name="xmark" color={colors.tint} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Overview ── */}
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
          <SpendingBreakdown
            enrichedBudgets={enrichedBudgets}
            otherSpent={otherSpent}
            overallEnriched={overallEnriched}
            colors={colors}
          />
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent</Text>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.tint }]} onPress={openAddTxn}>
              <IconSymbol size={14} name="plus" color="#fff" />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {recentTxns.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.icon }]}>No transactions in the last week</Text>
          ) : recentTxns.map(t => (
            <TxnRow key={t.id} item={t} colors={colors}
              onEdit={() => openEditTxn(t)} onDelete={() => confirmDeleteTxn(t)} />
          ))}
        </ScrollView>
      )}

      {/* ── Transactions ── */}
      {subTab === 'transactions' && (
        <>
          <View style={styles.listHeader}>
            <View />
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.tint }]} onPress={openAddTxn}>
              <IconSymbol size={14} name="plus" color="#fff" />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={[styles.content, txnGroups.length === 0 && styles.centerContent]}>
            {txnGroups.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.icon }]}>No transactions yet</Text>
            ) : txnGroups.map(group => (
              <View key={group.month} style={styles.monthGroup}>
                <Text style={[styles.monthLabel, { color: colors.icon }]}>{group.label}</Text>
                {group.items.map(t => (
                  <TxnRow key={t.id} item={t} colors={colors}
                    onEdit={() => openEditTxn(t)} onDelete={() => confirmDeleteTxn(t)} />
                ))}
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* ── Budgets ── */}
      {subTab === 'budgets' && (
        <>
          <View style={styles.listHeader}>
            <TouchableOpacity onPress={() => setCatModal(true)} style={styles.manageBtn}>
              <Text style={[styles.manageBtnText, { color: colors.tint }]}>Manage Categories</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.tint }]} onPress={openAddBudget}>
              <IconSymbol size={14} name="plus" color="#fff" />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.content}>

            {/* Overall spending limit */}
            {overallEnriched ? (
              <OverallBudgetHeroCard
                budget={overallEnriched}
                onEdit={() => openEditBudget(overallEnriched)}
                onDelete={() => confirmDeleteBudget(overallEnriched)}
                colors={colors}
              />
            ) : (
              <TouchableOpacity
                style={[styles.overallPlaceholder, { borderColor: colors.border }]}
                onPress={openAddBudget}>
                <Text style={[styles.overallPlaceholderText, { color: colors.icon }]}>
                  + Set an overall spending limit (optional)
                </Text>
              </TouchableOpacity>
            )}

            {/* Category budgets */}
            {enrichedBudgets.map(b => (
              <BudgetCard
                key={b.id}
                budget={b}
                isExpanded={expandedBudgetId === b.id}
                onToggle={() => setExpandedBudgetId(p => p === b.id ? null : b.id)}
                onEdit={() => openEditBudget(b)}
                onDelete={() => confirmDeleteBudget(b)}
                colors={colors}
              />
            ))}

            {budgets.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.icon }]}>No budgets set yet — tap Add to get started</Text>
            )}

            {/* All other spending */}
            <View style={[styles.otherSpendingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.otherSpendingRow}>
                <Text style={[styles.otherSpendingLabel, { color: colors.text }]}>All other spending</Text>
                <Text style={[styles.otherSpendingAmount, { color: otherSpent > 0 ? colors.expense : colors.icon }]}>
                  ${otherSpent.toFixed(2)}
                </Text>
              </View>
              {otherTxns.length > 0 && (
                <TouchableOpacity onPress={() => setExpandedBudgetId(p => p === 'other' ? null : 'other')}>
                  <Text style={[styles.showHide, { color: colors.tint }]}>
                    {expandedBudgetId === 'other'
                      ? 'Hide'
                      : `Show ${otherTxns.length} transaction${otherTxns.length === 1 ? '' : 's'}`}
                  </Text>
                </TouchableOpacity>
              )}
              {expandedBudgetId === 'other' && otherTxns.map(t => (
                <View key={t.id} style={[bcStyles.txnRow, { borderTopColor: colors.border }]}>
                  <View style={bcStyles.txnLeft}>
                    <Text style={[bcStyles.txnName, { color: colors.text }]}>{t.merchant_name ?? 'Transaction'}</Text>
                    <Text style={[bcStyles.txnDate, { color: colors.icon }]}>{t.posted_date ?? '—'}</Text>
                  </View>
                  <Text style={[bcStyles.txnAmount, { color: colors.expense }]}>
                    -${Math.abs(Number(t.amount)).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      {/* ── Add/Edit Transaction Modal ── */}
      <Modal visible={txnModal} transparent animationType="slide" onRequestClose={closeTxnModal}>
        <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeTxnModal} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {editingTxn ? 'Edit Transaction' : 'Add Transaction'}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody}>
              <View style={[styles.typeToggle, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {(['expense', 'income'] as const).map(type => (
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
                  onBlur={() => setTxnAmount(v => formatAmount(v))}
                  keyboardType="decimal-pad"
                />
              </View>
              <TouchableOpacity
                style={[styles.picker, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => setTxnCategoryExpanded(!txnCategoryExpanded)}>
                <Text style={[styles.pickerText, { color: selectedTxnCategory ? colors.text : colors.icon }]}>
                  {selectedTxnCategory ? `${selectedTxnCategory.icon ?? ''} ${selectedTxnCategory.name}` : 'Category (optional)'}
                </Text>
                <IconSymbol size={16} name={txnCategoryExpanded ? 'chevron.up' : 'chevron.down'} color={colors.icon} />
              </TouchableOpacity>
              {txnCategoryExpanded && (
                <View style={[styles.catList, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <TouchableOpacity style={[styles.catRow, { borderBottomColor: colors.border }]}
                    onPress={() => { setTxnCategoryId(null); setTxnCategoryExpanded(false); }}>
                    <Text style={[styles.catText, { color: colors.icon }]}>None</Text>
                  </TouchableOpacity>
                  {categories.map(c => (
                    <TouchableOpacity key={c.id} style={[styles.catRow, { borderBottomColor: colors.border }]}
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
        <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeBudgetModal} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {editingBudget ? 'Edit Budget' : 'Set Budget'}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody}>
              <TouchableOpacity
                style={[styles.picker, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => setBudgetCategoryExpanded(!budgetCategoryExpanded)}>
                <Text style={[styles.pickerText, { color: selectedBudgetCategory ? colors.text : colors.icon }]}>
                  {selectedBudgetCategory
                    ? `${selectedBudgetCategory.icon ?? ''} ${selectedBudgetCategory.name}`
                    : 'None (overall spending limit)'}
                </Text>
                <IconSymbol size={16} name={budgetCategoryExpanded ? 'chevron.up' : 'chevron.down'} color={colors.icon} />
              </TouchableOpacity>
              {budgetCategoryExpanded && (
                <View style={[styles.catList, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <TouchableOpacity style={[styles.catRow, { borderBottomColor: colors.border }]}
                    onPress={() => { setBudgetCategoryId(null); setBudgetCategoryExpanded(false); }}>
                    <Text style={[styles.catText, { color: colors.icon }]}>None (overall spending limit)</Text>
                  </TouchableOpacity>
                  {categories.map(c => (
                    <TouchableOpacity key={c.id} style={[styles.catRow, { borderBottomColor: colors.border }]}
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
                  onBlur={() => setBudgetLimit(v => formatAmount(v))}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ opacity: budgetUseCustomDates ? 0.4 : 1 }} pointerEvents={budgetUseCustomDates ? 'none' : 'auto'}>
                <View style={[styles.typeToggle, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  {(['monthly', 'weekly'] as const).map(d => (
                    <TouchableOpacity key={d}
                      style={[styles.typeBtn, budgetDuration === d && { backgroundColor: colors.tint }]}
                      onPress={() => setBudgetDuration(d)}>
                      <Text style={[styles.typeBtnText, { color: budgetDuration === d ? '#fff' : colors.icon }]}>
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.customDateToggleRow}>
                <Text style={[styles.customDateLabel, { color: colors.text }]}>Custom date range</Text>
                <TouchableOpacity
                  onPress={() => setBudgetUseCustomDates(v => !v)}
                  style={[styles.togglePill, { backgroundColor: budgetUseCustomDates ? colors.tint : colors.border }]}>
                  <View style={[styles.toggleThumb, budgetUseCustomDates && styles.toggleThumbOn]} />
                </TouchableOpacity>
              </View>
              {budgetUseCustomDates && (
                <>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                    placeholder="Start date (MM/DD/YYYY)"
                    placeholderTextColor={colors.icon}
                    value={budgetCustomStart}
                    onChangeText={setBudgetCustomStart}
                    keyboardType="numbers-and-punctuation"
                  />
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                    placeholder="End date (MM/DD/YYYY)"
                    placeholderTextColor={colors.icon}
                    value={budgetCustomEnd}
                    onChangeText={setBudgetCustomEnd}
                    keyboardType="numbers-and-punctuation"
                  />
                </>
              )}
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

      {/* ── Manage Categories Modal ── */}
      <Modal visible={catModal} transparent animationType="slide" onRequestClose={() => setCatModal(false)}>
        <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCatModal(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Manage Categories</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody}>
              <View style={styles.newCatRow}>
                <TextInput
                  style={[styles.emojiInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  placeholder="🏷"
                  value={newCatEmoji}
                  onChangeText={setNewCatEmoji}
                  maxLength={2}
                />
                <TextInput
                  style={[styles.catNameInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  placeholder="Category name"
                  placeholderTextColor={colors.icon}
                  value={newCatName}
                  onChangeText={setNewCatName}
                />
                <TouchableOpacity
                  style={[styles.addCatBtn, { backgroundColor: newCatName.trim() ? colors.tint : colors.border }]}
                  onPress={saveCategory}
                  disabled={!newCatName.trim() || savingCat}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Add</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.catList, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {categories.map(c => (
                  <View key={c.id} style={[styles.catRow, { borderBottomColor: colors.border }]}>
                    <Text style={styles.catEmoji}>{c.icon ?? '•'}</Text>
                    <Text style={[styles.catText, { color: colors.text, flex: 1 }]}>{c.name}</Text>
                    {c.is_default ? (
                      <Text style={[styles.defaultBadge, { color: colors.icon }]}>default</Text>
                    ) : (
                      <TouchableOpacity onPress={() => confirmDeleteCategory(c)} style={{ padding: 4 }}>
                        <IconSymbol size={16} name="trash" color={colors.expense} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

// ── TxnRow ─────────────────────────────────────────────────────────────────────

function TxnRow({ item, colors, onEdit, onDelete }: {
  item: Transaction; colors: any; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <View style={[txnStyles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={txnStyles.left}>
        <Text style={[txnStyles.name, { color: colors.text }]}>{item.merchant_name ?? 'Transaction'}</Text>
        <Text style={[txnStyles.date, { color: colors.icon }]}>{item.posted_date ?? '—'}</Text>
      </View>
      <View style={txnStyles.right}>
        <Text style={[txnStyles.amount, { color: item.transaction_type === 'income' ? colors.income : colors.expense }]}>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  left: { flex: 1, marginRight: 8 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14, fontWeight: '500' },
  date: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '700' },
  iconBtn: { padding: 4 },
});

// ── BudgetCard ─────────────────────────────────────────────────────────────────

function BudgetCard({ budget, isExpanded, onToggle, onEdit, onDelete, colors }: {
  budget: BudgetExpanded; isExpanded: boolean;
  onToggle: () => void; onEdit: () => void; onDelete: () => void; colors: any;
}) {
  const dateRange = formatDateRange(budget.start_date, budget.end_date);
  const limit = Number(budget.amount_limit);
  const progress = limit > 0 ? budget.spent / limit : 0;
  const isOver = budget.spent > limit;

  return (
    <View style={[bcStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
        <View style={bcStyles.row1}>
          <View style={bcStyles.nameRow}>
            {budget.category?.icon ? <Text style={bcStyles.catIcon}>{budget.category.icon}</Text> : null}
            <Text style={[bcStyles.name, { color: colors.text }]}>
              {budget.category?.name ?? (budget.category_id === null ? 'Overall Spending Limit' : 'All categories')}
            </Text>
          </View>
          <View style={bcStyles.rightRow}>
            <Text style={[bcStyles.limitText, { color: colors.tint }]}>${limit.toFixed(2)}</Text>
            <TouchableOpacity onPress={onEdit} style={bcStyles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <IconSymbol size={15} name="pencil" color={colors.icon} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} style={bcStyles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <IconSymbol size={15} name="trash" color={colors.expense} />
            </TouchableOpacity>
          </View>
        </View>
        {dateRange ? <Text style={[bcStyles.dateRange, { color: colors.icon }]}>{dateRange}</Text> : null}
        <Text style={[bcStyles.spentSummary, { color: isOver ? colors.expense : colors.icon }]}>
          ${budget.spent.toFixed(2)} spent of ${limit.toFixed(2)}
        </Text>
      </TouchableOpacity>

      {isExpanded && (
        <View>
          <View style={[bcStyles.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[bcStyles.progressFill, {
              width: `${Math.min(progress, 1) * 100}%` as any,
              backgroundColor: isOver ? colors.expense : colors.tint,
            }]} />
          </View>
          {isOver && (
            <Text style={[bcStyles.overBudget, { color: colors.expense }]}>
              Over budget by ${(budget.spent - limit).toFixed(2)}
            </Text>
          )}
          <View style={[bcStyles.divider, { backgroundColor: colors.border }]} />
          {budget.transactions.length === 0 ? (
            <Text style={[bcStyles.emptyTxn, { color: colors.icon }]}>No matching transactions</Text>
          ) : budget.transactions.map(t => (
            <View key={t.id} style={[bcStyles.txnRow, { borderTopColor: colors.border }]}>
              <View style={bcStyles.txnLeft}>
                <Text style={[bcStyles.txnName, { color: colors.text }]}>{t.merchant_name ?? 'Transaction'}</Text>
                <Text style={[bcStyles.txnDate, { color: colors.icon }]}>{t.posted_date ?? '—'}</Text>
              </View>
              <Text style={[bcStyles.txnAmount, { color: colors.expense }]}>
                -${Math.abs(Number(t.amount)).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const bcStyles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  row1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  catIcon: { fontSize: 18 },
  name: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  limitText: { fontSize: 15, fontWeight: '700' },
  iconBtn: { padding: 4 },
  dateRange: { fontSize: 12, marginBottom: 2 },
  spentSummary: { fontSize: 13, marginTop: 2 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 10, marginBottom: 4 },
  progressFill: { height: 8, borderRadius: 4 },
  overBudget: { fontSize: 12, marginBottom: 4 },
  divider: { height: 1, marginVertical: 8 },
  emptyTxn: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  txnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingVertical: 8 },
  txnLeft: { flex: 1, marginRight: 8 },
  txnName: { fontSize: 13, fontWeight: '500' },
  txnDate: { fontSize: 11, marginTop: 1 },
  txnAmount: { fontSize: 13, fontWeight: '600' },
});

// ── DonutChart ──────────────────────────────────────────────────────────────────

function DonutChart({ segments, size = 160, centerLabel, textColor }: {
  segments: { label: string; amount: number; color: string }[];
  size?: number;
  centerLabel: string;
  textColor: string;
}) {
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const total = segments.reduce((s, seg) => s + seg.amount, 0);
  if (total <= 0) return null;

  let accumulated = 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${center}, ${center}`}>
          {segments.map((seg, i) => {
            const length = (seg.amount / total) * circumference;
            const offset = circumference - accumulated;
            accumulated += length;
            return (
              <Circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </G>
        <SvgText
          x={center}
          y={center - 6}
          textAnchor="middle"
          fontSize={15}
          fontWeight="700"
          fill={textColor}
        >
          {centerLabel}
        </SvgText>
        <SvgText
          x={center}
          y={center + 13}
          textAnchor="middle"
          fontSize={10}
          fill={textColor}
          opacity={0.6}
        >
          total spent
        </SvgText>
      </Svg>
    </View>
  );
}

// ── OverallBudgetHeroCard ───────────────────────────────────────────────────────

function OverallBudgetHeroCard({ budget, onEdit, onDelete, colors }: {
  budget: BudgetExpanded; onEdit: () => void; onDelete: () => void; colors: any;
}) {
  const limit = Number(budget.amount_limit);
  const pct = limit > 0 ? budget.spent / limit : 0;
  const isOver = budget.spent > limit;
  const isAmber = !isOver && pct >= 0.8;
  const barColor = isOver ? colors.expense : isAmber ? '#F59E0B' : '#69835C';
  const dateRange = formatDateRange(budget.start_date, budget.end_date);

  return (
    <View style={heroStyles.card}>
      <View style={heroStyles.topRow}>
        <Text style={heroStyles.cardLabel}>OVERALL SPENDING LIMIT</Text>
        <View style={heroStyles.iconRow}>
          <TouchableOpacity onPress={onEdit} style={heroStyles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <IconSymbol size={14} name="pencil" color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={heroStyles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <IconSymbol size={14} name="trash" color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={heroStyles.spentAmount}>${budget.spent.toFixed(2)} spent</Text>
      <Text style={heroStyles.ofLimit}>of ${limit.toFixed(2)}</Text>
      {dateRange ? <Text style={heroStyles.dateRange}>{dateRange}</Text> : null}
      <View style={heroStyles.barTrack}>
        <View style={[heroStyles.barFill, {
          width: `${Math.min(pct, 1) * 100}%` as any,
          backgroundColor: barColor,
        }]} />
      </View>
      <View style={heroStyles.bottomRow}>
        <Text style={[heroStyles.statText, { color: isOver ? '#FCA5A5' : 'rgba(255,255,255,0.8)' }]}>
          {Math.round(pct * 100)}% used
        </Text>
        <Text style={[heroStyles.statText, { color: isOver ? '#FCA5A5' : 'rgba(255,255,255,0.8)' }]}>
          {isOver
            ? `Over by $${(budget.spent - limit).toFixed(2)}`
            : `$${(limit - budget.spent).toFixed(2)} left`}
        </Text>
      </View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  card: { backgroundColor: '#425F4D', borderRadius: 16, padding: 18, marginBottom: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1.2 },
  iconRow: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 4 },
  spentAmount: { fontSize: 34, fontWeight: '800', color: '#fff', lineHeight: 38 },
  ofLimit: { fontSize: 14, color: 'rgba(255,255,255,0.65)', marginBottom: 2 },
  dateRange: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8 },
  barTrack: { height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', marginVertical: 14 },
  barFill: { height: 16, borderRadius: 8 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statText: { fontSize: 13, fontWeight: '600' },
});

// ── SpendingBreakdown ───────────────────────────────────────────────────────────

function SpendingBreakdown({ enrichedBudgets, otherSpent, overallEnriched, colors }: {
  enrichedBudgets: BudgetExpanded[];
  otherSpent: number;
  overallEnriched: BudgetExpanded | null;
  colors: any;
}) {
  const segments: { label: string; amount: number; color: string }[] = [];
  enrichedBudgets.forEach((b) => {
    if (b.spent > 0) {
      segments.push({ label: b.category?.name ?? 'Budget', amount: b.spent, color: CHART_COLORS[segments.length % CHART_COLORS.length] });
    }
  });
  if (otherSpent > 0) {
    segments.push({ label: 'Other', amount: otherSpent, color: CHART_COLORS[segments.length % CHART_COLORS.length] });
  }
  const total = segments.reduce((s, seg) => s + seg.amount, 0);

  return (
    <View style={sbStyles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 10 }]}>My Spending</Text>

      {overallEnriched && (() => {
        const limit = Number(overallEnriched.amount_limit);
        const pct = limit > 0 ? overallEnriched.spent / limit : 0;
        const isOver = overallEnriched.spent > limit;
        const barColor = isOver ? colors.expense : pct >= 0.8 ? '#F59E0B' : '#69835C';
        return (
          <View style={sbStyles.overallBar}>
            <View style={sbStyles.overallBarHeader}>
              <Text style={sbStyles.overallBarTitle}>Overall Limit</Text>
              <Text style={sbStyles.overallBarAmounts}>
                ${overallEnriched.spent.toFixed(2)} / ${limit.toFixed(2)}
              </Text>
            </View>
            <View style={sbStyles.barTrack}>
              <View style={[sbStyles.barFill, {
                width: `${Math.min(pct, 1) * 100}%` as any,
                backgroundColor: barColor,
              }]} />
            </View>
          </View>
        );
      })()}

      {total === 0 ? (
        <Text style={[styles.emptyText, { color: colors.icon, textAlign: 'center', paddingVertical: 16 }]}>
          No spending data
        </Text>
      ) : (
        <View style={[sbStyles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <DonutChart segments={segments} centerLabel={`$${total.toFixed(2)}`} size={160} textColor={colors.text} />
          <View style={sbStyles.legend}>
            {segments.map((seg, i) => {
              const pct = Math.round((seg.amount / total) * 100);
              return (
                <View key={i} style={sbStyles.legendRow}>
                  <View style={[sbStyles.legendDot, { backgroundColor: seg.color }]} />
                  <Text style={[sbStyles.legendLabel, { color: colors.text }]} numberOfLines={1}>{seg.label}</Text>
                  <Text style={[sbStyles.legendAmount, { color: colors.text }]}>${seg.amount.toFixed(2)}</Text>
                  <Text style={[sbStyles.legendPct, { color: colors.icon }]}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const sbStyles = StyleSheet.create({
  container: { gap: 0 },
  overallBar: {
    backgroundColor: '#425F4D',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  overallBarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  overallBarTitle: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  overallBarAmounts: { fontSize: 13, fontWeight: '700', color: '#fff' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  chartCard: { borderRadius: 14, borderWidth: 1, padding: 16, alignItems: 'center', gap: 12 },
  legend: { width: '100%', gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  legendLabel: { flex: 1, fontSize: 13 },
  legendAmount: { fontSize: 13, fontWeight: '600' },
  legendPct: { fontSize: 12, minWidth: 32, textAlign: 'right' },
});

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '700' },
  wishBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  wishText: { fontSize: 15, fontWeight: '700' },

  tabRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 8, borderRadius: 12, borderWidth: 1, padding: 4, gap: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabBtnText: { fontSize: 13, fontWeight: '600' },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  hintText: { flex: 1, fontSize: 13 },

  content: { padding: 16, gap: 10 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  manageBtn: { paddingVertical: 8 },
  manageBtnText: { fontSize: 14, fontWeight: '600' },

  greeting: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
  summaryLabel: { fontSize: 12, fontWeight: '500' },
  summaryAmount: { fontSize: 20, fontWeight: '700' },
  netCard: { borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netLabel: { fontSize: 14, fontWeight: '500' },
  netAmount: { fontSize: 22, fontWeight: '800' },

  emptyText: { fontSize: 15 },
  monthGroup: { gap: 0 },
  monthLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 },

  overallPlaceholder: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 16, alignItems: 'center' },
  overallPlaceholderText: { fontSize: 14 },

  otherSpendingCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  otherSpendingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  otherSpendingLabel: { fontSize: 15, fontWeight: '600' },
  otherSpendingAmount: { fontSize: 15, fontWeight: '700' },
  showHide: { fontSize: 13, textAlign: 'center', paddingTop: 2 },

  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingHorizontal: 24, paddingBottom: 40, maxHeight: '85%' },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  sheetBody: { gap: 12, paddingBottom: 16 },

  typeToggle: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 4, gap: 4 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  typeBtnText: { fontSize: 14, fontWeight: '600' },

  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16 },
  currencySymbol: { fontSize: 15, marginRight: 4 },
  amountInput: { flex: 1, paddingVertical: 14, fontSize: 15 },

  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  pickerText: { fontSize: 15, flex: 1, marginRight: 8 },

  catList: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
  catEmoji: { fontSize: 18, width: 24, textAlign: 'center' },
  catText: { fontSize: 15 },

  customDateToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customDateLabel: { fontSize: 15 },
  togglePill: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center', padding: 2 },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },

  newCatRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emojiInput: { width: 50, borderWidth: 1, borderRadius: 10, textAlign: 'center', paddingVertical: 12, fontSize: 18 },
  catNameInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  addCatBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  defaultBadge: { fontSize: 11, fontStyle: 'italic' },

  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '700' },
});
