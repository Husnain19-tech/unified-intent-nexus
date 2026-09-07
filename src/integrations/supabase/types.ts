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
      calls: {
        Row: {
          action_items: Json
          client_id: string | null
          created_at: string
          direction: string
          duration_seconds: number
          id: string
          objections: string | null
          org_id: string
          participant: string
          sentiment: string | null
          summary: string | null
          talk_ratio: number | null
          transcript: string
        }
        Insert: {
          action_items?: Json
          client_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number
          id?: string
          objections?: string | null
          org_id: string
          participant: string
          sentiment?: string | null
          summary?: string | null
          talk_ratio?: number | null
          transcript: string
        }
        Update: {
          action_items?: Json
          client_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number
          id?: string
          objections?: string | null
          org_id?: string
          participant?: string
          sentiment?: string | null
          summary?: string | null
          talk_ratio?: number | null
          transcript?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_owner: string | null
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          account_owner?: string | null
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          account_owner?: string | null
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commitment_events: {
        Row: {
          commitment_id: string
          created_at: string
          id: string
          kind: string
          note: string | null
          org_id: string
        }
        Insert: {
          commitment_id: string
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          org_id: string
        }
        Update: {
          commitment_id?: string
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitment_events_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitment_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          client_id: string | null
          confidence: number | null
          counterparty: string | null
          created_at: string
          depends_on_id: string | null
          due_at: string | null
          id: string
          org_id: string
          owner_name: string
          person_id: string | null
          promise: string
          quote: string | null
          risk_label: string | null
          risk_reason: string | null
          risk_score: number | null
          source_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          confidence?: number | null
          counterparty?: string | null
          created_at?: string
          depends_on_id?: string | null
          due_at?: string | null
          id?: string
          org_id: string
          owner_name: string
          person_id?: string | null
          promise: string
          quote?: string | null
          risk_label?: string | null
          risk_reason?: string | null
          risk_score?: number | null
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          confidence?: number | null
          counterparty?: string | null
          created_at?: string
          depends_on_id?: string | null
          due_at?: string | null
          id?: string
          org_id?: string
          owner_name?: string
          person_id?: string | null
          promise?: string
          quote?: string | null
          risk_label?: string | null
          risk_reason?: string | null
          risk_score?: number | null
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_depends_on_id_fkey"
            columns: ["depends_on_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          client_id: string | null
          close_date: string | null
          created_at: string
          health_note: string | null
          health_score: number | null
          id: string
          name: string
          org_id: string
          owner_name: string | null
          probability: number
          stage: string
          updated_at: string
          value: number
        }
        Insert: {
          client_id?: string | null
          close_date?: string | null
          created_at?: string
          health_note?: string | null
          health_score?: number | null
          id?: string
          name: string
          org_id: string
          owner_name?: string | null
          probability?: number
          stage?: string
          updated_at?: string
          value?: number
        }
        Update: {
          client_id?: string | null
          close_date?: string | null
          created_at?: string
          health_note?: string | null
          health_score?: number | null
          id?: string
          name?: string
          org_id?: string
          owner_name?: string | null
          probability?: number
          stage?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dependencies: {
        Row: {
          created_at: string
          criticality: number
          debt_hours: number
          id: string
          kind: string
          name: string
          org_id: string
          risk_note: string | null
          risk_score: number
          updated_at: string
          usage_note: string | null
          version: string | null
        }
        Insert: {
          created_at?: string
          criticality?: number
          debt_hours?: number
          id?: string
          kind?: string
          name: string
          org_id: string
          risk_note?: string | null
          risk_score?: number
          updated_at?: string
          usage_note?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string
          criticality?: number
          debt_hours?: number
          id?: string
          kind?: string
          name?: string
          org_id?: string
          risk_note?: string | null
          risk_score?: number
          updated_at?: string
          usage_note?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dependencies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expectations: {
        Row: {
          client_id: string
          client_view: string | null
          created_at: string
          gap_note: string | null
          gap_score: number | null
          id: string
          label: string
          org_id: string
          team_view: string | null
        }
        Insert: {
          client_id: string
          client_view?: string | null
          created_at?: string
          gap_note?: string | null
          gap_score?: number | null
          id?: string
          label: string
          org_id: string
          team_view?: string | null
        }
        Update: {
          client_id?: string
          client_view?: string | null
          created_at?: string
          gap_note?: string | null
          gap_score?: number | null
          id?: string
          label?: string
          org_id?: string
          team_view?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expectations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expectations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          client_id: string | null
          created_at: string
          description: string
          id: string
          incurred_at: string
          org_id: string
        }
        Insert: {
          amount?: number
          category?: string
          client_id?: string | null
          created_at?: string
          description: string
          id?: string
          incurred_at?: string
          org_id: string
        }
        Update: {
          amount?: number
          category?: string
          client_id?: string | null
          created_at?: string
          description?: string
          id?: string
          incurred_at?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          due_at: string | null
          id: string
          issued_at: string
          number: string
          org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          issued_at?: string
          number: string
          org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          issued_at?: string
          number?: string
          org_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_touches: {
        Row: {
          channel: string
          created_at: string
          id: string
          lead_id: string
          note: string | null
          org_id: string
          sentiment: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          lead_id: string
          note?: string | null
          org_id: string
          sentiment?: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          lead_id?: string
          note?: string | null
          org_id?: string
          sentiment?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_touches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_touches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          channel: string
          company: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          last_touch_at: string | null
          notes: string | null
          org_id: string
          sentiment: string
          stage: string
          updated_at: string
          value: number
        }
        Insert: {
          channel?: string
          company: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_touch_at?: string | null
          notes?: string | null
          org_id: string
          sentiment?: string
          stage?: string
          updated_at?: string
          value?: number
        }
        Update: {
          channel?: string
          company?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_touch_at?: string | null
          notes?: string | null
          org_id?: string
          sentiment?: string
          stage?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          org_id: string
          role_title: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          org_id: string
          role_title?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          org_id?: string
          role_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          org_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          org_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          channel: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          summary: string | null
          title: string
        }
        Insert: {
          channel?: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          summary?: string | null
          title: string
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          ai_reply: string | null
          body: string
          channel: string
          client_id: string | null
          created_at: string
          id: string
          org_id: string
          priority: string
          requester: string
          resolution: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          ai_reply?: string | null
          body: string
          channel?: string
          client_id?: string | null
          created_at?: string
          id?: string
          org_id: string
          priority?: string
          requester: string
          resolution?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          ai_reply?: string | null
          body?: string
          channel?: string
          client_id?: string | null
          created_at?: string
          id?: string
          org_id?: string
          priority?: string
          requester?: string
          resolution?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_workspace: { Args: never; Returns: string }
      is_org_member: { Args: { _org_id: string }; Returns: boolean }
      seed_operations_demo: { Args: { v_org: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
