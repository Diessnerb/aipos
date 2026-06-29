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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      ai_campaign_logs: {
        Row: {
          campaign_type: string
          company_id: string | null
          created_at: string | null
          id: string
          input: Json
          output: string
          user_id: string | null
        }
        Insert: {
          campaign_type: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          input: Json
          output: string
          user_id?: string | null
        }
        Update: {
          campaign_type?: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          input?: Json
          output?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_campaign_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      alisha_company_settings: {
        Row: {
          company_id: string
          created_at: string
          custom_instructions: string | null
          id: string
          learning_enabled: boolean | null
          personality_style: string | null
          proactive_suggestions: boolean | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          custom_instructions?: string | null
          id?: string
          learning_enabled?: boolean | null
          personality_style?: string | null
          proactive_suggestions?: boolean | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          custom_instructions?: string | null
          id?: string
          learning_enabled?: boolean | null
          personality_style?: string | null
          proactive_suggestions?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alisha_company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      alisha_conversations: {
        Row: {
          company_id: string
          content: string
          context_data: Json | null
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          content: string
          context_data?: Json | null
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          company_id?: string
          content?: string
          context_data?: Json | null
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alisha_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alisha_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_company"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      alisha_memory: {
        Row: {
          company_id: string
          confidence_score: number | null
          context: string | null
          created_at: string
          id: string
          last_used_at: string | null
          memory_key: string
          memory_type: string
          memory_value: Json
          updated_at: string
          usage_count: number | null
        }
        Insert: {
          company_id: string
          confidence_score?: number | null
          context?: string | null
          created_at?: string
          id?: string
          last_used_at?: string | null
          memory_key: string
          memory_type: string
          memory_value?: Json
          updated_at?: string
          usage_count?: number | null
        }
        Update: {
          company_id?: string
          confidence_score?: number | null
          context?: string | null
          created_at?: string
          id?: string
          last_used_at?: string | null
          memory_key?: string
          memory_type?: string
          memory_value?: Json
          updated_at?: string
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alisha_memory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      alisha_user_preferences: {
        Row: {
          company_id: string
          created_at: string
          frequency: number | null
          id: string
          last_observed_at: string | null
          preference_data: Json
          preference_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          frequency?: number | null
          id?: string
          last_observed_at?: string | null
          preference_data?: Json
          preference_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          frequency?: number | null
          id?: string
          last_observed_at?: string | null
          preference_data?: Json
          preference_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alisha_user_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alisha_user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          company_id: string
          created_at: string
          enhanced_file_path: string | null
          enhancement_status: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          metadata: Json | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          enhanced_file_path?: string | null
          enhancement_status?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          metadata?: Json | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          enhanced_file_path?: string | null
          enhancement_status?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          metadata?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_history: {
        Row: {
          assigned_tables: number[] | null
          assignment_strategy: string | null
          company_id: string
          conflict_detected: boolean | null
          created_at: string | null
          id: string
          reservation_id: string
          rule_applied: string | null
          success: boolean | null
        }
        Insert: {
          assigned_tables?: number[] | null
          assignment_strategy?: string | null
          company_id: string
          conflict_detected?: boolean | null
          created_at?: string | null
          id?: string
          reservation_id: string
          rule_applied?: string | null
          success?: boolean | null
        }
        Update: {
          assigned_tables?: number[] | null
          assignment_strategy?: string | null
          company_id?: string
          conflict_detected?: boolean | null
          created_at?: string | null
          id?: string
          reservation_id?: string
          rule_applied?: string | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_history_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_rules: {
        Row: {
          actions: Json
          company_id: string
          conditions: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          rule_name: string
          rule_type: string
          updated_at: string | null
        }
        Insert: {
          actions?: Json
          company_id: string
          conditions?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_name: string
          rule_type: string
          updated_at?: string | null
        }
        Update: {
          actions?: Json
          company_id?: string
          conditions?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_name?: string
          rule_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      auth_attempts: {
        Row: {
          attempted_at: string | null
          company_id: string | null
          email: string | null
          id: string
          ip_address: string | null
          pin_used: string | null
          success: boolean | null
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string | null
          company_id?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          pin_used?: string | null
          success?: boolean | null
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string | null
          company_id?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          pin_used?: string | null
          success?: boolean | null
          user_agent?: string | null
        }
        Relationships: []
      }
      auth_rate_limits: {
        Row: {
          attempt_count: number | null
          blocked_until: string | null
          created_at: string | null
          id: string
          identifier: string
          window_start: string | null
        }
        Insert: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          identifier: string
          window_start?: string | null
        }
        Update: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          identifier?: string
          window_start?: string | null
        }
        Relationships: []
      }
      brand_kit: {
        Row: {
          accent_color: string | null
          background_color: string | null
          company_id: string
          created_at: string
          custom_tone_description: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          primary_font: string | null
          secondary_color: string | null
          secondary_font: string | null
          secondary_logo_url: string | null
          tone_of_voice: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          company_id: string
          created_at?: string
          custom_tone_description?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          primary_font?: string | null
          secondary_color?: string | null
          secondary_font?: string | null
          secondary_logo_url?: string | null
          tone_of_voice?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          company_id?: string
          created_at?: string
          custom_tone_description?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          primary_font?: string | null
          secondary_color?: string | null
          secondary_font?: string | null
          secondary_logo_url?: string | null
          tone_of_voice?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_kit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_memberships: {
        Row: {
          can_write: boolean | null
          channel_id: string | null
          id: string
          joined_at: string
          user_id: string | null
        }
        Insert: {
          can_write?: boolean | null
          channel_id?: string | null
          id?: string
          joined_at?: string
          user_id?: string | null
        }
        Update: {
          can_write?: boolean | null
          channel_id?: string | null
          id?: string
          joined_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_memberships_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_read_only: boolean | null
          name: string
          type: string
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_read_only?: boolean | null
          name: string
          type?: string
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_read_only?: boolean | null
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string | null
          default_admin_email: string | null
          first_admin_login_at: string | null
          id: string
          name: string
          network_secret: string | null
          owner_pin: string | null
          setup_completed: boolean | null
          setup_path: string | null
          setup_started_at: string | null
          status: string | null
          subdomain: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_admin_email?: string | null
          first_admin_login_at?: string | null
          id?: string
          name: string
          network_secret?: string | null
          owner_pin?: string | null
          setup_completed?: boolean | null
          setup_path?: string | null
          setup_started_at?: string | null
          status?: string | null
          subdomain?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_admin_email?: string | null
          first_admin_login_at?: string | null
          id?: string
          name?: string
          network_secret?: string | null
          owner_pin?: string | null
          setup_completed?: boolean | null
          setup_path?: string | null
          setup_started_at?: string | null
          status?: string | null
          subdomain?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_growth_metrics: {
        Row: {
          average_party_size: number | null
          company_id: string
          created_at: string
          id: string
          metric_date: string
          no_show_rate: number | null
          peak_hour_reservations: number
          table_turnover_rate: number | null
          total_covers: number
          total_reservations: number
          updated_at: string
        }
        Insert: {
          average_party_size?: number | null
          company_id: string
          created_at?: string
          id?: string
          metric_date: string
          no_show_rate?: number | null
          peak_hour_reservations?: number
          table_turnover_rate?: number | null
          total_covers?: number
          total_reservations?: number
          updated_at?: string
        }
        Update: {
          average_party_size?: number | null
          company_id?: string
          created_at?: string
          id?: string
          metric_date?: string
          no_show_rate?: number | null
          peak_hour_reservations?: number
          table_turnover_rate?: number | null
          total_covers?: number
          total_reservations?: number
          updated_at?: string
        }
        Relationships: []
      }
      company_permission_templates: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          template_data: Json
          template_name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          template_data: Json
          template_name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          template_data?: Json
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          accessible_spare_target: number | null
          auto_assign_tables: boolean
          button_style: string | null
          company_id: string | null
          company_name: string | null
          created_at: string
          default_location_id: string | null
          email: string | null
          enable_time_based_group_protection: boolean | null
          font_style: string | null
          id: string
          imminent_booking_threshold_minutes: number | null
          large_party_lead_time_threshold_minutes: number | null
          last_optimized_at: string | null
          logo_url: string | null
          optimization_enabled: boolean
          optimization_horizon_days: number | null
          optimization_mode: string | null
          phone: string | null
          pin_idle_timeout_seconds: number
          primary_color: string | null
          privacy_policy_url: string | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          secondary_color: string | null
          short_term_horizon_minutes: number | null
          show_allergen_disclaimer: boolean | null
          sms_provider: string | null
          sms_reminders_enabled: boolean | null
          strategic_optimization_enabled: boolean | null
          support_contact: string | null
          terms_of_service_url: string | null
          terms_url: string | null
          timezone: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          accessible_spare_target?: number | null
          auto_assign_tables?: boolean
          button_style?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          default_location_id?: string | null
          email?: string | null
          enable_time_based_group_protection?: boolean | null
          font_style?: string | null
          id?: string
          imminent_booking_threshold_minutes?: number | null
          large_party_lead_time_threshold_minutes?: number | null
          last_optimized_at?: string | null
          logo_url?: string | null
          optimization_enabled?: boolean
          optimization_horizon_days?: number | null
          optimization_mode?: string | null
          phone?: string | null
          pin_idle_timeout_seconds?: number
          primary_color?: string | null
          privacy_policy_url?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          secondary_color?: string | null
          short_term_horizon_minutes?: number | null
          show_allergen_disclaimer?: boolean | null
          sms_provider?: string | null
          sms_reminders_enabled?: boolean | null
          strategic_optimization_enabled?: boolean | null
          support_contact?: string | null
          terms_of_service_url?: string | null
          terms_url?: string | null
          timezone?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          accessible_spare_target?: number | null
          auto_assign_tables?: boolean
          button_style?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          default_location_id?: string | null
          email?: string | null
          enable_time_based_group_protection?: boolean | null
          font_style?: string | null
          id?: string
          imminent_booking_threshold_minutes?: number | null
          large_party_lead_time_threshold_minutes?: number | null
          last_optimized_at?: string | null
          logo_url?: string | null
          optimization_enabled?: boolean
          optimization_horizon_days?: number | null
          optimization_mode?: string | null
          phone?: string | null
          pin_idle_timeout_seconds?: number
          primary_color?: string | null
          privacy_policy_url?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          secondary_color?: string | null
          short_term_horizon_minutes?: number | null
          show_allergen_disclaimer?: boolean | null
          sms_provider?: string | null
          sms_reminders_enabled?: boolean | null
          strategic_optimization_enabled?: boolean | null
          support_contact?: string | null
          terms_of_service_url?: string | null
          terms_url?: string | null
          timezone?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_default_location_id_fkey"
            columns: ["default_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_company_settings_company_id"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_subscription_features: {
        Row: {
          company_id: string
          created_at: string
          enabled: boolean | null
          expires_at: string | null
          feature_name: string
          id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          enabled?: boolean | null
          expires_at?: string | null
          feature_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          enabled?: boolean | null
          expires_at?: string | null
          feature_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_twilio_config: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          twilio_phone_number: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          twilio_phone_number: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          twilio_phone_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_twilio_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_logs: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          message: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "copilot_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      course_checkback_feedback: {
        Row: {
          checkback_timestamp: string
          company_id: string
          course: string
          created_at: string
          feedback_notes: string | null
          id: string
          quality_rating: string
          reservation_id: string
          staff_user_id: string | null
        }
        Insert: {
          checkback_timestamp?: string
          company_id: string
          course: string
          created_at?: string
          feedback_notes?: string | null
          id?: string
          quality_rating: string
          reservation_id: string
          staff_user_id?: string | null
        }
        Update: {
          checkback_timestamp?: string
          company_id?: string
          course?: string
          created_at?: string
          feedback_notes?: string | null
          id?: string
          quality_rating?: string
          reservation_id?: string
          staff_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_checkback_feedback_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          company_id: string
          customer_id: string
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          reservation_id: string | null
          source: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          company_id: string
          customer_id: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          reservation_id?: string | null
          source?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string
          customer_id?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          reservation_id?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_audit_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_audit_log_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_communications: {
        Row: {
          campaign_id: string | null
          channel: string | null
          customer_id: string | null
          id: string
          message: string | null
          sent_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          channel?: string | null
          customer_id?: string | null
          id?: string
          message?: string | null
          sent_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          channel?: string | null
          customer_id?: string | null
          id?: string
          message?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_communications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_communications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_reservation_history: {
        Row: {
          actual_arrival_time: string | null
          company_id: string
          created_at: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          event_timestamp: string
          event_type: string
          id: string
          minutes_late: number | null
          party_size: number | null
          reservation_date: string
          reservation_id: string
          scheduled_time: string | null
        }
        Insert: {
          actual_arrival_time?: string | null
          company_id: string
          created_at?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          event_timestamp?: string
          event_type: string
          id?: string
          minutes_late?: number | null
          party_size?: number | null
          reservation_date: string
          reservation_id: string
          scheduled_time?: string | null
        }
        Update: {
          actual_arrival_time?: string | null
          company_id?: string
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          event_timestamp?: string
          event_type?: string
          id?: string
          minutes_late?: number | null
          party_size?: number | null
          reservation_date?: string
          reservation_id?: string
          scheduled_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_reservation_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_reservation_history_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          average_minutes_late: number | null
          company_id: string | null
          do_not_contact: boolean | null
          email: string | null
          id: string
          last_visit: string | null
          late_count: number | null
          name: string
          no_show_count: number | null
          notes: string | null
          phone: string | null
          preferences: string[] | null
          sms_opt_out: boolean | null
          sms_opt_out_at: string | null
          total_spent: number | null
          vip_status: boolean | null
          visits: number | null
        }
        Insert: {
          average_minutes_late?: number | null
          company_id?: string | null
          do_not_contact?: boolean | null
          email?: string | null
          id?: string
          last_visit?: string | null
          late_count?: number | null
          name: string
          no_show_count?: number | null
          notes?: string | null
          phone?: string | null
          preferences?: string[] | null
          sms_opt_out?: boolean | null
          sms_opt_out_at?: string | null
          total_spent?: number | null
          vip_status?: boolean | null
          visits?: number | null
        }
        Update: {
          average_minutes_late?: number | null
          company_id?: string | null
          do_not_contact?: boolean | null
          email?: string | null
          id?: string
          last_visit?: string | null
          late_count?: number | null
          name?: string
          no_show_count?: number | null
          notes?: string | null
          phone?: string | null
          preferences?: string[] | null
          sms_opt_out?: boolean | null
          sms_opt_out_at?: string | null
          total_spent?: number | null
          vip_status?: boolean | null
          visits?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_revenue_analytics: {
        Row: {
          analytics_date: string
          average_order_value: number | null
          company_id: string
          created_at: string | null
          id: string
          peak_hour: number | null
          peak_hour_revenue: number | null
          table_turnover_count: number | null
          total_orders: number | null
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          analytics_date: string
          average_order_value?: number | null
          company_id: string
          created_at?: string | null
          id?: string
          peak_hour?: number | null
          peak_hour_revenue?: number | null
          table_turnover_count?: number | null
          total_orders?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          analytics_date?: string
          average_order_value?: number | null
          company_id?: string
          created_at?: string | null
          id?: string
          peak_hour?: number | null
          peak_hour_revenue?: number | null
          table_turnover_count?: number | null
          total_orders?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_revenue_analytics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_types: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_builtin: boolean
          key: string
          name: string
          schema: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_builtin?: boolean
          key: string
          name: string
          schema?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_builtin?: boolean
          key?: string
          name?: string
          schema?: Json
          updated_at?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          applies_to: string | null
          company_id: string
          created_at: string
          custom_fields: Json
          day_of_week: number[]
          deal_name: string
          deal_type: string
          description: string | null
          discount_value: number | null
          end_time: string
          id: string
          is_active: boolean
          m_value: number | null
          menu_category_ids: string[] | null
          menu_item_ids: string[] | null
          n_value: number | null
          start_time: string
          updated_at: string
        }
        Insert: {
          applies_to?: string | null
          company_id: string
          created_at?: string
          custom_fields?: Json
          day_of_week: number[]
          deal_name: string
          deal_type?: string
          description?: string | null
          discount_value?: number | null
          end_time?: string
          id?: string
          is_active?: boolean
          m_value?: number | null
          menu_category_ids?: string[] | null
          menu_item_ids?: string[] | null
          n_value?: number | null
          start_time?: string
          updated_at?: string
        }
        Update: {
          applies_to?: string | null
          company_id?: string
          created_at?: string
          custom_fields?: Json
          day_of_week?: number[]
          deal_name?: string
          deal_type?: string
          description?: string | null
          discount_value?: number | null
          end_time?: string
          id?: string
          is_active?: boolean
          m_value?: number | null
          menu_category_ids?: string[] | null
          menu_item_ids?: string[] | null
          n_value?: number | null
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_order_items: {
        Row: {
          created_at: string
          delivery_order_id: string
          id: string
          ingredient_id: string
          ingredient_name: string
          ordered_quantity: number
          received_quantity: number | null
          suggested_quantity: number | null
          total_cost: number | null
          unit_cost: number | null
          updated_at: string
          variance_cost: number | null
          variance_notes: string | null
          variance_quantity: number | null
          variance_type: string | null
        }
        Insert: {
          created_at?: string
          delivery_order_id: string
          id?: string
          ingredient_id: string
          ingredient_name: string
          ordered_quantity: number
          received_quantity?: number | null
          suggested_quantity?: number | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
          variance_cost?: number | null
          variance_notes?: string | null
          variance_quantity?: number | null
          variance_type?: string | null
        }
        Update: {
          created_at?: string
          delivery_order_id?: string
          id?: string
          ingredient_id?: string
          ingredient_name?: string
          ordered_quantity?: number
          received_quantity?: number | null
          suggested_quantity?: number | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
          variance_cost?: number | null
          variance_notes?: string | null
          variance_quantity?: number | null
          variance_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_order_items_delivery_order_id_fkey"
            columns: ["delivery_order_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_order_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_orders: {
        Row: {
          actual_delivery_date: string | null
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          received_at: string | null
          sent_at: string | null
          status: string
          supplier_id: string
          total_cost: number | null
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          received_at?: string | null
          sent_at?: string | null
          status?: string
          supplier_id: string
          total_cost?: number | null
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          received_at?: string | null
          sent_at?: string | null
          status?: string
          supplier_id?: string
          total_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_schedules: {
        Row: {
          company_id: string
          created_at: string
          cutoff_time: string | null
          day_of_week: number
          delivery_time: string | null
          id: string
          is_active: boolean
          order_day_of_week: number
          supplier_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          cutoff_time?: string | null
          day_of_week: number
          delivery_time?: string | null
          id?: string
          is_active?: boolean
          order_day_of_week: number
          supplier_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          cutoff_time?: string | null
          day_of_week?: number
          delivery_time?: string | null
          id?: string
          is_active?: boolean
          order_day_of_week?: number
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_schedules_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_settings: {
        Row: {
          company_id: string
          created_at: string | null
          default_delivery_window: string | null
          enable_auto_ordering: boolean | null
          id: string
          minimum_order_value: number | null
          notification_email: string | null
          notify_on_low_stock: boolean | null
          notify_on_order_received: boolean | null
          order_lead_time_days: number | null
          preferred_delivery_day: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          default_delivery_window?: string | null
          enable_auto_ordering?: boolean | null
          id?: string
          minimum_order_value?: number | null
          notification_email?: string | null
          notify_on_low_stock?: boolean | null
          notify_on_order_received?: boolean | null
          order_lead_time_days?: number | null
          preferred_delivery_day?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          default_delivery_window?: string | null
          enable_auto_ordering?: boolean | null
          id?: string
          minimum_order_value?: number | null
          notification_email?: string | null
          notify_on_low_stock?: boolean | null
          notify_on_order_received?: boolean | null
          order_lead_time_days?: number | null
          preferred_delivery_day?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      group_seat_mappings: {
        Row: {
          company_id: string
          connection_points: Json | null
          created_at: string
          efficiency_score: number | null
          group_id: string
          id: string
          is_optimal: boolean | null
          lost_seats: number | null
          scenario_name: string | null
          table_combination: Json
          total_seats: number
          updated_at: string
        }
        Insert: {
          company_id: string
          connection_points?: Json | null
          created_at?: string
          efficiency_score?: number | null
          group_id: string
          id?: string
          is_optimal?: boolean | null
          lost_seats?: number | null
          scenario_name?: string | null
          table_combination: Json
          total_seats: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          connection_points?: Json | null
          created_at?: string
          efficiency_score?: number | null
          group_id?: string
          id?: string
          is_optimal?: boolean | null
          lost_seats?: number | null
          scenario_name?: string | null
          table_combination?: Json
          total_seats?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_seat_mappings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "table_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_deduction_log: {
        Row: {
          deducted_days: number
          holiday_request_id: string
          id: string
          triggered_at: string
          user_id: string
        }
        Insert: {
          deducted_days: number
          holiday_request_id: string
          id?: string
          triggered_at?: string
          user_id: string
        }
        Update: {
          deducted_days?: number
          holiday_request_id?: string
          id?: string
          triggered_at?: string
          user_id?: string
        }
        Relationships: []
      }
      holiday_requests: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          notes: string | null
          start_date: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holiday_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      image_processing_queue: {
        Row: {
          asset_id: string
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          processed_at: string | null
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          asset_id: string
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_processing_queue_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_processing_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_usage_analytics: {
        Row: {
          average_daily_usage: number | null
          company_id: string
          created_at: string
          date: string
          id: string
          ingredient_id: string
          projected_days_remaining: number | null
          quantity_purchased: number
          quantity_used: number
          quantity_wasted: number
          updated_at: string
        }
        Insert: {
          average_daily_usage?: number | null
          company_id: string
          created_at?: string
          date: string
          id?: string
          ingredient_id: string
          projected_days_remaining?: number | null
          quantity_purchased?: number
          quantity_used?: number
          quantity_wasted?: number
          updated_at?: string
        }
        Update: {
          average_daily_usage?: number | null
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          ingredient_id?: string
          projected_days_remaining?: number | null
          quantity_purchased?: number
          quantity_used?: number
          quantity_wasted?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_usage_analytics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_usage_analytics_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          allergens: string[]
          company_id: string
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          known_as: string | null
          last_stock_update: string | null
          name: string
          portion_size: number
          portion_type: string
          purchase_price: number | null
          purchase_size: number | null
          purchase_type: string | null
          sale_price: number
          stock_level: number | null
          stock_unit: string | null
          supplier: string | null
          supplier_id: string | null
          units_per_purchase: number | null
          updated_at: string
        }
        Insert: {
          allergens?: string[]
          company_id: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          known_as?: string | null
          last_stock_update?: string | null
          name: string
          portion_size: number
          portion_type?: string
          purchase_price?: number | null
          purchase_size?: number | null
          purchase_type?: string | null
          sale_price: number
          stock_level?: number | null
          stock_unit?: string | null
          supplier?: string | null
          supplier_id?: string | null
          units_per_purchase?: number | null
          updated_at?: string
        }
        Update: {
          allergens?: string[]
          company_id?: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          known_as?: string | null
          last_stock_update?: string | null
          name?: string
          portion_size?: number
          portion_type?: string
          purchase_price?: number | null
          purchase_size?: number | null
          purchase_type?: string | null
          sale_price?: number
          stock_level?: number | null
          stock_unit?: string | null
          supplier?: string | null
          supplier_id?: string | null
          units_per_purchase?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          auth_token: string | null
          company_id: string | null
          connected: boolean | null
          created_at: string | null
          expires_at: string | null
          id: string
          last_synced_at: string | null
          metadata: Json | null
          refresh_token: string | null
          service_name: string
          user_id: string | null
        }
        Insert: {
          auth_token?: string | null
          company_id?: string | null
          connected?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json | null
          refresh_token?: string | null
          service_name: string
          user_id?: string | null
        }
        Update: {
          auth_token?: string | null
          company_id?: string | null
          connected?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json | null
          refresh_token?: string | null
          service_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          company_id: string | null
          id: string
          ingredient_name: string | null
          last_updated: string | null
          manual_low_stock: boolean | null
          menu_item_id: string | null
          stock_quantity: number | null
          threshold: number | null
          unit: string
        }
        Insert: {
          company_id?: string | null
          id?: string
          ingredient_name?: string | null
          last_updated?: string | null
          manual_low_stock?: boolean | null
          menu_item_id?: string | null
          stock_quantity?: number | null
          threshold?: number | null
          unit: string
        }
        Update: {
          company_id?: string | null
          id?: string
          ingredient_name?: string | null
          last_updated?: string | null
          manual_low_stock?: boolean | null
          menu_item_id?: string | null
          stock_quantity?: number | null
          threshold?: number | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_logs: {
        Row: {
          change_amount: number
          id: string
          inventory_item_id: string
          menu_item_name: string | null
          notes: string | null
          timestamp: string
        }
        Insert: {
          change_amount: number
          id?: string
          inventory_item_id: string
          menu_item_name?: string | null
          notes?: string | null
          timestamp?: string
        }
        Update: {
          change_amount?: number
          id?: string
          inventory_item_id?: string
          menu_item_name?: string | null
          notes?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_logs_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          company_id: string | null
          created_at: string | null
          date_paid: string
          id: string
          image_url: string | null
          invoice_number: number
          items_purchased: string | null
          paid: boolean | null
          supplier: string
        }
        Insert: {
          amount_paid: number
          company_id?: string | null
          created_at?: string | null
          date_paid: string
          id?: string
          image_url?: string | null
          invoice_number: number
          items_purchased?: string | null
          paid?: boolean | null
          supplier: string
        }
        Update: {
          amount_paid?: number
          company_id?: string | null
          created_at?: string | null
          date_paid?: string
          id?: string
          image_url?: string | null
          invoice_number?: number
          items_purchased?: string | null
          paid?: boolean | null
          supplier?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_service_requests: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          dismissed_at: string | null
          dismissed_by: string | null
          id: string
          message: string | null
          status: string
          type: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          message?: string | null
          status?: string
          type: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          message?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_service_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      link_templates: {
        Row: {
          company_id: string
          created_at: string
          id: string
          link_structure_json: Json
          template_name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          link_structure_json?: Json
          template_name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          link_structure_json?: Json
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          address: string | null
          address_line: string | null
          city: string | null
          company_id: string | null
          country: string | null
          county: string | null
          district: string | null
          email: string | null
          full_address: string | null
          hours: Json | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          postcode: string | null
          status: string | null
          ward: string | null
        }
        Insert: {
          address?: string | null
          address_line?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          county?: string | null
          district?: string | null
          email?: string | null
          full_address?: string | null
          hours?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          postcode?: string | null
          status?: string | null
          ward?: string | null
        }
        Update: {
          address?: string | null
          address_line?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          county?: string | null
          district?: string | null
          email?: string | null
          full_address?: string | null
          hours?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          postcode?: string | null
          status?: string | null
          ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_override_feedback: {
        Row: {
          additional_notes: string | null
          company_id: string
          created_at: string
          feedback_reasons: string[] | null
          id: string
          move_timestamp: string
          new_table_numbers: number[]
          old_table_numbers: number[] | null
          reservation_id: string
          staff_user_id: string | null
        }
        Insert: {
          additional_notes?: string | null
          company_id: string
          created_at?: string
          feedback_reasons?: string[] | null
          id?: string
          move_timestamp?: string
          new_table_numbers: number[]
          old_table_numbers?: number[] | null
          reservation_id: string
          staff_user_id?: string | null
        }
        Update: {
          additional_notes?: string | null
          company_id?: string
          created_at?: string
          feedback_reasons?: string[] | null
          id?: string
          move_timestamp?: string
          new_table_numbers?: number[]
          old_table_numbers?: number[] | null
          reservation_id?: string
          staff_user_id?: string | null
        }
        Relationships: []
      }
      marketing_analytics: {
        Row: {
          company_id: string
          created_at: string
          date: string
          hour: number | null
          id: string
          metric_type: string
          metric_value: number
          platform: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          date: string
          hour?: number | null
          id?: string
          metric_type: string
          metric_value?: number
          platform: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          date?: string
          hour?: number | null
          id?: string
          metric_type?: string
          metric_value?: number
          platform?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          audience_filter: Json | null
          channel: string | null
          company_id: string | null
          content: string | null
          created_at: string | null
          id: string
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          target_count: number | null
          title: string | null
          type: string | null
        }
        Insert: {
          audience_filter?: Json | null
          channel?: string | null
          company_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          target_count?: number | null
          title?: string | null
          type?: string | null
        }
        Update: {
          audience_filter?: Json | null
          channel?: string | null
          company_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          target_count?: number | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_permissions: {
        Row: {
          analytics_access: boolean | null
          automated_posting: boolean | null
          company_id: string
          content_creation: boolean | null
          created_at: string
          granted_at: string | null
          id: string
          integration_id: string | null
          messaging_access: boolean | null
          platform: string
          post_access: boolean | null
          updated_at: string
        }
        Insert: {
          analytics_access?: boolean | null
          automated_posting?: boolean | null
          company_id: string
          content_creation?: boolean | null
          created_at?: string
          granted_at?: string | null
          id?: string
          integration_id?: string | null
          messaging_access?: boolean | null
          platform: string
          post_access?: boolean | null
          updated_at?: string
        }
        Update: {
          analytics_access?: boolean | null
          automated_posting?: boolean | null
          company_id?: string
          content_creation?: boolean | null
          created_at?: string
          granted_at?: string | null
          id?: string
          integration_id?: string | null
          messaging_access?: boolean | null
          platform?: string
          post_access?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_permissions_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          card_color: string | null
          category_type: string | null
          company_id: string
          created_at: string
          description: string | null
          display_order: number
          external_pos_id: string | null
          id: string
          is_active: boolean
          last_pos_sync: string | null
          name: string
          parent_id: string | null
          pos_metadata: Json | null
          pos_sync_status: string | null
          sync_conflicts: Json | null
          updated_at: string
        }
        Insert: {
          card_color?: string | null
          category_type?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          external_pos_id?: string | null
          id?: string
          is_active?: boolean
          last_pos_sync?: string | null
          name: string
          parent_id?: string | null
          pos_metadata?: Json | null
          pos_sync_status?: string | null
          sync_conflicts?: Json | null
          updated_at?: string
        }
        Update: {
          card_color?: string | null
          category_type?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          external_pos_id?: string | null
          id?: string
          is_active?: boolean
          last_pos_sync?: string | null
          name?: string
          parent_id?: string | null
          pos_metadata?: Json | null
          pos_sync_status?: string | null
          sync_conflicts?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_ingredients: {
        Row: {
          add_on_cost: number | null
          allergens: string[] | null
          company_id: string
          created_at: string
          display_order: number
          id: string
          ingredient_name: string
          is_included: boolean
          menu_item_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          add_on_cost?: number | null
          allergens?: string[] | null
          company_id: string
          created_at?: string
          display_order?: number
          id?: string
          ingredient_name: string
          is_included?: boolean
          menu_item_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          add_on_cost?: number | null
          allergens?: string[] | null
          company_id?: string
          created_at?: string
          display_order?: number
          id?: string
          ingredient_name?: string
          is_included?: boolean
          menu_item_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_ingredients_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string[] | null
          card_color: string | null
          category_id: string | null
          company_id: string
          created_at: string | null
          description: string | null
          display_order: number | null
          external_pos_id: string | null
          id: string
          image_urls: string[] | null
          last_pos_sync: string | null
          name: string
          pos_metadata: Json | null
          pos_sync_status: string | null
          price: number | null
          sync_conflicts: Json | null
          tags: string[] | null
        }
        Insert: {
          allergens?: string[] | null
          card_color?: string | null
          category_id?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          external_pos_id?: string | null
          id?: string
          image_urls?: string[] | null
          last_pos_sync?: string | null
          name: string
          pos_metadata?: Json | null
          pos_sync_status?: string | null
          price?: number | null
          sync_conflicts?: Json | null
          tags?: string[] | null
        }
        Update: {
          allergens?: string[] | null
          card_color?: string | null
          category_id?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          external_pos_id?: string | null
          id?: string
          image_urls?: string[] | null
          last_pos_sync?: string | null
          name?: string
          pos_metadata?: Json | null
          pos_sync_status?: string | null
          price?: number | null
          sync_conflicts?: Json | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel_id: string | null
          content: string
          created_at: string
          id: string
          is_edited: boolean | null
          recipient_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          channel_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_edited?: boolean | null
          recipient_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          channel_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_edited?: boolean | null
          recipient_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_notes: {
        Row: {
          author: string | null
          body: string | null
          category: string | null
          company_id: string | null
          completed: boolean | null
          id: string
          priority: string | null
          timestamp: string | null
          title: string
        }
        Insert: {
          author?: string | null
          body?: string | null
          category?: string | null
          company_id?: string | null
          completed?: boolean | null
          id?: string
          priority?: string | null
          timestamp?: string | null
          title: string
        }
        Update: {
          author?: string | null
          body?: string | null
          category?: string | null
          company_id?: string | null
          completed?: boolean | null
          id?: string
          priority?: string | null
          timestamp?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          environment: string
          expires_at: string
          id: string
          pos_system: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          environment?: string
          expires_at?: string
          id?: string
          pos_system: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          environment?: string
          expires_at?: string
          id?: string
          pos_system?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      off_reasons: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          reason: string
          shift_date: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          reason: string
          shift_date: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          reason?: string
          shift_date?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "off_reasons_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      optimization_decisions: {
        Row: {
          action_taken: string | null
          company_id: string
          created_at: string | null
          current_tables: number[] | null
          days_ahead: number | null
          decision_time: string | null
          id: string
          large_tables_freed: number | null
          proposed_tables: number[] | null
          reason: string | null
          reservation_id: string | null
          strategic_score: number | null
          was_ai_suggested: boolean | null
          waste_after: number | null
          waste_before: number | null
        }
        Insert: {
          action_taken?: string | null
          company_id: string
          created_at?: string | null
          current_tables?: number[] | null
          days_ahead?: number | null
          decision_time?: string | null
          id?: string
          large_tables_freed?: number | null
          proposed_tables?: number[] | null
          reason?: string | null
          reservation_id?: string | null
          strategic_score?: number | null
          was_ai_suggested?: boolean | null
          waste_after?: number | null
          waste_before?: number | null
        }
        Update: {
          action_taken?: string | null
          company_id?: string
          created_at?: string | null
          current_tables?: number[] | null
          days_ahead?: number | null
          decision_time?: string | null
          id?: string
          large_tables_freed?: number | null
          proposed_tables?: number[] | null
          reason?: string | null
          reservation_id?: string | null
          strategic_score?: number | null
          was_ai_suggested?: boolean | null
          waste_after?: number | null
          waste_before?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "optimization_decisions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_decisions_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      optimization_log: {
        Row: {
          company_id: string
          created_at: string
          gap_reduction_score: number | null
          id: string
          new_table_number: number | null
          old_table_number: number | null
          optimization_session_id: string
          optimization_type: string
          reason: string
          reservation_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          gap_reduction_score?: number | null
          id?: string
          new_table_number?: number | null
          old_table_number?: number | null
          optimization_session_id?: string
          optimization_type: string
          reason: string
          reservation_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          gap_reduction_score?: number | null
          id?: string
          new_table_number?: number | null
          old_table_number?: number | null
          optimization_session_id?: string
          optimization_type?: string
          reason?: string
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_optimization_log_reservation"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          basket_item_id: string | null
          course_type: string
          id: string
          is_prepared: boolean | null
          menu_item_id: string | null
          modifications: Json | null
          notes: string | null
          order_id: string | null
          payment_status: string | null
          quantity: number
          quantity_paid: number | null
          subtotal: number | null
          unit_price: number
        }
        Insert: {
          basket_item_id?: string | null
          course_type?: string
          id?: string
          is_prepared?: boolean | null
          menu_item_id?: string | null
          modifications?: Json | null
          notes?: string | null
          order_id?: string | null
          payment_status?: string | null
          quantity: number
          quantity_paid?: number | null
          subtotal?: number | null
          unit_price: number
        }
        Update: {
          basket_item_id?: string | null
          course_type?: string
          id?: string
          is_prepared?: boolean | null
          menu_item_id?: string | null
          modifications?: Json | null
          notes?: string | null
          order_id?: string | null
          payment_status?: string | null
          quantity?: number
          quantity_paid?: number | null
          subtotal?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_paid: number
          assignment_type: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          current_course_started_at: string | null
          customer_id: string | null
          customer_name: string | null
          external_pos_order_id: string | null
          id: string
          is_ready: boolean | null
          is_served: boolean | null
          kitchen_status: string | null
          location_id: string | null
          notes: string | null
          order_number: number | null
          order_type: string | null
          ordered_at: string | null
          paid_at: string | null
          payment_status: string | null
          pos_metadata: Json | null
          pos_sync_status: string | null
          ready_at: string | null
          reservation_id: string | null
          room_number: string | null
          scheduled_for: string | null
          sent_to_kitchen_at: string | null
          status: string | null
          table_number: number | null
          table_numbers: number[] | null
          total_amount: number
        }
        Insert: {
          amount_paid?: number
          assignment_type?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_course_started_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          external_pos_order_id?: string | null
          id?: string
          is_ready?: boolean | null
          is_served?: boolean | null
          kitchen_status?: string | null
          location_id?: string | null
          notes?: string | null
          order_number?: number | null
          order_type?: string | null
          ordered_at?: string | null
          paid_at?: string | null
          payment_status?: string | null
          pos_metadata?: Json | null
          pos_sync_status?: string | null
          ready_at?: string | null
          reservation_id?: string | null
          room_number?: string | null
          scheduled_for?: string | null
          sent_to_kitchen_at?: string | null
          status?: string | null
          table_number?: number | null
          table_numbers?: number[] | null
          total_amount: number
        }
        Update: {
          amount_paid?: number
          assignment_type?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_course_started_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          external_pos_order_id?: string | null
          id?: string
          is_ready?: boolean | null
          is_served?: boolean | null
          kitchen_status?: string | null
          location_id?: string | null
          notes?: string | null
          order_number?: number | null
          order_type?: string | null
          ordered_at?: string | null
          paid_at?: string | null
          payment_status?: string | null
          pos_metadata?: Json | null
          pos_sync_status?: string | null
          ready_at?: string | null
          reservation_id?: string | null
          room_number?: string | null
          scheduled_for?: string | null
          sent_to_kitchen_at?: string | null
          status?: string | null
          table_number?: number | null
          table_numbers?: number[] | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      page_permissions: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          company_id: string | null
          created_at: string
          id: string
          page_name: string
          permission_type: Database["public"]["Enums"]["permission_type"]
          updated_at: string
        }
        Insert: {
          access_level: Database["public"]["Enums"]["access_level"]
          company_id?: string | null
          created_at?: string
          id?: string
          page_name: string
          permission_type: Database["public"]["Enums"]["permission_type"]
          updated_at?: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          company_id?: string | null
          created_at?: string
          id?: string
          page_name?: string
          permission_type?: Database["public"]["Enums"]["permission_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_items: {
        Row: {
          amount: number
          company_id: string
          created_at: string | null
          id: string
          order_item_id: string
          payment_id: string
          quantity: number
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string | null
          id?: string
          order_item_id: string
          payment_id: string
          quantity: number
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string | null
          id?: string
          order_item_id?: string
          payment_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_items_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          id: string
          method: string | null
          order_id: string | null
          paid_at: string | null
          paid_by: string | null
          split_amount: number | null
          split_index: number | null
          total_splits: number | null
        }
        Insert: {
          amount?: number | null
          id?: string
          method?: string | null
          order_id?: string | null
          paid_at?: string | null
          paid_by?: string | null
          split_amount?: number | null
          split_index?: number | null
          total_splits?: number | null
        }
        Update: {
          amount?: number | null
          id?: string
          method?: string | null
          order_id?: string | null
          paid_at?: string | null
          paid_by?: string | null
          split_amount?: number | null
          split_index?: number | null
          total_splits?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_agent_reservations: {
        Row: {
          call_duration: number | null
          call_recording_url: string | null
          called_at: string
          company_id: string
          created_at: string
          id: string
          notes: string | null
          phone_number: string | null
          reservation_id: string | null
          source_post_id: string | null
          successful_booking: boolean | null
        }
        Insert: {
          call_duration?: number | null
          call_recording_url?: string | null
          called_at?: string
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          phone_number?: string | null
          reservation_id?: string | null
          source_post_id?: string | null
          successful_booking?: boolean | null
        }
        Update: {
          call_duration?: number | null
          call_recording_url?: string | null
          called_at?: string
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          phone_number?: string | null
          reservation_id?: string | null
          source_post_id?: string | null
          successful_booking?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_agent_reservations_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_agent_reservations_source_post_id_fkey"
            columns: ["source_post_id"]
            isOneToOne: false
            referencedRelation: "social_media_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_credentials: {
        Row: {
          company_id: string
          connection_metadata: Json | null
          connection_status: string
          created_at: string
          encrypted_credentials: Json
          id: string
          last_connected_at: string | null
          last_sync_at: string | null
          pos_system: string
          updated_at: string
        }
        Insert: {
          company_id: string
          connection_metadata?: Json | null
          connection_status?: string
          created_at?: string
          encrypted_credentials: Json
          id?: string
          last_connected_at?: string | null
          last_sync_at?: string | null
          pos_system: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          connection_metadata?: Json | null
          connection_status?: string
          created_at?: string
          encrypted_credentials?: Json
          id?: string
          last_connected_at?: string | null
          last_sync_at?: string | null
          pos_system?: string
          updated_at?: string
        }
        Relationships: []
      }
      pos_order_sync_logs: {
        Row: {
          company_id: string
          created_at: string | null
          error_details: string | null
          external_pos_order_id: string
          id: string
          order_id: string | null
          pos_data: Json | null
          sync_operation: string
          sync_status: string
          synced_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          error_details?: string | null
          external_pos_order_id: string
          id?: string
          order_id?: string | null
          pos_data?: Json | null
          sync_operation: string
          sync_status?: string
          synced_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          error_details?: string | null
          external_pos_order_id?: string
          id?: string
          order_id?: string | null
          pos_data?: Json | null
          sync_operation?: string
          sync_status?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_order_sync_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_sync_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sync_logs: {
        Row: {
          company_id: string
          conflict_reason: string | null
          created_at: string
          data_after: Json | null
          data_before: Json | null
          entity_id: string | null
          entity_type: string
          error_details: string | null
          external_entity_id: string | null
          id: string
          metadata: Json | null
          operation: string
          pos_system: string
          processed_at: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          sync_direction: string
        }
        Insert: {
          company_id: string
          conflict_reason?: string | null
          created_at?: string
          data_after?: Json | null
          data_before?: Json | null
          entity_id?: string | null
          entity_type: string
          error_details?: string | null
          external_entity_id?: string | null
          id?: string
          metadata?: Json | null
          operation: string
          pos_system: string
          processed_at?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status: string
          sync_direction: string
        }
        Update: {
          company_id?: string
          conflict_reason?: string | null
          created_at?: string
          data_after?: Json | null
          data_before?: Json | null
          entity_id?: string | null
          entity_type?: string
          error_details?: string | null
          external_entity_id?: string | null
          id?: string
          metadata?: Json | null
          operation?: string
          pos_system?: string
          processed_at?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          sync_direction?: string
        }
        Relationships: []
      }
      pos_sync_queue: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          entity_ids: string[]
          entity_type: string
          error_details: string | null
          id: string
          max_retries: number
          metadata: Json | null
          operation_type: string
          pos_system: string
          priority: number
          retry_count: number
          scheduled_at: string
          started_at: string | null
          status: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          entity_ids?: string[]
          entity_type: string
          error_details?: string | null
          id?: string
          max_retries?: number
          metadata?: Json | null
          operation_type: string
          pos_system: string
          priority?: number
          retry_count?: number
          scheduled_at?: string
          started_at?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          entity_ids?: string[]
          entity_type?: string
          error_details?: string | null
          id?: string
          max_retries?: number
          metadata?: Json | null
          operation_type?: string
          pos_system?: string
          priority?: number
          retry_count?: number
          scheduled_at?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      pos_table_sync_logs: {
        Row: {
          company_id: string
          data_after: Json | null
          data_before: Json | null
          error_details: string | null
          external_table_id: string | null
          id: string
          operation: string
          pos_system: string
          processed_at: string | null
          status: string
          table_id: string | null
        }
        Insert: {
          company_id: string
          data_after?: Json | null
          data_before?: Json | null
          error_details?: string | null
          external_table_id?: string | null
          id?: string
          operation: string
          pos_system: string
          processed_at?: string | null
          status?: string
          table_id?: string | null
        }
        Update: {
          company_id?: string
          data_after?: Json | null
          data_before?: Json | null
          error_details?: string | null
          external_table_id?: string | null
          id?: string
          operation?: string
          pos_system?: string
          processed_at?: string | null
          status?: string
          table_id?: string | null
        }
        Relationships: []
      }
      product_links: {
        Row: {
          base_price: number | null
          company_id: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          level: number
          menu_item_id: string
          option_name: string
          parent_link_id: string | null
          price_modifier: number | null
          updated_at: string | null
        }
        Insert: {
          base_price?: number | null
          company_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          level?: number
          menu_item_id: string
          option_name: string
          parent_link_id?: string | null
          price_modifier?: number | null
          updated_at?: string | null
        }
        Update: {
          base_price?: number | null
          company_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          level?: number
          menu_item_id?: string
          option_name?: string
          parent_link_id?: string | null
          price_modifier?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_links_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_links_parent_link_id_fkey"
            columns: ["parent_link_id"]
            isOneToOne: false
            referencedRelation: "product_links"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_critical_changes_audit: {
        Row: {
          change_source: string
          changed_at: string
          changed_by: string | null
          company_id: string
          field_changed: string
          id: string
          ip_address: string | null
          new_value: string | null
          old_value: string | null
          reservation_id: string
          user_agent: string | null
        }
        Insert: {
          change_source: string
          changed_at?: string
          changed_by?: string | null
          company_id: string
          field_changed: string
          id?: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
          reservation_id: string
          user_agent?: string | null
        }
        Update: {
          change_source?: string
          changed_at?: string
          changed_by?: string | null
          company_id?: string
          field_changed?: string
          id?: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
          reservation_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      reservation_patterns: {
        Row: {
          company_id: string
          created_at: string
          day_of_week: number
          frequency_count: number
          hour_of_day: number
          id: string
          party_size: number
          updated_at: string
          week_of_year: number
          year: number
        }
        Insert: {
          company_id: string
          created_at?: string
          day_of_week: number
          frequency_count?: number
          hour_of_day: number
          id?: string
          party_size: number
          updated_at?: string
          week_of_year: number
          year: number
        }
        Update: {
          company_id?: string
          created_at?: string
          day_of_week?: number
          frequency_count?: number
          hour_of_day?: number
          id?: string
          party_size?: number
          updated_at?: string
          week_of_year?: number
          year?: number
        }
        Relationships: []
      }
      reservations: {
        Row: {
          allergens: string[] | null
          anchor_table: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          customer_name: string
          date: string | null
          desserts_served_at: string | null
          email: string | null
          end_time: string | null
          external_id: string | null
          has_allergens: boolean | null
          id: string
          is_locked: boolean | null
          last_manual_move_time: string | null
          locked: boolean | null
          locked_until: string | null
          mains_served_at: string | null
          notes: string | null
          party_size: number
          phone: string | null
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          reservation_type: string | null
          seated_at: string | null
          start_time: string | null
          starters_served_at: string | null
          status: string | null
          table_number: number | null
          table_numbers: number[] | null
          time: string | null
        }
        Insert: {
          allergens?: string[] | null
          anchor_table?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_name: string
          date?: string | null
          desserts_served_at?: string | null
          email?: string | null
          end_time?: string | null
          external_id?: string | null
          has_allergens?: boolean | null
          id?: string
          is_locked?: boolean | null
          last_manual_move_time?: string | null
          locked?: boolean | null
          locked_until?: string | null
          mains_served_at?: string | null
          notes?: string | null
          party_size: number
          phone?: string | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          reservation_type?: string | null
          seated_at?: string | null
          start_time?: string | null
          starters_served_at?: string | null
          status?: string | null
          table_number?: number | null
          table_numbers?: number[] | null
          time?: string | null
        }
        Update: {
          allergens?: string[] | null
          anchor_table?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_name?: string
          date?: string | null
          desserts_served_at?: string | null
          email?: string | null
          end_time?: string | null
          external_id?: string | null
          has_allergens?: boolean | null
          id?: string
          is_locked?: boolean | null
          last_manual_move_time?: string | null
          locked?: boolean | null
          locked_until?: string | null
          mains_served_at?: string | null
          notes?: string | null
          party_size?: number
          phone?: string | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          reservation_type?: string | null
          seated_at?: string | null
          start_time?: string | null
          starters_served_at?: string | null
          status?: string | null
          table_number?: number | null
          table_numbers?: number[] | null
          time?: string | null
        }
        Relationships: []
      }
      rota_entries: {
        Row: {
          created_at: string | null
          friday: string | null
          id: string
          monday: string | null
          notes: string | null
          rota_id: string | null
          saturday: string | null
          staff_type: string[] | null
          sunday: string | null
          thursday: string | null
          total_hours: number | null
          tuesday: string | null
          user_id: string | null
          wednesday: string | null
        }
        Insert: {
          created_at?: string | null
          friday?: string | null
          id?: string
          monday?: string | null
          notes?: string | null
          rota_id?: string | null
          saturday?: string | null
          staff_type?: string[] | null
          sunday?: string | null
          thursday?: string | null
          total_hours?: number | null
          tuesday?: string | null
          user_id?: string | null
          wednesday?: string | null
        }
        Update: {
          created_at?: string | null
          friday?: string | null
          id?: string
          monday?: string | null
          notes?: string | null
          rota_id?: string | null
          saturday?: string | null
          staff_type?: string[] | null
          sunday?: string | null
          thursday?: string | null
          total_hours?: number | null
          tuesday?: string | null
          user_id?: string | null
          wednesday?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rota_entries_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rotas: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          published: boolean | null
          updated_at: string
          user_id: string | null
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          published?: boolean | null
          updated_at: string
          user_id?: string | null
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          published?: boolean | null
          updated_at?: string
          user_id?: string | null
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      seasonal_adjustments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          large_party_probability: number | null
          party_size_multiplier: number | null
          season_type: string
          updated_at: string
          volume_multiplier: number | null
          week_range: number[]
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          large_party_probability?: number | null
          party_size_multiplier?: number | null
          season_type: string
          updated_at?: string
          volume_multiplier?: number | null
          week_range: number[]
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          large_party_probability?: number | null
          party_size_multiplier?: number | null
          season_type?: string
          updated_at?: string
          volume_multiplier?: number | null
          week_range?: number[]
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      shift_approval_requests: {
        Row: {
          approved: boolean | null
          created_at: string
          day_of_week: string
          id: string
          reason: string
          requested_hours: number
          requester_user_id: string
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          shift_date: string
          shift_swap_request_id: string
        }
        Insert: {
          approved?: boolean | null
          created_at?: string
          day_of_week: string
          id?: string
          reason: string
          requested_hours: number
          requester_user_id: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          shift_date: string
          shift_swap_request_id: string
        }
        Update: {
          approved?: boolean | null
          created_at?: string
          day_of_week?: string
          id?: string
          reason?: string
          requested_hours?: number
          requester_user_id?: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          shift_date?: string
          shift_swap_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_approval_requests_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_approval_requests_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_approval_requests_shift_swap_request_id_fkey"
            columns: ["shift_swap_request_id"]
            isOneToOne: false
            referencedRelation: "shift_swap_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_logs: {
        Row: {
          created_at: string | null
          duration_hours: number | null
          end_time: string | null
          id: string
          start_time: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration_hours?: number | null
          end_time?: string | null
          id?: string
          start_time?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration_hours?: number | null
          end_time?: string | null
          id?: string
          start_time?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swap_requests: {
        Row: {
          accepted_by_user_id: string | null
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          day_of_week: string
          id: string
          original_user_id: string
          request_type: string
          requested_by_user_id: string | null
          requires_approval: boolean | null
          shift_date: string
          shift_finish_time: string
          shift_start_time: string
          status: string
          swap_with_date: string | null
          swap_with_day_of_week: string | null
          swap_with_finish_time: string | null
          swap_with_start_time: string | null
          updated_at: string
        }
        Insert: {
          accepted_by_user_id?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          day_of_week: string
          id?: string
          original_user_id: string
          request_type?: string
          requested_by_user_id?: string | null
          requires_approval?: boolean | null
          shift_date: string
          shift_finish_time: string
          shift_start_time: string
          status?: string
          swap_with_date?: string | null
          swap_with_day_of_week?: string | null
          swap_with_finish_time?: string | null
          swap_with_start_time?: string | null
          updated_at?: string
        }
        Update: {
          accepted_by_user_id?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          day_of_week?: string
          id?: string
          original_user_id?: string
          request_type?: string
          requested_by_user_id?: string | null
          requires_approval?: boolean | null
          shift_date?: string
          shift_finish_time?: string
          shift_start_time?: string
          status?: string
          swap_with_date?: string | null
          swap_with_day_of_week?: string | null
          swap_with_finish_time?: string | null
          swap_with_start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_swap_requests_accepted_by_user_id_fkey"
            columns: ["accepted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_original_user_id_fkey"
            columns: ["original_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_reminder_logs: {
        Row: {
          company_id: string | null
          company_local_time: string | null
          error_message: string | null
          id: string
          inbound_message: string | null
          message_type: string
          phone: string
          processed_at_utc: string | null
          reservation_id: string | null
          sent_at: string | null
          status: string
          twilio_message_sid: string | null
        }
        Insert: {
          company_id?: string | null
          company_local_time?: string | null
          error_message?: string | null
          id?: string
          inbound_message?: string | null
          message_type: string
          phone: string
          processed_at_utc?: string | null
          reservation_id?: string | null
          sent_at?: string | null
          status: string
          twilio_message_sid?: string | null
        }
        Update: {
          company_id?: string | null
          company_local_time?: string | null
          error_message?: string | null
          id?: string
          inbound_message?: string | null
          message_type?: string
          phone?: string
          processed_at_utc?: string | null
          reservation_id?: string | null
          sent_at?: string | null
          status?: string
          twilio_message_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_reminder_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_reminder_logs_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_posts: {
        Row: {
          approval_status: string
          clicks_count: number | null
          comments_count: number | null
          company_id: string
          content: string | null
          created_at: string
          cta_url: string | null
          estimated_reach: string | null
          id: string
          image_urls: string[] | null
          impressions_count: number | null
          likes_count: number | null
          menu_item_id: string | null
          platform: string
          post_id: string | null
          posted_at: string
          scheduled_at: string | null
          shares_count: number | null
          updated_at: string
          video_url: string | null
          views_count: number | null
        }
        Insert: {
          approval_status?: string
          clicks_count?: number | null
          comments_count?: number | null
          company_id: string
          content?: string | null
          created_at?: string
          cta_url?: string | null
          estimated_reach?: string | null
          id?: string
          image_urls?: string[] | null
          impressions_count?: number | null
          likes_count?: number | null
          menu_item_id?: string | null
          platform: string
          post_id?: string | null
          posted_at?: string
          scheduled_at?: string | null
          shares_count?: number | null
          updated_at?: string
          video_url?: string | null
          views_count?: number | null
        }
        Update: {
          approval_status?: string
          clicks_count?: number | null
          comments_count?: number | null
          company_id?: string
          content?: string | null
          created_at?: string
          cta_url?: string | null
          estimated_reach?: string | null
          id?: string
          image_urls?: string[] | null
          impressions_count?: number | null
          likes_count?: number | null
          menu_item_id?: string | null
          platform?: string
          post_id?: string | null
          posted_at?: string
          scheduled_at?: string | null
          shares_count?: number | null
          updated_at?: string
          video_url?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_media_posts_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      supplier_categories: {
        Row: {
          color_scheme: string
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color_scheme?: string
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color_scheme?: string
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_order_items: {
        Row: {
          cost_per_unit: number | null
          created_at: string | null
          current_quantity: number | null
          final_quantity: number | null
          id: string
          ingredient_id: string | null
          ingredient_name: string
          pack_size: string | null
          status: string | null
          suggested_quantity: number | null
          supplier_order_id: string | null
        }
        Insert: {
          cost_per_unit?: number | null
          created_at?: string | null
          current_quantity?: number | null
          final_quantity?: number | null
          id?: string
          ingredient_id?: string | null
          ingredient_name: string
          pack_size?: string | null
          status?: string | null
          suggested_quantity?: number | null
          supplier_order_id?: string | null
        }
        Update: {
          cost_per_unit?: number | null
          created_at?: string | null
          current_quantity?: number | null
          final_quantity?: number | null
          id?: string
          ingredient_id?: string | null
          ingredient_name?: string
          pack_size?: string | null
          status?: string | null
          suggested_quantity?: number | null
          supplier_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_order_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_order_items_supplier_order_id_fkey"
            columns: ["supplier_order_id"]
            isOneToOne: false
            referencedRelation: "supplier_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_orders: {
        Row: {
          category: string
          created_at: string | null
          date: string
          id: string
          status: string | null
          total_cost: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          date: string
          id?: string
          status?: string | null
          total_cost?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          date?: string
          id?: string
          status?: string | null
          total_cost?: number | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          category: string
          company_id: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          lead_time_days: number | null
          minimum_order_value: number | null
          name: string
          notes: string | null
          order_method: string
          phone: string | null
          scheduling_mode: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string
          company_id: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          minimum_order_value?: number | null
          name: string
          notes?: string | null
          order_method?: string
          phone?: string | null
          scheduling_mode?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string
          company_id?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          minimum_order_value?: number | null
          name?: string
          notes?: string | null
          order_method?: string
          phone?: string | null
          scheduling_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_default_permissions: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          created_at: string | null
          id: string
          page_name: string
          permission_type: Database["public"]["Enums"]["permission_type"]
          updated_at: string | null
        }
        Insert: {
          access_level: Database["public"]["Enums"]["access_level"]
          created_at?: string | null
          id?: string
          page_name: string
          permission_type: Database["public"]["Enums"]["permission_type"]
          updated_at?: string | null
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          created_at?: string | null
          id?: string
          page_name?: string
          permission_type?: Database["public"]["Enums"]["permission_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      table_group_memberships: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          priority_order: number | null
          table_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          priority_order?: number | null
          table_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          priority_order?: number | null
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "table_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_group_memberships_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_groups: {
        Row: {
          advanced_settings: Json | null
          company_id: string
          created_at: string | null
          description: string | null
          display_order: number | null
          group_name: string
          group_priority: number | null
          id: string
          is_active: boolean | null
          max_combined_capacity: number | null
          updated_at: string | null
        }
        Insert: {
          advanced_settings?: Json | null
          company_id: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          group_name: string
          group_priority?: number | null
          id?: string
          is_active?: boolean | null
          max_combined_capacity?: number | null
          updated_at?: string | null
        }
        Update: {
          advanced_settings?: Json | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          group_name?: string
          group_priority?: number | null
          id?: string
          is_active?: boolean | null
          max_combined_capacity?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      table_performance_metrics: {
        Row: {
          average_duration_minutes: number | null
          average_order_value: number | null
          average_party_size: number | null
          company_id: string
          created_at: string | null
          id: string
          metrics_date: string
          table_number: number
          total_orders: number | null
          total_revenue: number | null
          turnover_count: number | null
          updated_at: string | null
          utilization_rate: number | null
        }
        Insert: {
          average_duration_minutes?: number | null
          average_order_value?: number | null
          average_party_size?: number | null
          company_id: string
          created_at?: string | null
          id?: string
          metrics_date: string
          table_number: number
          total_orders?: number | null
          total_revenue?: number | null
          turnover_count?: number | null
          updated_at?: string | null
          utilization_rate?: number | null
        }
        Update: {
          average_duration_minutes?: number | null
          average_order_value?: number | null
          average_party_size?: number | null
          company_id?: string
          created_at?: string | null
          id?: string
          metrics_date?: string
          table_number?: number
          total_orders?: number | null
          total_revenue?: number | null
          turnover_count?: number | null
          updated_at?: string | null
          utilization_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "table_performance_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      table_seat_positions: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_accessible: boolean | null
          seat_number: number
          seat_type: string | null
          table_id: string
          updated_at: string
          x_position: number
          y_position: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_accessible?: boolean | null
          seat_number: number
          seat_type?: string | null
          table_id: string
          updated_at?: string
          x_position?: number
          y_position?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_accessible?: boolean | null
          seat_number?: number
          seat_type?: string | null
          table_id?: string
          updated_at?: string
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "table_seat_positions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_service_schedules: {
        Row: {
          company_id: string
          created_at: string
          duration_days: number | null
          id: string
          notes: string | null
          requires_attention: boolean
          resolved_at: string | null
          resolved_by: string | null
          scheduled_at: string
          scheduled_end: string | null
          service_status: string
          table_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          duration_days?: number | null
          id?: string
          notes?: string | null
          requires_attention?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          scheduled_at?: string
          scheduled_end?: string | null
          service_status: string
          table_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          duration_days?: number | null
          id?: string
          notes?: string | null
          requires_attention?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          scheduled_at?: string
          scheduled_end?: string | null
          service_status?: string
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_service_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_service_schedules_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_service_schedules_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_utilization_analytics: {
        Row: {
          assigned_table_numbers: number[]
          assignment_date: string
          assignment_strategy: string | null
          assignment_time: string
          company_id: string
          created_at: string
          id: string
          move_reason: string | null
          opportunity_cost_score: number | null
          party_size: number
          reservation_id: string
          utilization_efficiency: number | null
          was_moved_manually: boolean | null
        }
        Insert: {
          assigned_table_numbers: number[]
          assignment_date: string
          assignment_strategy?: string | null
          assignment_time: string
          company_id: string
          created_at?: string
          id?: string
          move_reason?: string | null
          opportunity_cost_score?: number | null
          party_size: number
          reservation_id: string
          utilization_efficiency?: number | null
          was_moved_manually?: boolean | null
        }
        Update: {
          assigned_table_numbers?: number[]
          assignment_date?: string
          assignment_strategy?: string | null
          assignment_time?: string
          company_id?: string
          created_at?: string
          id?: string
          move_reason?: string | null
          opportunity_cost_score?: number | null
          party_size?: number
          reservation_id?: string
          utilization_efficiency?: number | null
          was_moved_manually?: boolean | null
        }
        Relationships: []
      }
      tables: {
        Row: {
          accessibility_friendly: boolean | null
          ambiance: string | null
          can_combine: boolean | null
          company_id: string
          created_at: string
          description: string | null
          external_pos_id: string | null
          features: Json | null
          floor_level: number
          group_priority: number | null
          height: number | null
          id: string
          is_active: boolean | null
          is_business_friendly: boolean | null
          is_family_friendly: boolean | null
          is_high_top: boolean | null
          is_main_dining: boolean | null
          is_outdoor: boolean | null
          is_quiet_area: boolean | null
          last_pos_sync: string | null
          location: string | null
          max_combine_size: number | null
          pos_metadata: Json | null
          pos_sync_status: string | null
          privacy_level: string | null
          rotation: number | null
          seats: number | null
          service_status: string | null
          shape: string | null
          status: string | null
          table_name: string | null
          table_number: number
          type: string | null
          vip_status: boolean | null
          width: number | null
          window_seating: boolean | null
          x_position: number | null
          y_position: number | null
        }
        Insert: {
          accessibility_friendly?: boolean | null
          ambiance?: string | null
          can_combine?: boolean | null
          company_id: string
          created_at?: string
          description?: string | null
          external_pos_id?: string | null
          features?: Json | null
          floor_level?: number
          group_priority?: number | null
          height?: number | null
          id?: string
          is_active?: boolean | null
          is_business_friendly?: boolean | null
          is_family_friendly?: boolean | null
          is_high_top?: boolean | null
          is_main_dining?: boolean | null
          is_outdoor?: boolean | null
          is_quiet_area?: boolean | null
          last_pos_sync?: string | null
          location?: string | null
          max_combine_size?: number | null
          pos_metadata?: Json | null
          pos_sync_status?: string | null
          privacy_level?: string | null
          rotation?: number | null
          seats?: number | null
          service_status?: string | null
          shape?: string | null
          status?: string | null
          table_name?: string | null
          table_number: number
          type?: string | null
          vip_status?: boolean | null
          width?: number | null
          window_seating?: boolean | null
          x_position?: number | null
          y_position?: number | null
        }
        Update: {
          accessibility_friendly?: boolean | null
          ambiance?: string | null
          can_combine?: boolean | null
          company_id?: string
          created_at?: string
          description?: string | null
          external_pos_id?: string | null
          features?: Json | null
          floor_level?: number
          group_priority?: number | null
          height?: number | null
          id?: string
          is_active?: boolean | null
          is_business_friendly?: boolean | null
          is_family_friendly?: boolean | null
          is_high_top?: boolean | null
          is_main_dining?: boolean | null
          is_outdoor?: boolean | null
          is_quiet_area?: boolean | null
          last_pos_sync?: string | null
          location?: string | null
          max_combine_size?: number | null
          pos_metadata?: Json | null
          pos_sync_status?: string | null
          privacy_level?: string | null
          rotation?: number | null
          seats?: number | null
          service_status?: string | null
          shape?: string | null
          status?: string | null
          table_name?: string | null
          table_number?: number
          type?: string | null
          vip_status?: boolean | null
          width?: number | null
          window_seating?: boolean | null
          x_position?: number | null
          y_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      trusted_devices: {
        Row: {
          company_id: string
          connection_type: string | null
          device_id: string
          device_name: string | null
          device_type: string | null
          first_paired_at: string | null
          id: string
          is_revoked: boolean | null
          last_seen_at: string | null
          revoked_at: string | null
        }
        Insert: {
          company_id: string
          connection_type?: string | null
          device_id: string
          device_name?: string | null
          device_type?: string | null
          first_paired_at?: string | null
          id?: string
          is_revoked?: boolean | null
          last_seen_at?: string | null
          revoked_at?: string | null
        }
        Update: {
          company_id?: string
          connection_type?: string | null
          device_id?: string
          device_name?: string | null
          device_type?: string | null
          first_paired_at?: string | null
          id?: string
          is_revoked?: boolean | null
          last_seen_at?: string | null
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trusted_devices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          company_id: string | null
          created_at: string | null
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          is_company_admin: boolean | null
          is_owner: boolean | null
          password_reset_required: boolean | null
          pin_code: string | null
          pin_code_encrypted: string | null
          remaining_holiday_days: number | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          company_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          is_company_admin?: boolean | null
          is_owner?: boolean | null
          password_reset_required?: boolean | null
          pin_code?: string | null
          pin_code_encrypted?: string | null
          remaining_holiday_days?: number | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          company_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_company_admin?: boolean | null
          is_owner?: boolean | null
          password_reset_required?: boolean | null
          pin_code?: string | null
          pin_code_encrypted?: string | null
          remaining_holiday_days?: number | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      wastage_log: {
        Row: {
          company_id: string
          cost_impact: number
          created_at: string
          id: string
          ingredient_id: string
          location: string
          logged_by: string | null
          notes: string | null
          quantity: number
          reason: string
          unit: string
          wastage_batch_id: string | null
          wastage_time: string
        }
        Insert: {
          company_id: string
          cost_impact?: number
          created_at?: string
          id?: string
          ingredient_id: string
          location: string
          logged_by?: string | null
          notes?: string | null
          quantity: number
          reason: string
          unit?: string
          wastage_batch_id?: string | null
          wastage_time?: string
        }
        Update: {
          company_id?: string
          cost_impact?: number
          created_at?: string
          id?: string
          ingredient_id?: string
          location?: string
          logged_by?: string | null
          notes?: string | null
          quantity?: number
          reason?: string
          unit?: string
          wastage_batch_id?: string | null
          wastage_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "wastage_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wastage_log_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wastage_log_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_reservation_tables_for_capacity: {
        Args: {
          p_company_id: string
          p_date: string
          p_party_size: number
          p_reservation_id: string
          p_time: string
        }
        Returns: Json
      }
      admin_get_company_api_token: {
        Args: { p_company_id: string }
        Returns: Json
      }
      allowed_company_ids_for_current_user: { Args: never; Returns: string[] }
      apply_system_defaults_to_new_company: {
        Args: { p_company_id: string }
        Returns: Json
      }
      auth_health_check: { Args: never; Returns: Json }
      authenticate_by_pin_for_company: {
        Args: { company_id_param: string; pin_input: string }
        Returns: {
          company_id: string
          email: string
          full_name: string
          is_owner: boolean
          role: string
          user_id: string
        }[]
      }
      authenticate_by_pin_for_company_secure: {
        Args: { company_id_input: string; pin_input: string }
        Returns: {
          company_id: string
          is_owner: boolean
          user_id: string
          user_name: string
          user_role: string
        }[]
      }
      authenticate_by_pin_secure: {
        Args: { pin_input: string }
        Returns: {
          company_id: string
          email: string
          full_name: string
          is_owner: boolean
          role: string
          user_id: string
        }[]
      }
      authenticate_by_pin_secure_v2: {
        Args: { pin_input: string }
        Returns: {
          company_id: string
          email: string
          full_name: string
          is_owner: boolean
          role: string
          user_id: string
        }[]
      }
      calculate_customer_total_spent: {
        Args: { customer_uuid: string }
        Returns: number
      }
      calculate_group_capacity_scenarios: {
        Args: { p_company_id: string; p_group_id: string }
        Returns: Json
      }
      calculate_group_partial_capacity: {
        Args: {
          p_company_id: string
          p_group_id: string
          p_used_tables?: number[]
        }
        Returns: Json
      }
      can_view_company_users: { Args: never; Returns: boolean }
      change_team_member_pin: {
        Args: { p_member_id: string; p_new_pin: string; p_owner_pin: string }
        Returns: Json
      }
      check_auth_rate_limit: {
        Args: {
          identifier: string
          max_attempts?: number
          window_minutes?: number
        }
        Returns: boolean
      }
      check_comprehensive_availability:
        | {
            Args: {
              p_company_id: string
              p_date: string
              p_duration_minutes?: number
              p_party_size: number
              p_time: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_accessibility_needed?: boolean
              p_company_id: string
              p_date: string
              p_party_size: number
              p_time: string
            }
            Returns: Json
          }
      check_table_conflict: {
        Args: {
          p_date: string
          p_exclude_reservation_id?: string
          p_table_numbers: number[]
          p_time: string
        }
        Returns: boolean
      }
      cleanup_expired_oauth_states: { Args: never; Returns: undefined }
      cleanup_phone_numbers: { Args: never; Returns: Json }
      clear_pin_rate_limit: { Args: { pin_input: string }; Returns: undefined }
      continuous_conflict_scan: {
        Args: { p_company_id: string }
        Returns: {
          conflict_date: string
          conflict_time: string
          conflict_type: string
          details: Json
          reservation_count: number
          table_number: number
        }[]
      }
      create_channel_with_members: {
        Args: {
          p_description?: string
          p_member_ids?: string[]
          p_name: string
        }
        Returns: string
      }
      create_company_admin_for_existing_company: {
        Args: {
          p_company_id: string
          p_email: string
          p_full_name?: string
          p_password: string
        }
        Returns: Json
      }
      create_company_with_admin: {
        Args: {
          p_admin_email: string
          p_admin_full_name?: string
          p_admin_password: string
          p_auth_user_id?: string
          p_company_name: string
          p_owner_pin?: string
          p_subdomain: string
        }
        Returns: Json
      }
      create_default_company_features: {
        Args: { p_company_id: string }
        Returns: Json
      }
      create_pin_user: {
        Args: {
          p_company_id?: string
          p_full_name: string
          p_pin_code: string
          p_role: string
        }
        Returns: string
      }
      create_service_schedule: {
        Args: { p_duration_days: number; p_table_id: string }
        Returns: Json
      }
      create_super_admin: {
        Args: { admin_email: string; admin_full_name: string }
        Returns: Json
      }
      decrypt_pin: { Args: { encrypted_pin: string }; Returns: string }
      delete_company_super_admin: {
        Args: { p_company_id: string }
        Returns: Json
      }
      detect_existing_double_bookings: {
        Args: { p_company_id: string }
        Returns: {
          conflict_date: string
          conflict_time: string
          reservation_count: number
          reservation_details: Json
          table_number: number
        }[]
      }
      encrypt_pin: { Args: { pin_text: string }; Returns: string }
      ensure_company_api_token: {
        Args: { p_company_id: string }
        Returns: Json
      }
      ensure_user_profile_for_current_auth: { Args: never; Returns: string }
      external_reservation_search: {
        Args: {
          _company_id: string
          _customer_name: string
          _date: string
          _time: string
        }
        Returns: {
          allergens: string[] | null
          anchor_table: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          customer_name: string
          date: string | null
          desserts_served_at: string | null
          email: string | null
          end_time: string | null
          external_id: string | null
          has_allergens: boolean | null
          id: string
          is_locked: boolean | null
          last_manual_move_time: string | null
          locked: boolean | null
          locked_until: string | null
          mains_served_at: string | null
          notes: string | null
          party_size: number
          phone: string | null
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          reservation_type: string | null
          seated_at: string | null
          start_time: string | null
          starters_served_at: string | null
          status: string | null
          table_number: number | null
          table_numbers: number[] | null
          time: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      find_best_contiguous_sequence: {
        Args: {
          p_company_id: string
          table_array: number[]
          target_party_size: number
        }
        Returns: number[]
      }
      find_company_by_admin_email: {
        Args: { admin_email: string }
        Returns: {
          id: string
          name: string
          status: string
          subdomain: string
        }[]
      }
      fix_company_missing_auth_users: { Args: never; Returns: Json }
      generate_integration_token: { Args: never; Returns: string }
      generate_unique_pin:
        | { Args: { p_company_id?: string }; Returns: string }
        | { Args: never; Returns: string }
      get_all_companies_detailed: { Args: never; Returns: Json }
      get_all_users_cross_company: {
        Args: never
        Returns: {
          company_id: string
          company_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          is_company_admin: boolean
          last_login: string
          pin_code: string
          role: string
        }[]
      }
      get_available_table_groups_with_status: {
        Args: { p_company_id: string }
        Returns: {
          advanced_settings: Json
          can_combine: boolean
          description: string
          display_order: number
          group_id: string
          group_name: string
          group_priority: number
          is_active: boolean
          max_combined_capacity: number
          out_of_service_tables: number[]
          table_numbers: number[]
        }[]
      }
      get_company_features: {
        Args: { p_company_id: string }
        Returns: {
          created_at: string
          enabled: boolean
          expires_at: string
          feature_name: string
          updated_at: string
        }[]
      }
      get_company_for_pin_user: { Args: { pin_input: string }; Returns: string }
      get_current_user_company: { Args: never; Returns: string }
      get_current_user_company_direct: { Args: never; Returns: string }
      get_current_user_role: { Args: never; Returns: string }
      get_decrypted_pin: { Args: { user_id_param: string }; Returns: string }
      get_next_order_number: { Args: { p_company_id: string }; Returns: number }
      get_operational_tables: {
        Args: { p_company_id: string }
        Returns: {
          accessibility_friendly: boolean
          company_id: string
          id: string
          is_active: boolean
          seats: number
          service_status: string
          table_name: string
          table_number: number
        }[]
      }
      get_page_permissions_by_company: {
        Args: { company_uuid: string }
        Returns: {
          access_level: string
          company_id: string
          created_at: string
          id: string
          page_name: string
          permission_type: string
          updated_at: string
        }[]
      }
      get_reservation_change_history: {
        Args: { p_company_id: string; p_reservation_id: string }
        Returns: {
          change_source: string
          changed_at: string
          changed_by: string
          field_changed: string
          new_value: string
          old_value: string
          user_email: string
        }[]
      }
      get_super_admin_dashboard_metrics: { Args: never; Returns: Json }
      get_super_admin_dashboard_metrics_detailed: { Args: never; Returns: Json }
      get_system_health_detailed: { Args: never; Returns: Json }
      get_table_groups_with_real_time_availability: {
        Args: {
          p_accessibility_needed?: boolean
          p_company_id: string
          p_date: string
          p_party_size: number
          p_time: string
        }
        Returns: {
          accessibility_friendly: boolean
          blocking_reservations: Json
          can_accommodate: boolean
          free_seats: number
          free_tables: number[]
          group_id: string
          group_name: string
          is_available: boolean
          optimization_potential: number
          table_numbers: number[]
          total_seats: number
        }[]
      }
      get_table_groups_with_tables: {
        Args: { p_company_id: string }
        Returns: {
          description: string
          display_order: number
          group_id: string
          group_name: string
          is_active: boolean
          max_combined_capacity: number
          table_numbers: number[]
          total_seats: number
        }[]
      }
      get_table_seat_positions: {
        Args: { p_company_id: string; p_table_id: string }
        Returns: Json
      }
      get_tables_requiring_attention: {
        Args: { p_company_id: string }
        Returns: {
          duration_days: number
          schedule_id: string
          scheduled_at: string
          scheduled_end: string
          service_status: string
          table_id: string
          table_name: string
          table_number: number
        }[]
      }
      get_user_company_safe: { Args: never; Returns: string }
      get_user_company_safe_v2: { Args: never; Returns: string }
      get_user_own_company_id: { Args: never; Returns: string }
      hash_password_md5: { Args: { password_text: string }; Returns: string }
      hash_pin_md5: { Args: { pin_text: string }; Returns: string }
      invite_team_member_with_pin: {
        Args: {
          p_email: string
          p_full_name: string
          p_pin: string
          p_role: string
        }
        Returns: Json
      }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_current_user_super_admin: { Args: never; Returns: boolean }
      is_current_user_super_admin_direct: { Args: never; Returns: boolean }
      is_pin_locked: { Args: { pin_input: string }; Returns: boolean }
      is_same_company: { Args: { target_user_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      link_user_to_company_by_email: {
        Args: { p_email: string }
        Returns: Json
      }
      load_company_permission_template: {
        Args: { p_company_id?: string; p_template_id: string }
        Returns: Json
      }
      log_auth_attempt: {
        Args: {
          p_action: string
          p_additional_data?: Json
          p_email: string
          p_error_message?: string
          p_success: boolean
        }
        Returns: undefined
      }
      log_company_isolation_violation: {
        Args: {
          p_company_id: string
          p_details?: Json
          p_operation: string
          p_table_name: string
        }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_resource_id?: string
          p_resource_type?: string
        }
        Returns: undefined
      }
      manage_company_feature: {
        Args: {
          p_company_id: string
          p_enabled: boolean
          p_expires_at?: string
          p_feature_name: string
        }
        Returns: Json
      }
      move_reservation_for_optimization: {
        Args: {
          p_company_id: string
          p_new_table_number: number
          p_reservation_id: string
        }
        Returns: boolean
      }
      move_table_in_group: {
        Args: {
          p_company_id?: string
          p_direction: string
          p_group_id: string
          p_table_id: string
        }
        Returns: Json
      }
      normalize_uk_phone: { Args: { phone_input: string }; Returns: string }
      re_evaluate_full_assignment: {
        Args: { p_company_id: string; p_reservation_id: string }
        Returns: Json
      }
      re_evaluate_reservation_assignment: {
        Args: { p_reservation_id: string }
        Returns: Json
      }
      reactivate_company_user: {
        Args: { user_id_param: string }
        Returns: Json
      }
      reactivate_user: { Args: { user_id_param: string }; Returns: Json }
      reorder_table_group_priorities: {
        Args: { p_company_id: string; p_group_orders: Json }
        Returns: Json
      }
      resequence_table_group: {
        Args: { p_company_id: string; p_group_id: string }
        Returns: undefined
      }
      reset_owner_pin: {
        Args: { p_company_id: string; p_new_pin?: string }
        Returns: Json
      }
      reset_to_system_defaults: {
        Args: { p_company_id?: string }
        Returns: Json
      }
      resolve_service_schedule: {
        Args: {
          p_action: string
          p_extend_days?: number
          p_schedule_id: string
        }
        Returns: Json
      }
      rotate_company_integration_token: {
        Args: { p_company_id: string }
        Returns: Json
      }
      run_health_check_all_companies: { Args: never; Returns: Json }
      save_company_permission_template: {
        Args: { p_company_id?: string; p_template_name: string }
        Returns: Json
      }
      save_group_arrangement: {
        Args: { p_arrangement: Json; p_company_id: string; p_group_id: string }
        Returns: Json
      }
      save_table_seat_positions: {
        Args: {
          p_company_id: string
          p_seat_positions: Json
          p_table_id: string
        }
        Returns: Json
      }
      search_reservations_fuzzy: {
        Args: {
          p_company_id: string
          p_customer_name: string
          p_date: string
          p_limit?: number
          p_similarity_threshold?: number
          p_time: string
          p_time_window_minutes?: number
        }
        Returns: {
          company_id: string
          created_at: string
          customer_name: string
          date: string
          email: string
          end_time: string
          id: string
          notes: string
          party_size: number
          phone: string
          similarity_score: number
          special_requests: string
          start_time: string
          status: string
          table_number: number
          table_numbers: number[]
          time: string
          updated_at: string
        }[]
      }
      secure_table_assignment_with_lock: {
        Args: {
          p_company_id: string
          p_date: string
          p_exclude_reservation_id?: string
          p_party_size: number
          p_table_numbers: number[]
          p_time: string
        }
        Returns: Json
      }
      secure_table_delete: {
        Args: { p_company_id?: string; p_table_id: string }
        Returns: boolean
      }
      secure_table_insert: {
        Args: {
          p_accessibility_friendly?: boolean
          p_ambiance?: string
          p_can_combine?: boolean
          p_description?: string
          p_features?: Json
          p_floor_level?: number
          p_group_priority?: number
          p_is_active?: boolean
          p_is_business_friendly?: boolean
          p_is_family_friendly?: boolean
          p_is_high_top?: boolean
          p_is_main_dining?: boolean
          p_is_outdoor?: boolean
          p_is_quiet_area?: boolean
          p_location?: string
          p_max_combine_size?: number
          p_privacy_level?: string
          p_rotation?: number
          p_seats: number
          p_service_status?: string
          p_shape?: string
          p_status?: string
          p_table_name?: string
          p_table_number: number
          p_type?: string
          p_vip_status?: boolean
          p_window_seating?: boolean
          p_x_position?: number
          p_y_position?: number
        }
        Returns: Json
      }
      secure_table_insert_v2: {
        Args: {
          p_accessibility_friendly?: boolean
          p_can_combine?: boolean
          p_description?: string
          p_is_business_friendly?: boolean
          p_is_family_friendly?: boolean
          p_is_high_top?: boolean
          p_is_main_dining?: boolean
          p_is_outdoor?: boolean
          p_is_quiet_area?: boolean
          p_privacy_level?: string
          p_seats: number
          p_service_status?: string
          p_shape?: string
          p_table_name?: string
          p_table_number: number
          p_type?: string
          p_vip_status?: boolean
          p_window_seating?: boolean
        }
        Returns: Json
      }
      secure_table_update:
        | {
            Args: {
              p_accessibility_friendly?: boolean
              p_ambiance?: string
              p_can_combine?: boolean
              p_description?: string
              p_features?: Json
              p_floor_level?: number
              p_group_priority?: number
              p_is_active?: boolean
              p_is_business_friendly?: boolean
              p_is_family_friendly?: boolean
              p_is_high_top?: boolean
              p_is_main_dining?: boolean
              p_is_outdoor?: boolean
              p_is_quiet_area?: boolean
              p_location?: string
              p_max_combine_size?: number
              p_privacy_level?: string
              p_rotation?: number
              p_seats?: number
              p_service_status?: string
              p_shape?: string
              p_status?: string
              p_table_id: string
              p_table_name?: string
              p_table_number?: number
              p_type?: string
              p_vip_status?: boolean
              p_window_seating?: boolean
              p_x_position?: number
              p_y_position?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_accessibility_friendly?: boolean
              p_can_combine?: boolean
              p_description?: string
              p_floor_level?: number
              p_is_business_friendly?: boolean
              p_is_family_friendly?: boolean
              p_is_high_top?: boolean
              p_is_main_dining?: boolean
              p_is_outdoor?: boolean
              p_is_quiet_area?: boolean
              p_privacy_level?: string
              p_rotation?: number
              p_seats?: number
              p_service_status?: string
              p_shape?: string
              p_table_id: string
              p_table_name?: string
              p_table_number?: number
              p_type?: string
              p_vip_status?: boolean
              p_window_seating?: boolean
              p_x_position?: number
              p_y_position?: number
            }
            Returns: Json
          }
      secure_table_update_v2: {
        Args: {
          p_accessibility_friendly?: boolean
          p_can_combine?: boolean
          p_description?: string
          p_is_business_friendly?: boolean
          p_is_family_friendly?: boolean
          p_is_high_top?: boolean
          p_is_main_dining?: boolean
          p_is_outdoor?: boolean
          p_is_quiet_area?: boolean
          p_privacy_level?: string
          p_seats?: number
          p_service_status?: string
          p_shape?: string
          p_table_id: string
          p_table_name?: string
          p_table_number?: number
          p_type?: string
          p_vip_status?: boolean
          p_window_seating?: boolean
        }
        Returns: Json
      }
      secure_tables_list: {
        Args: { p_company_id: string }
        Returns: {
          accessibility_friendly: boolean
          ambiance: string
          can_combine: boolean
          company_id: string
          created_at: string
          description: string
          features: Json
          group_priority: number
          id: string
          is_active: boolean
          is_business_friendly: boolean
          is_family_friendly: boolean
          is_high_top: boolean
          is_main_dining: boolean
          is_outdoor: boolean
          is_quiet_area: boolean
          location: string
          max_combine_size: number
          privacy_level: string
          seats: number
          service_status: string
          shape: string
          status: string
          table_name: string
          table_number: number
          type: string
          vip_status: boolean
          window_seating: boolean
        }[]
      }
      select_contiguous_group_tables:
        | {
            Args: {
              p_company_id: string
              p_group_id: string
              p_party_size: number
            }
            Returns: {
              is_contiguous: boolean
              reason: string
              selected_tables: Json
              total_capacity: number
            }[]
          }
        | {
            Args: {
              p_company_id: string
              p_group_id: string
              p_party_size: number
            }
            Returns: {
              efficiency_score: number
              is_contiguous: boolean
              selected_tables: number[]
              total_capacity: number
            }[]
          }
        | {
            Args: { p_company_id: string; p_party_size: number }
            Returns: {
              group_id: string
              table_numbers: number[]
              total_seats: number
            }[]
          }
      select_optimal_group_tables: {
        Args: { p_company_id: string; p_group_id: string; p_party_size: number }
        Returns: Json
      }
      set_owner_pin_secure: {
        Args: { p_company_id: string; p_new_pin: string }
        Returns: Json
      }
      should_run_optimization: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      smart_table_auto_assignment: {
        Args: {
          p_accessibility_needed?: boolean
          p_company_id: string
          p_date: string
          p_party_size: number
          p_time: string
        }
        Returns: Json
      }
      soft_delete_company_user: {
        Args: { user_id_param: string }
        Returns: Json
      }
      soft_delete_user: { Args: { user_id_param: string }; Returns: Json }
      suggest_alternative_tables: {
        Args: {
          p_accessibility_needed?: boolean
          p_company_id: string
          p_date: string
          p_party_size: number
          p_time: string
        }
        Returns: {
          accessibility_friendly: boolean
          seats: number
          table_number: number
        }[]
      }
      trigger_manual_optimization: {
        Args: { p_company_id: string }
        Returns: Json
      }
      update_company_admin_credentials: {
        Args: {
          p_company_id: string
          p_new_email: string
          p_new_password?: string
        }
        Returns: Json
      }
      update_company_assignment_settings_by_owner: {
        Args: {
          p_auto_assign: boolean
          p_company_id: string
          p_optimization_enabled: boolean
          p_optimization_mode?: string
          p_owner_pin: string
        }
        Returns: Json
      }
      update_company_feature_secure: {
        Args: {
          p_company_id: string
          p_enabled: boolean
          p_expires_at?: string
          p_feature_name: string
        }
        Returns: Json
      }
      update_company_name: {
        Args: { p_company_id: string; p_new_name: string }
        Returns: Json
      }
      update_optimization_timestamp: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      update_owner_pin_secure: {
        Args: { p_company_id: string; p_current_pin: string; p_new_pin: string }
        Returns: Json
      }
      update_super_admin_user_id: {
        Args: { admin_email: string; auth_user_id: string }
        Returns: Json
      }
      update_user_password: {
        Args: { new_password: string; user_email: string }
        Returns: Json
      }
      update_user_pin: {
        Args: { p_new_pin: string; p_user_id: string }
        Returns: Json
      }
      update_user_pin_with_permissions: {
        Args: {
          p_new_pin: string
          p_owner_pin?: string
          p_target_user_id: string
        }
        Returns: Json
      }
      update_user_role: {
        Args: {
          p_new_role: string
          p_owner_pin?: string
          p_target_user_id: string
        }
        Returns: Json
      }
      validate_company_access: {
        Args: { p_auth_user_id: string; p_company_id: string }
        Returns: boolean
      }
      validate_reservation_company_access: {
        Args: { p_expected_company_id: string; p_reservation_id: string }
        Returns: boolean
      }
      validate_super_admin_session: { Args: never; Returns: Json }
      validate_table_company_access: {
        Args: { p_expected_company_id: string; p_table_id: string }
        Returns: boolean
      }
    }
    Enums: {
      access_level: "staff" | "manager" | "admin"
      permission_type: "no_access" | "view" | "growth" | "edit" | "admin"
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
      access_level: ["staff", "manager", "admin"],
      permission_type: ["no_access", "view", "growth", "edit", "admin"],
    },
  },
} as const
