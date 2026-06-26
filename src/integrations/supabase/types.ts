export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      bans: {
        Row: {
          banned_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          reason: string
          type: Database["public"]["Enums"]["ban_type"]
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason: string
          type?: Database["public"]["Enums"]["ban_type"]
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason?: string
          type?: Database["public"]["Enums"]["ban_type"]
          user_id?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          coins_spent: number
          conversation_id: string
          ended_at: string | null
          free_seconds_used: number
          id: string
          is_active: boolean
          last_tick_at: string
          seconds_billed: number
          started_at: string
          user_id: string
        }
        Insert: {
          coins_spent?: number
          conversation_id: string
          ended_at?: string | null
          free_seconds_used?: number
          id?: string
          is_active?: boolean
          last_tick_at?: string
          seconds_billed?: number
          started_at?: string
          user_id: string
        }
        Update: {
          coins_spent?: number
          conversation_id?: string
          ended_at?: string | null
          free_seconds_used?: number
          id?: string
          is_active?: boolean
          last_tick_at?: string
          seconds_billed?: number
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_plans: {
        Row: {
          coins: number
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          price_inr: number
          sort_order: number
        }
        Insert: {
          coins: number
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          price_inr: number
          sort_order?: number
        }
        Update: {
          coins?: number
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          price_inr?: number
          sort_order?: number
        }
        Relationships: []
      }
      community_guidelines_acceptance: {
        Row: {
          accepted_at: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          user_id: string
          version?: string
        }
        Update: {
          accepted_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
          status: Database["public"]["Enums"]["follow_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
          status?: Database["public"]["Enums"]["follow_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
          status?: Database["public"]["Enums"]["follow_status"]
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          is_deleted: boolean
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          bio: string | null
          country: string | null
          created_at: string
          dob: string | null
          free_seconds_remaining: number
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          is_banned: boolean
          is_creator: boolean
          language: string | null
          last_seen_at: string | null
          onboarded: boolean
          state: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          dob?: string | null
          free_seconds_remaining?: number
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id: string
          is_banned?: boolean
          is_creator?: boolean
          language?: string | null
          last_seen_at?: string | null
          onboarded?: boolean
          state?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          dob?: string | null
          free_seconds_remaining?: number
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          is_banned?: boolean
          is_creator?: boolean
          language?: string | null
          last_seen_at?: string | null
          onboarded?: boolean
          state?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_notes: string | null
          context: string | null
          conversation_id: string | null
          created_at: string
          id: string
          message_excerpt: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          reviewed_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_user_id: string
        }
        Insert: {
          admin_notes?: string | null
          context?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_excerpt?: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_user_id: string
        }
        Update: {
          admin_notes?: string | null
          context?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_excerpt?: string | null
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      room_participants: {
        Row: {
          id: string
          joined_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          cover_url: string | null
          created_at: string
          host_id: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["room_kind"]
          max_seats: number
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          host_id: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["room_kind"]
          max_seats?: number
          title: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          host_id?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["room_kind"]
          max_seats?: number
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          coins_delta: number
          created_at: string
          id: string
          inr_amount: number | null
          metadata: Json
          plan_id: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Insert: {
          coins_delta: number
          created_at?: string
          id?: string
          inr_amount?: number | null
          metadata?: Json
          plan_id?: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Update: {
          coins_delta?: number
          created_at?: string
          id?: string
          inr_amount?: number | null
          metadata?: Json
          plan_id?: string | null
          type?: Database["public"]["Enums"]["txn_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "coin_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          coin_balance: number
          deposit_count: number
          earned_coins: number
          total_recharged_inr: number
          updated_at: string
          user_id: string
        }
        Insert: {
          coin_balance?: number
          deposit_count?: number
          earned_coins?: number
          total_recharged_inr?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          coin_balance?: number
          deposit_count?: number
          earned_coins?: number
          total_recharged_inr?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "creator"
      ban_type: "temp" | "perm"
      follow_status: "pending" | "accepted"
      gender_type: "male" | "female" | "other"
      report_reason:
        | "harassment"
        | "nudity"
        | "fake_profile"
        | "spam"
        | "threat"
        | "violence"
        | "scam"
        | "underage"
        | "other"
      report_status: "open" | "reviewed" | "actioned" | "dismissed"
      room_kind: "voice" | "video" | "game" | "live"
      txn_type: "recharge" | "bonus" | "chat_spend" | "refund" | "signup_bonus"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "creator"],
      ban_type: ["temp", "perm"],
      follow_status: ["pending", "accepted"],
      gender_type: ["male", "female", "other"],
      report_reason: [
        "harassment",
        "nudity",
        "fake_profile",
        "spam",
        "threat",
        "violence",
        "scam",
        "underage",
        "other",
      ],
      report_status: ["open", "reviewed", "actioned", "dismissed"],
      room_kind: ["voice", "video", "game", "live"],
      txn_type: ["recharge", "bonus", "chat_spend", "refund", "signup_bonus"],
    },
  },
} as const
