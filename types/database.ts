// Auto-maintained TypeScript types for the Moneymon Supabase schema.
// Regenerate with: npx supabase gen types typescript --project-id <your-project-id> > types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          created_at: string;
          user_name: string | null;
          email: string | null;
          coin_balance: number;
          fountain_xp: number;
          fountain_level: number;
          avatar_url: string | null;
        };
        Insert: {
          id: string;
          created_at?: string;
          user_name?: string | null;
          email?: string | null;
          coin_balance?: number;
          fountain_xp?: number;
          fountain_level?: number;
          avatar_url?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_name?: string | null;
          email?: string | null;
          coin_balance?: number;
          fountain_xp?: number;
          fountain_level?: number;
          avatar_url?: string | null;
        };
      };

      categories: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          is_default: boolean;
          user_id: string | null;
          icon: string | null;
          color: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          is_default?: boolean;
          user_id?: string | null;
          icon?: string | null;
          color?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string;
          is_default?: boolean;
          user_id?: string | null;
          icon?: string | null;
          color?: string | null;
        };
      };

      accounts: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          name: string;
          account_type: 'checking' | 'savings' | 'credit' | 'cash' | null;
          balance: number;
          institution_name: string | null;
          is_mock: boolean;
          plaid_account_id: string | null;
          plaid_item_id: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          name: string;
          account_type?: 'checking' | 'savings' | 'credit' | 'cash' | null;
          balance?: number;
          institution_name?: string | null;
          is_mock?: boolean;
          plaid_account_id?: string | null;
          plaid_item_id?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          name?: string;
          account_type?: 'checking' | 'savings' | 'credit' | 'cash' | null;
          balance?: number;
          institution_name?: string | null;
          is_mock?: boolean;
          plaid_account_id?: string | null;
          plaid_item_id?: string | null;
          is_active?: boolean;
        };
      };

      transactions: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          amount: number;
          transaction_type: 'income' | 'expense';
          merchant_name: string | null;
          posted_date: string | null;
          category_id: string | null;
          notes: string | null;
          account_id: string | null;
          plaid_transaction_id: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          amount: number;
          transaction_type?: 'income' | 'expense';
          merchant_name?: string | null;
          posted_date?: string | null;
          category_id?: string | null;
          notes?: string | null;
          account_id?: string | null;
          plaid_transaction_id?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          amount?: number;
          transaction_type?: 'income' | 'expense';
          merchant_name?: string | null;
          posted_date?: string | null;
          category_id?: string | null;
          notes?: string | null;
          account_id?: string | null;
          plaid_transaction_id?: string | null;
        };
      };

      budgets: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          category_id: string | null;
          amount_limit: number;
          duration_type: string | null;
          start_date: string | null;
          end_date: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          category_id?: string | null;
          amount_limit: number;
          duration_type?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          category_id?: string | null;
          amount_limit?: number;
          duration_type?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          is_active?: boolean;
        };
      };

      quest_definitions: {
        Row: {
          id: string;
          created_at: string;
          title: string;
          description: string | null;
          quest_type: 'daily' | 'weekly';
          coin_reward: number;
          requirement_type: 'log_transactions' | 'stay_under_budget' | 'complete_goal' | 'log_income' | null;
          requirement_value: Json | null;
          is_active: boolean;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          title: string;
          description?: string | null;
          quest_type: 'daily' | 'weekly';
          coin_reward: number;
          requirement_type?: 'log_transactions' | 'stay_under_budget' | 'complete_goal' | 'log_income' | null;
          requirement_value?: Json | null;
          is_active?: boolean;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          title?: string;
          description?: string | null;
          quest_type?: 'daily' | 'weekly';
          coin_reward?: number;
          requirement_type?: 'log_transactions' | 'stay_under_budget' | 'complete_goal' | 'log_income' | null;
          requirement_value?: Json | null;
          is_active?: boolean;
          created_by?: string | null;
        };
      };

      user_quests: {
        Row: {
          id: string;
          user_id: string;
          quest_id: string;
          period_start: string;
          accepted_at: string;
          completed_at: string | null;
          coins_earned: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          quest_id: string;
          period_start: string;
          accepted_at?: string;
          completed_at?: string | null;
          coins_earned?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          quest_id?: string;
          period_start?: string;
          accepted_at?: string;
          completed_at?: string | null;
          coins_earned?: number;
        };
      };

      coin_transactions: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          amount: number;
          source_type: 'quest' | 'fountain_toss' | 'admin' | null;
          source_id: string | null;
          description: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          amount: number;
          source_type?: 'quest' | 'fountain_toss' | 'admin' | null;
          source_id?: string | null;
          description?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          amount?: number;
          source_type?: 'quest' | 'fountain_toss' | 'admin' | null;
          source_id?: string | null;
          description?: string | null;
        };
      };

      fairy_definitions: {
        Row: {
          id: string;
          name: string;
          rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
          lore: string | null;
          portrait_url: string | null;
          material_drop_type: string | null;
          visit_duration_hours: number;
        };
        Insert: {
          id?: string;
          name: string;
          rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
          lore?: string | null;
          portrait_url?: string | null;
          material_drop_type?: string | null;
          visit_duration_hours?: number;
        };
        Update: {
          id?: string;
          name?: string;
          rarity?: 'common' | 'uncommon' | 'rare' | 'legendary';
          lore?: string | null;
          portrait_url?: string | null;
          material_drop_type?: string | null;
          visit_duration_hours?: number;
        };
      };

      user_fairy_collection: {
        Row: {
          id: string;
          user_id: string;
          fairy_id: string;
          discovered_at: string;
          friendship_level: number;
          total_visits: number;
          last_interaction_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          fairy_id: string;
          discovered_at?: string;
          friendship_level?: number;
          total_visits?: number;
          last_interaction_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          fairy_id?: string;
          discovered_at?: string;
          friendship_level?: number;
          total_visits?: number;
          last_interaction_at?: string | null;
        };
      };

      fountain_visits: {
        Row: {
          id: string;
          user_id: string;
          fairy_id: string;
          coins_spent: number;
          arrived_at: string;
          departs_at: string | null;
          is_active: boolean;
          interacted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          fairy_id: string;
          coins_spent?: number;
          arrived_at?: string;
          departs_at?: string | null;
          is_active?: boolean;
          interacted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          fairy_id?: string;
          coins_spent?: number;
          arrived_at?: string;
          departs_at?: string | null;
          is_active?: boolean;
          interacted_at?: string | null;
        };
      };

      materials: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
          xp_min: number;
          xp_max: number;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
          xp_min: number;
          xp_max: number;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          rarity?: 'common' | 'uncommon' | 'rare' | 'legendary';
          xp_min?: number;
          xp_max?: number;
        };
      };

      user_inventory: {
        Row: {
          id: string;
          user_id: string;
          material_id: string;
          quantity: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          material_id: string;
          quantity?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          material_id?: string;
          quantity?: number;
          updated_at?: string;
        };
      };

      fountain_upgrades: {
        Row: {
          id: string;
          level: number;
          name: string;
          description: string | null;
          fairy_slots: number;
          xp_required: number;
        };
        Insert: {
          id?: string;
          level: number;
          name: string;
          description?: string | null;
          fairy_slots?: number;
          xp_required: number;
        };
        Update: {
          id?: string;
          level?: number;
          name?: string;
          description?: string | null;
          fairy_slots?: number;
          xp_required?: number;
        };
      };
    };
  };
}

// ── Convenience row types ──────────────────────────────────────────────────────
export type User = Database['public']['Tables']['users']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Account = Database['public']['Tables']['accounts']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type Budget = Database['public']['Tables']['budgets']['Row'];
export type QuestDefinition = Database['public']['Tables']['quest_definitions']['Row'];
export type UserQuest = Database['public']['Tables']['user_quests']['Row'];
export type CoinTransaction = Database['public']['Tables']['coin_transactions']['Row'];
export type FairyDefinition = Database['public']['Tables']['fairy_definitions']['Row'];
export type UserFairyCollection = Database['public']['Tables']['user_fairy_collection']['Row'];
export type FountainVisit = Database['public']['Tables']['fountain_visits']['Row'];
export type Material = Database['public']['Tables']['materials']['Row'];
export type UserInventory = Database['public']['Tables']['user_inventory']['Row'];
export type FountainUpgrade = Database['public']['Tables']['fountain_upgrades']['Row'];

// ── Rarity type ────────────────────────────────────────────────────────────────
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

// ── Coin cost by rarity (derived in code, not stored per fairy) ────────────────
export const COIN_COST_BY_RARITY: Record<Rarity, number> = {
  common: 10,
  uncommon: 25,
  rare: 50,
  legendary: 100,
};
