export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string | null
          personalization: Json | null
          product_id: string | null
          quantity: number
          unit_price: number
          variant_id: string | null
          variant_label: string | null
        }
        Insert: {
          id?: string
          order_id?: string | null
          personalization?: Json | null
          product_id?: string | null
          quantity: number
          unit_price: number
          variant_id?: string | null
          variant_label?: string | null
        }
        Update: {
          id?: string
          order_id?: string | null
          personalization?: Json | null
          product_id?: string | null
          quantity?: number
          unit_price?: number
          variant_id?: string | null
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string
          id: string
          payment_status: string
          personalization_fee: number
          planner_id: string | null
          shipping_address: Json
          shipping_fee: number
          status: string
          subtotal: number
          tax: number
          total: number
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name: string
          id?: string
          payment_status?: string
          personalization_fee?: number
          planner_id?: string | null
          shipping_address: Json
          shipping_fee?: number
          status?: string
          subtotal: number
          tax?: number
          total: number
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          id?: string
          payment_status?: string
          personalization_fee?: number
          planner_id?: string | null
          shipping_address?: Json
          shipping_fee?: number
          status?: string
          subtotal?: number
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_planner_id_fkey"
            columns: ["planner_id"]
            isOneToOne: false
            referencedRelation: "planners"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_products: {
        Row: {
          enabled: boolean
          id: string
          markup_pct: number
          planner_id: string | null
          product_id: string | null
        }
        Insert: {
          enabled?: boolean
          id?: string
          markup_pct?: number
          planner_id?: string | null
          product_id?: string | null
        }
        Update: {
          enabled?: boolean
          id?: string
          markup_pct?: number
          planner_id?: string | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planner_products_planner_id_fkey"
            columns: ["planner_id"]
            isOneToOne: false
            referencedRelation: "planners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      planners: {
        Row: {
          accent_color: string
          business_name: string
          created_at: string
          default_markup_pct: number
          id: string
          initials: string | null
          logo_url: string | null
          profile_id: string | null
          slug: string
          status: string
          tagline: string | null
          theme_dark: boolean
        }
        Insert: {
          accent_color?: string
          business_name: string
          created_at?: string
          default_markup_pct?: number
          id?: string
          initials?: string | null
          logo_url?: string | null
          profile_id?: string | null
          slug: string
          status?: string
          tagline?: string | null
          theme_dark?: boolean
        }
        Update: {
          accent_color?: string
          business_name?: string
          created_at?: string
          default_markup_pct?: number
          id?: string
          initials?: string | null
          logo_url?: string | null
          profile_id?: string | null
          slug?: string
          status?: string
          tagline?: string | null
          theme_dark?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "planners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          id: string
          product_id: string | null
          sort_order: number
          url: string
        }
        Insert: {
          id?: string
          product_id?: string | null
          sort_order?: number
          url: string
        }
        Update: {
          id?: string
          product_id?: string | null
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_print_techniques: {
        Row: {
          extra_price: number
          id: string
          is_default: boolean
          product_id: string | null
          technique: string
        }
        Insert: {
          extra_price?: number
          id?: string
          is_default?: boolean
          product_id?: string | null
          technique: string
        }
        Update: {
          extra_price?: number
          id?: string
          is_default?: boolean
          product_id?: string | null
          technique?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_print_techniques_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_print_zones: {
        Row: {
          height_mm: number | null
          height_pct: number
          id: string
          image_id: string | null
          label: string
          max_chars_per_line: number | null
          max_lines: number
          pos_x_pct: number
          pos_y_pct: number
          product_id: string | null
          width_mm: number | null
          width_pct: number
        }
        Insert: {
          height_mm?: number | null
          height_pct?: number
          id?: string
          image_id?: string | null
          label: string
          max_chars_per_line?: number | null
          max_lines?: number
          pos_x_pct?: number
          pos_y_pct?: number
          product_id?: string | null
          width_mm?: number | null
          width_pct?: number
        }
        Update: {
          height_mm?: number | null
          height_pct?: number
          id?: string
          image_id?: string | null
          label?: string
          max_chars_per_line?: number | null
          max_lines?: number
          pos_x_pct?: number
          pos_y_pct?: number
          product_id?: string | null
          width_mm?: number | null
          width_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_print_zones_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "product_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_print_zones_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          label: string
          price_delta: number
          product_id: string | null
          sku: string | null
          sort_order: number
          stock_on_hand: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          label: string
          price_delta?: number
          product_id?: string | null
          sku?: string | null
          sort_order?: number
          stock_on_hand?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          label?: string
          price_delta?: number
          product_id?: string | null
          sku?: string | null
          sort_order?: number
          stock_on_hand?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          factory_price: number
          id: string
          lead_time_days_max: number
          lead_time_days_min: number
          min_order: number
          name: string
          personalizable: boolean
          reviewer_note: string | null
          sku: string | null
          slug: string
          status: string
          stock_on_hand: number
          supplier_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          factory_price: number
          id?: string
          lead_time_days_max?: number
          lead_time_days_min?: number
          min_order?: number
          name: string
          personalizable?: boolean
          reviewer_note?: string | null
          sku?: string | null
          slug: string
          status?: string
          stock_on_hand?: number
          supplier_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          factory_price?: number
          id?: string
          lead_time_days_max?: number
          lead_time_days_min?: number
          min_order?: number
          name?: string
          personalizable?: boolean
          reviewer_note?: string | null
          sku?: string | null
          slug?: string
          status?: string
          stock_on_hand?: number
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string
          role_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role: string
          role_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_option_items: {
        Row: {
          id: string
          product_id: string | null
          proposal_option_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          product_id?: string | null
          proposal_option_id?: string | null
          quantity: number
          unit_price: number
        }
        Update: {
          id?: string
          product_id?: string | null
          proposal_option_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_option_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_option_items_proposal_option_id_fkey"
            columns: ["proposal_option_id"]
            isOneToOne: false
            referencedRelation: "proposal_options"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_options: {
        Row: {
          id: string
          label: string
          proposal_id: string | null
          sort_order: number
          tier: string
          total_price: number
        }
        Insert: {
          id?: string
          label: string
          proposal_id?: string | null
          sort_order?: number
          tier: string
          total_price: number
        }
        Update: {
          id?: string
          label?: string
          proposal_id?: string | null
          sort_order?: number
          tier?: string
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_options_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          budget: number
          created_at: string
          customer_email: string | null
          customer_name: string | null
          guest_count: number
          id: string
          planner_id: string | null
          style_preferences: string[]
        }
        Insert: {
          budget: number
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          guest_count: number
          id?: string
          planner_id?: string | null
          style_preferences?: string[]
        }
        Update: {
          budget?: number
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          guest_count?: number
          id?: string
          planner_id?: string | null
          style_preferences?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "proposals_planner_id_fkey"
            columns: ["planner_id"]
            isOneToOne: false
            referencedRelation: "planners"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_read: boolean
          can_write: boolean
          id: string
          role_id: string | null
          section: string
        }
        Insert: {
          can_read?: boolean
          can_write?: boolean
          id?: string
          role_id?: string | null
          section: string
        }
        Update: {
          can_read?: boolean
          can_write?: boolean
          id?: string
          role_id?: string | null
          section?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          business_name: string
          created_at: string
          id: string
          profile_id: string | null
          since_year: number | null
          slug: string
          status: string
        }
        Insert: {
          business_name: string
          created_at?: string
          id?: string
          profile_id?: string | null
          since_year?: number | null
          slug: string
          status?: string
        }
        Update: {
          business_name?: string
          created_at?: string
          id?: string
          profile_id?: string | null
          since_year?: number | null
          slug?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_role: { Args: never; Returns: string }
      has_backoffice_access: {
        Args: { p_mode?: string; p_section: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<
  TableName extends keyof (DefaultSchema["Tables"]),
> = DefaultSchema["Tables"][TableName] extends { Row: infer R } ? R : never

export type TablesInsert<
  TableName extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][TableName] extends { Insert: infer I } ? I : never
