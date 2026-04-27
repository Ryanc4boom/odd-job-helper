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
      cancellations: {
        Row: {
          created_at: string
          doer_id: string
          id: string
          job_id: string
        }
        Insert: {
          created_at?: string
          doer_id: string
          id?: string
          job_id: string
        }
        Update: {
          created_at?: string
          doer_id?: string
          id?: string
          job_id?: string
        }
        Relationships: []
      }
      job_requests: {
        Row: {
          created_at: string
          doer_id: string
          id: string
          job_id: string
          message: string | null
          poster_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doer_id: string
          id?: string
          job_id: string
          message?: string | null
          poster_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doer_id?: string
          id?: string
          job_id?: string
          message?: string | null
          poster_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          accepted_doer_id: string | null
          address_exact: string | null
          after_photo_url: string | null
          ai_verification: Json | null
          approved_at: string | null
          before_photo_url: string | null
          budget: number
          category: Database["public"]["Enums"]["job_category"]
          created_at: string
          description: string
          dispute_reason: string | null
          disputed_at: string | null
          doer_id: string | null
          environment: string
          estimated_duration: string | null
          exact_lat: number | null
          exact_lng: number | null
          finished_at: string | null
          heavy_lifting: boolean
          id: string
          location_lat: number | null
          location_lng: number | null
          location_text: string | null
          poster_id: string
          pro_only: boolean
          schedule_window: string
          scheduled_for: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          tools_provided: boolean
          updated_at: string
        }
        Insert: {
          accepted_doer_id?: string | null
          address_exact?: string | null
          after_photo_url?: string | null
          ai_verification?: Json | null
          approved_at?: string | null
          before_photo_url?: string | null
          budget?: number
          category?: Database["public"]["Enums"]["job_category"]
          created_at?: string
          description: string
          dispute_reason?: string | null
          disputed_at?: string | null
          doer_id?: string | null
          environment?: string
          estimated_duration?: string | null
          exact_lat?: number | null
          exact_lng?: number | null
          finished_at?: string | null
          heavy_lifting?: boolean
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_text?: string | null
          poster_id: string
          pro_only?: boolean
          schedule_window?: string
          scheduled_for?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          tools_provided?: boolean
          updated_at?: string
        }
        Update: {
          accepted_doer_id?: string | null
          address_exact?: string | null
          after_photo_url?: string | null
          ai_verification?: Json | null
          approved_at?: string | null
          before_photo_url?: string | null
          budget?: number
          category?: Database["public"]["Enums"]["job_category"]
          created_at?: string
          description?: string
          dispute_reason?: string | null
          disputed_at?: string | null
          doer_id?: string | null
          environment?: string
          estimated_duration?: string | null
          exact_lat?: number | null
          exact_lng?: number | null
          finished_at?: string | null
          heavy_lifting?: boolean
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_text?: string | null
          poster_id?: string
          pro_only?: boolean
          schedule_window?: string
          scheduled_for?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          tools_provided?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_range: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          is_pro_helper: boolean
          is_verified: boolean
          jobs_completed: number
          pro_helper_since: string | null
          trust_grade: Database["public"]["Enums"]["trust_grade"]
          updated_at: string
          verification_id: string | null
          verified_at: string | null
        }
        Insert: {
          age_range?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_pro_helper?: boolean
          is_verified?: boolean
          jobs_completed?: number
          pro_helper_since?: string | null
          trust_grade?: Database["public"]["Enums"]["trust_grade"]
          updated_at?: string
          verification_id?: string | null
          verified_at?: string | null
        }
        Update: {
          age_range?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_pro_helper?: boolean
          is_verified?: boolean
          jobs_completed?: number
          pro_helper_since?: string | null
          trust_grade?: Database["public"]["Enums"]["trust_grade"]
          updated_at?: string
          verification_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          job_id: string
          ratee_id: string
          rater_id: string
          score: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          job_id: string
          ratee_id: string
          rater_id: string
          score: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          job_id?: string
          ratee_id?: string
          rater_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_public"
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
    }
    Views: {
      jobs_public: {
        Row: {
          accepted_doer_id: string | null
          after_photo_url: string | null
          approved_at: string | null
          before_photo_url: string | null
          budget: number | null
          category: Database["public"]["Enums"]["job_category"] | null
          created_at: string | null
          description: string | null
          dispute_reason: string | null
          disputed_at: string | null
          doer_id: string | null
          environment: string | null
          estimated_duration: string | null
          finished_at: string | null
          heavy_lifting: boolean | null
          id: string | null
          location_lat: number | null
          location_lng: number | null
          location_text: string | null
          poster_id: string | null
          pro_only: boolean | null
          schedule_window: string | null
          scheduled_for: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          title: string | null
          tools_provided: boolean | null
          updated_at: string | null
        }
        Insert: {
          accepted_doer_id?: string | null
          after_photo_url?: string | null
          approved_at?: string | null
          before_photo_url?: string | null
          budget?: number | null
          category?: Database["public"]["Enums"]["job_category"] | null
          created_at?: string | null
          description?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          doer_id?: string | null
          environment?: string | null
          estimated_duration?: string | null
          finished_at?: string | null
          heavy_lifting?: boolean | null
          id?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_text?: string | null
          poster_id?: string | null
          pro_only?: boolean | null
          schedule_window?: string | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          title?: string | null
          tools_provided?: boolean | null
          updated_at?: string | null
        }
        Update: {
          accepted_doer_id?: string | null
          after_photo_url?: string | null
          approved_at?: string | null
          before_photo_url?: string | null
          budget?: number | null
          category?: Database["public"]["Enums"]["job_category"] | null
          created_at?: string | null
          description?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          doer_id?: string | null
          environment?: string | null
          estimated_duration?: string | null
          finished_at?: string | null
          heavy_lifting?: boolean | null
          id?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_text?: string | null
          poster_id?: string | null
          pro_only?: boolean | null
          schedule_window?: string | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          title?: string | null
          tools_provided?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_doer_restriction: {
        Args: { _doer_id: string }
        Returns: {
          consecutive_count: number
          restricted: boolean
          until_ts: string
        }[]
      }
      get_job_exact_location: {
        Args: { _job_id: string }
        Returns: {
          address_exact: string
          exact_lat: number
          exact_lng: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recompute_pro_helper: { Args: { _user_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "poster" | "doer" | "admin"
      job_category:
        | "yardwork"
        | "moving"
        | "cleaning"
        | "delivery"
        | "pet_care"
        | "errands"
        | "assembly"
        | "other"
      job_status:
        | "open"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "disputed"
      trust_grade: "A" | "B" | "C" | "D" | "F"
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
      app_role: ["poster", "doer", "admin"],
      job_category: [
        "yardwork",
        "moving",
        "cleaning",
        "delivery",
        "pet_care",
        "errands",
        "assembly",
        "other",
      ],
      job_status: ["open", "in_progress", "completed", "cancelled", "disputed"],
      trust_grade: ["A", "B", "C", "D", "F"],
    },
  },
} as const
