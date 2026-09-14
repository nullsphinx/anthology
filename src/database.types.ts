export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          action: string
          created_at: string
          detail: string
          id: string
          media_item_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string
          id?: string
          media_item_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string
          id?: string
          media_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_media_item_id_fkey"
            columns: ["media_item_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
        ]
      }
      external_identifiers: {
        Row: {
          created_at: string
          entity_type: Database["public"]["Enums"]["media_type"]
          external_id: string
          media_item_id: string
          provider: string
        }
        Insert: {
          created_at?: string
          entity_type: Database["public"]["Enums"]["media_type"]
          external_id: string
          media_item_id: string
          provider: string
        }
        Update: {
          created_at?: string
          entity_type?: Database["public"]["Enums"]["media_type"]
          external_id?: string
          media_item_id?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_identifiers_media_item_id_fkey"
            columns: ["media_item_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Relationships: []
      }
      group_memberships: {
        Row: {
          created_at: string
          group_id: string
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          email: string
          expires_at: string | null
          invited_by: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          invited_by?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          invited_by?: string | null
        }
        Relationships: []
      }
      library_entries: {
        Row: {
          completed_at: string | null
          completion_count: number
          created_at: string
          favorite: boolean
          media_item_id: string
          notes: string
          progress: number
          progress_source: Database["public"]["Enums"]["progress_source"]
          priority: boolean
          rating: number | null
          review: string
          started_at: string | null
          status: Database["public"]["Enums"]["library_status"]
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["visibility"]
          watched_episodes: number[]
        }
        Insert: {
          completed_at?: string | null
          completion_count?: number
          created_at?: string
          favorite?: boolean
          media_item_id: string
          notes?: string
          progress?: number
          progress_source?: Database["public"]["Enums"]["progress_source"]
          priority?: boolean
          rating?: number | null
          review?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["library_status"]
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["visibility"]
          watched_episodes?: number[]
        }
        Update: {
          completed_at?: string | null
          completion_count?: number
          created_at?: string
          favorite?: boolean
          media_item_id?: string
          notes?: string
          progress?: number
          progress_source?: Database["public"]["Enums"]["progress_source"]
          priority?: boolean
          rating?: number | null
          review?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["library_status"]
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          watched_episodes?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "library_entries_media_item_id_fkey"
            columns: ["media_item_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
        ]
      }
      media_items: {
        Row: {
          backdrop_url: string | null
          catalog_rank: number | null
          community_rating: number | null
          created_at: string
          creator: string
          current_provider: string
          genres: string[]
          id: string
          metadata_refreshed_at: string
          poster_url: string | null
          provider_url: string
          release_info: string
          runtime_minutes: number | null
          seasons: Json | null
          summary: string
          title: string
          type: Database["public"]["Enums"]["media_type"]
          updated_at: string
          year: number | null
        }
        Insert: {
          backdrop_url?: string | null
          catalog_rank?: number | null
          community_rating?: number | null
          created_at?: string
          creator?: string
          current_provider: string
          genres?: string[]
          id?: string
          metadata_refreshed_at?: string
          poster_url?: string | null
          provider_url?: string
          release_info?: string
          runtime_minutes?: number | null
          seasons?: Json | null
          summary?: string
          title: string
          type: Database["public"]["Enums"]["media_type"]
          updated_at?: string
          year?: number | null
        }
        Update: {
          backdrop_url?: string | null
          catalog_rank?: number | null
          community_rating?: number | null
          created_at?: string
          creator?: string
          current_provider?: string
          genres?: string[]
          id?: string
          metadata_refreshed_at?: string
          poster_url?: string | null
          provider_url?: string
          release_info?: string
          runtime_minutes?: number | null
          seasons?: Json | null
          summary?: string
          title?: string
          type?: Database["public"]["Enums"]["media_type"]
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string
          created_at: string
          display_name: string
          updated_at: string
          user_id: string
          username: string | null
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
          avatar_url?: string | null
          bio?: string
          created_at?: string
          display_name?: string
          updated_at?: string
          user_id: string
          username?: string | null
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          created_at?: string
          display_name?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_friends: {
        Args: { first_user: string; second_user: string }
        Returns: boolean
      }
      get_my_library: {
        Args: never
        Returns: {
          entry: Json
          item: Json
        }[]
      }
      is_group_member: {
        Args: { target_group: string; target_user: string }
        Returns: boolean
      }
      remove_library_item: {
        Args: {
          p_external_id: string
          p_provider: string
          p_type: Database["public"]["Enums"]["media_type"]
        }
        Returns: undefined
      }
      save_library_item: {
        Args: { p_entry: Json; p_item: Json }
        Returns: string
      }
    }
    Enums: {
      friendship_status: "pending" | "accepted" | "blocked"
      group_role: "owner" | "admin" | "member"
      library_status:
        | "want"
        | "in-progress"
        | "paused"
        | "completed"
        | "dropped"
      media_type: "movie" | "show" | "book" | "album"
      progress_source: "manual" | "episodes"
      visibility: "private" | "friends" | "public"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      friendship_status: ["pending", "accepted", "blocked"],
      group_role: ["owner", "admin", "member"],
      library_status: ["want", "in-progress", "paused", "completed", "dropped"],
      media_type: ["movie", "show", "book", "album"],
      progress_source: ["manual", "episodes"],
      visibility: ["private", "friends", "public"],
    },
  },
} as const
