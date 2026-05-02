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
      activities: {
        Row: {
          body: string | null
          company_id: string | null
          completed: boolean
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          due_date: string | null
          id: string
          subject: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          completed?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_date?: string | null
          id?: string
          subject?: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          body?: string | null
          company_id?: string | null
          completed?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_date?: string | null
          id?: string
          subject?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          archived: boolean
          billing_company_id: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          kennitala: string | null
          name: string
          notes: string | null
          payday_customer_id: string | null
          payment_terms_days: number
          phone: string | null
          postcode: string | null
          preferred_currency: string
          updated_at: string
          vsk_number: string | null
          vsk_status: Database["public"]["Enums"]["vsk_status"]
          website: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          archived?: boolean
          billing_company_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          kennitala?: string | null
          name: string
          notes?: string | null
          payday_customer_id?: string | null
          payment_terms_days?: number
          phone?: string | null
          postcode?: string | null
          preferred_currency?: string
          updated_at?: string
          vsk_number?: string | null
          vsk_status?: Database["public"]["Enums"]["vsk_status"]
          website?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          archived?: boolean
          billing_company_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          kennitala?: string | null
          name?: string
          notes?: string | null
          payday_customer_id?: string | null
          payment_terms_days?: number
          phone?: string | null
          postcode?: string | null
          preferred_currency?: string
          updated_at?: string
          vsk_number?: string | null
          vsk_status?: Database["public"]["Enums"]["vsk_status"]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_billing_company_id_fkey"
            columns: ["billing_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_files: {
        Row: {
          company_id: string
          file_size_bytes: number | null
          file_type: string
          id: string
          original_filename: string | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          file_size_bytes?: number | null
          file_type?: string
          id?: string
          original_filename?: string | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          file_size_bytes?: number | null
          file_type?: string
          id?: string
          original_filename?: string | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_primary: boolean
          last_name: string | null
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_primary?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_primary?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_files: {
        Row: {
          deal_id: string
          file_size_bytes: number | null
          file_type: string
          id: string
          original_filename: string | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          deal_id: string
          file_size_bytes?: number | null
          file_type?: string
          id?: string
          original_filename?: string | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          deal_id?: string
          file_size_bytes?: number | null
          file_type?: string
          id?: string
          original_filename?: string | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_files_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_lines: {
        Row: {
          cost_currency: string
          created_at: string
          deal_id: string
          description: string | null
          exchange_rate: number
          id: string
          line_cost_isk: number
          line_margin_isk: number
          line_order: number
          line_total_isk: number
          markup_pct: number
          notes: string | null
          product_name: string
          product_supplier_sku: string | null
          quantity: number
          size_breakdown: Json | null
          unit_cost: number
          unit_cost_isk: number
          unit_price_isk: number
          updated_at: string
        }
        Insert: {
          cost_currency?: string
          created_at?: string
          deal_id: string
          description?: string | null
          exchange_rate?: number
          id?: string
          line_cost_isk?: number
          line_margin_isk?: number
          line_order?: number
          line_total_isk?: number
          markup_pct?: number
          notes?: string | null
          product_name: string
          product_supplier_sku?: string | null
          quantity?: number
          size_breakdown?: Json | null
          unit_cost?: number
          unit_cost_isk?: number
          unit_price_isk?: number
          updated_at?: string
        }
        Update: {
          cost_currency?: string
          created_at?: string
          deal_id?: string
          description?: string | null
          exchange_rate?: number
          id?: string
          line_cost_isk?: number
          line_margin_isk?: number
          line_order?: number
          line_total_isk?: number
          markup_pct?: number
          notes?: string | null
          product_name?: string
          product_supplier_sku?: string | null
          quantity?: number
          size_breakdown?: Json | null
          unit_cost?: number
          unit_cost_isk?: number
          unit_price_isk?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_lines_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          actual_close_date: string | null
          amount_invoiced_isk: number | null
          amount_invoiced_with_vsk_isk: number | null
          amount_isk: number | null
          amount_paid_isk: number | null
          archived: boolean
          company_id: string
          contact_id: string | null
          created_at: string
          default_markup_pct: number
          defect_description: string | null
          defect_resolution: Database["public"]["Enums"]["defect_resolution"]
          delivered_at: string | null
          estimated_delivery_date: string | null
          id: string
          invoice_date: string | null
          invoice_status: Database["public"]["Enums"]["invoice_status"]
          margin_isk: number | null
          name: string
          notes: string | null
          owner_id: string | null
          paid_at: string | null
          parent_deal_id: string | null
          payday_currency_code: string | null
          payday_foreign_amount_excl_vsk: number | null
          payday_foreign_amount_incl_vsk: number | null
          payday_invoice_id: string | null
          payday_invoice_number: string | null
          payday_synced_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          promised_delivery_date: string | null
          refund_amount_isk: number | null
          shipping_cost_isk: number
          so_number: string
          stage: Database["public"]["Enums"]["deal_stage"]
          total_cost_isk: number
          total_margin_isk: number
          total_price_isk: number
          tracking_numbers: string[]
          updated_at: string
        }
        Insert: {
          actual_close_date?: string | null
          amount_invoiced_isk?: number | null
          amount_invoiced_with_vsk_isk?: number | null
          amount_isk?: number | null
          amount_paid_isk?: number | null
          archived?: boolean
          company_id: string
          contact_id?: string | null
          created_at?: string
          default_markup_pct?: number
          defect_description?: string | null
          defect_resolution?: Database["public"]["Enums"]["defect_resolution"]
          delivered_at?: string | null
          estimated_delivery_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"]
          margin_isk?: number | null
          name: string
          notes?: string | null
          owner_id?: string | null
          paid_at?: string | null
          parent_deal_id?: string | null
          payday_currency_code?: string | null
          payday_foreign_amount_excl_vsk?: number | null
          payday_foreign_amount_incl_vsk?: number | null
          payday_invoice_id?: string | null
          payday_invoice_number?: string | null
          payday_synced_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          promised_delivery_date?: string | null
          refund_amount_isk?: number | null
          shipping_cost_isk?: number
          so_number?: string
          stage?: Database["public"]["Enums"]["deal_stage"]
          total_cost_isk?: number
          total_margin_isk?: number
          total_price_isk?: number
          tracking_numbers?: string[]
          updated_at?: string
        }
        Update: {
          actual_close_date?: string | null
          amount_invoiced_isk?: number | null
          amount_invoiced_with_vsk_isk?: number | null
          amount_isk?: number | null
          amount_paid_isk?: number | null
          archived?: boolean
          company_id?: string
          contact_id?: string | null
          created_at?: string
          default_markup_pct?: number
          defect_description?: string | null
          defect_resolution?: Database["public"]["Enums"]["defect_resolution"]
          delivered_at?: string | null
          estimated_delivery_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"]
          margin_isk?: number | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          paid_at?: string | null
          parent_deal_id?: string | null
          payday_currency_code?: string | null
          payday_foreign_amount_excl_vsk?: number | null
          payday_foreign_amount_incl_vsk?: number | null
          payday_invoice_id?: string | null
          payday_invoice_number?: string | null
          payday_synced_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          promised_delivery_date?: string | null
          refund_amount_isk?: number | null
          shipping_cost_isk?: number
          so_number?: string
          stage?: Database["public"]["Enums"]["deal_stage"]
          total_cost_isk?: number
          total_margin_isk?: number
          total_price_isk?: number
          tracking_numbers?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_parent_deal_id_fkey"
            columns: ["parent_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      decoration_specs: {
        Row: {
          created_at: string
          design_id: string
          id: string
          max_colors: number | null
          notes: string | null
          pantone_colors: string[]
          placement: string | null
          product_category: string | null
          product_id: string | null
          size_mm_h: number | null
          size_mm_w: number | null
          technique: Database["public"]["Enums"]["decoration_technique"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          design_id: string
          id?: string
          max_colors?: number | null
          notes?: string | null
          pantone_colors?: string[]
          placement?: string | null
          product_category?: string | null
          product_id?: string | null
          size_mm_h?: number | null
          size_mm_w?: number | null
          technique: Database["public"]["Enums"]["decoration_technique"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          design_id?: string
          id?: string
          max_colors?: number | null
          notes?: string | null
          pantone_colors?: string[]
          placement?: string | null
          product_category?: string | null
          product_id?: string | null
          size_mm_h?: number | null
          size_mm_w?: number | null
          technique?: Database["public"]["Enums"]["decoration_technique"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decoration_specs_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decoration_specs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      designs: {
        Row: {
          archived: boolean
          artwork_file_path: string | null
          company_id: string
          created_at: string
          created_by: string | null
          first_used_deal_id: string | null
          id: string
          name: string
          notes: string | null
          tags: string[]
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          artwork_file_path?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          first_used_deal_id?: string | null
          id?: string
          name: string
          notes?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          artwork_file_path?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          first_used_deal_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "designs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designs_first_used_deal_id_fkey"
            columns: ["first_used_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      payday_auth: {
        Row: {
          access_token: string
          expires_at: string
          id: number
          updated_at: string
        }
        Insert: {
          access_token: string
          expires_at: string
          id?: number
          updated_at?: string
        }
        Update: {
          access_token?: string
          expires_at?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      po_files: {
        Row: {
          file_size_bytes: number | null
          file_type: string
          file_url: string | null
          id: string
          original_filename: string | null
          po_id: string
          storage_path: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_size_bytes?: number | null
          file_type?: string
          file_url?: string | null
          id?: string
          original_filename?: string | null
          po_id: string
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_size_bytes?: number | null
          file_type?: string
          file_url?: string | null
          id?: string
          original_filename?: string | null
          po_id?: string
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_files_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      po_lines: {
        Row: {
          decoration_spec_id: string | null
          description: string
          id: string
          line_order: number
          line_total: number | null
          linked_quote_line_id: string | null
          purchase_order_id: string
          quantity: number
          supplier_sku: string | null
          unit_cost: number
        }
        Insert: {
          decoration_spec_id?: string | null
          description: string
          id?: string
          line_order?: number
          line_total?: number | null
          linked_quote_line_id?: string | null
          purchase_order_id: string
          quantity?: number
          supplier_sku?: string | null
          unit_cost?: number
        }
        Update: {
          decoration_spec_id?: string | null
          description?: string
          id?: string
          line_order?: number
          line_total?: number | null
          linked_quote_line_id?: string | null
          purchase_order_id?: string
          quantity?: number
          supplier_sku?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "po_lines_decoration_spec_id_fkey"
            columns: ["decoration_spec_id"]
            isOneToOne: false
            referencedRelation: "decoration_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_lines_linked_quote_line_id_fkey"
            columns: ["linked_quote_line_id"]
            isOneToOne: false
            referencedRelation: "quote_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          archived: boolean
          category: string | null
          cost_currency: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          min_quantity: number
          name: string
          supplier: string
          supplier_id: string | null
          supplier_sku: string
          tags: string[]
          unit_cost: number | null
          unit_price_isk: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived?: boolean
          category?: string | null
          cost_currency?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          min_quantity?: number
          name: string
          supplier?: string
          supplier_id?: string | null
          supplier_sku: string
          tags?: string[]
          unit_cost?: number | null
          unit_price_isk?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived?: boolean
          category?: string | null
          cost_currency?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          min_quantity?: number
          name?: string
          supplier?: string
          supplier_id?: string | null
          supplier_sku?: string
          tags?: string[]
          unit_cost?: number | null
          unit_price_isk?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          active: boolean
          created_at: string
          email: string
          id: string
          name: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          actual_delivery_date: string | null
          amount: number | null
          archived: boolean
          created_at: string
          currency: string
          deal_id: string
          delivered_to_customer_at: string | null
          delivered_to_customer_by: string | null
          exchange_rate: number | null
          expected_delivery_date: string | null
          id: string
          invoice_approved_at: string | null
          invoice_approved_by: string | null
          invoice_received_date: string | null
          invoice_registered_by: string | null
          notes: string | null
          order_date: string | null
          paid_date: string | null
          po_number: string
          proof_received_date: string | null
          proof_url: string | null
          received_date: string | null
          shipping_cost: number | null
          status: Database["public"]["Enums"]["po_status"]
          supplier: string
          supplier_id: string | null
          supplier_invoice_amount: number | null
          supplier_invoice_number: string | null
          supplier_reference: string | null
          tracking_numbers: string[]
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          amount?: number | null
          archived?: boolean
          created_at?: string
          currency?: string
          deal_id: string
          delivered_to_customer_at?: string | null
          delivered_to_customer_by?: string | null
          exchange_rate?: number | null
          expected_delivery_date?: string | null
          id?: string
          invoice_approved_at?: string | null
          invoice_approved_by?: string | null
          invoice_received_date?: string | null
          invoice_registered_by?: string | null
          notes?: string | null
          order_date?: string | null
          paid_date?: string | null
          po_number?: string
          proof_received_date?: string | null
          proof_url?: string | null
          received_date?: string | null
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier: string
          supplier_id?: string | null
          supplier_invoice_amount?: number | null
          supplier_invoice_number?: string | null
          supplier_reference?: string | null
          tracking_numbers?: string[]
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          amount?: number | null
          archived?: boolean
          created_at?: string
          currency?: string
          deal_id?: string
          delivered_to_customer_at?: string | null
          delivered_to_customer_by?: string | null
          exchange_rate?: number | null
          expected_delivery_date?: string | null
          id?: string
          invoice_approved_at?: string | null
          invoice_approved_by?: string | null
          invoice_received_date?: string | null
          invoice_registered_by?: string | null
          notes?: string | null
          order_date?: string | null
          paid_date?: string | null
          po_number?: string
          proof_received_date?: string | null
          proof_url?: string | null
          received_date?: string | null
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier?: string
          supplier_id?: string | null
          supplier_invoice_amount?: number | null
          supplier_invoice_number?: string | null
          supplier_reference?: string | null
          tracking_numbers?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_delivered_to_customer_by_fkey"
            columns: ["delivered_to_customer_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_invoice_approved_by_fkey"
            columns: ["invoice_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_invoice_registered_by_fkey"
            columns: ["invoice_registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_lines: {
        Row: {
          decoration_spec_id: string | null
          description: string | null
          design_id: string | null
          id: string
          line_order: number
          line_total_isk: number | null
          product_name: string
          product_supplier_sku: string | null
          quantity: number
          quote_id: string
          unit_cost_eur: number | null
          unit_price_isk: number
          vsk_rate: number
        }
        Insert: {
          decoration_spec_id?: string | null
          description?: string | null
          design_id?: string | null
          id?: string
          line_order?: number
          line_total_isk?: number | null
          product_name: string
          product_supplier_sku?: string | null
          quantity?: number
          quote_id: string
          unit_cost_eur?: number | null
          unit_price_isk?: number
          vsk_rate?: number
        }
        Update: {
          decoration_spec_id?: string | null
          description?: string | null
          design_id?: string | null
          id?: string
          line_order?: number
          line_total_isk?: number | null
          product_name?: string
          product_supplier_sku?: string | null
          quantity?: number
          quote_id?: string
          unit_cost_eur?: number | null
          unit_price_isk?: number
          vsk_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_decoration_spec_id_fkey"
            columns: ["decoration_spec_id"]
            isOneToOne: false
            referencedRelation: "decoration_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          id: string
          pdf_url: string | null
          sent_at: string | null
          shipping_cost_isk: number
          status: Database["public"]["Enums"]["quote_status"]
          subtotal_isk: number
          terms: string | null
          total_isk: number
          updated_at: string
          valid_until: string | null
          vat_isk: number
          version: number
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          id?: string
          pdf_url?: string | null
          sent_at?: string | null
          shipping_cost_isk?: number
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal_isk?: number
          terms?: string | null
          total_isk?: number
          updated_at?: string
          valid_until?: string | null
          vat_isk?: number
          version?: number
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          id?: string
          pdf_url?: string | null
          sent_at?: string | null
          shipping_cost_isk?: number
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal_isk?: number
          terms?: string | null
          total_isk?: number
          updated_at?: string
          valid_until?: string | null
          vat_isk?: number
          version?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          archived: boolean
          contact_email: string | null
          created_at: string
          default_currency: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          active?: boolean
          archived?: boolean
          contact_email?: string | null
          created_at?: string
          default_currency?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          active?: boolean
          archived?: boolean
          contact_email?: string | null
          created_at?: string
          default_currency?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_sala_admin: { Args: never; Returns: boolean }
      is_sala_user: { Args: never; Returns: boolean }
      next_po_number: { Args: never; Returns: string }
      next_so_number: { Args: never; Returns: string }
    }
    Enums: {
      activity_type:
        | "note"
        | "call"
        | "email"
        | "meeting"
        | "task"
        | "defect_note"
        | "stage_change"
      deal_stage:
        | "inquiry"
        | "quote_in_progress"
        | "quote_sent"
        | "order_confirmed"
        | "ready_for_pickup"
        | "delivered"
        | "cancelled"
        | "defect_reorder"
      decoration_technique:
        | "screen_print"
        | "embroidery"
        | "pad_print"
        | "laser_engraving"
        | "digital_print"
        | "transfer"
        | "doming"
        | "sublimation"
        | "uv_print"
        | "other"
      defect_resolution:
        | "pending"
        | "reorder"
        | "refund"
        | "credit_note"
        | "resolved"
      invoice_status: "not_invoiced" | "full"
      payment_status: "unpaid" | "partial" | "paid"
      po_status: "ordered" | "received" | "invoiced" | "paid" | "cancelled"
      quote_status: "draft" | "sent" | "accepted" | "rejected" | "expired"
      user_role: "admin" | "sales" | "designer" | "viewer"
      vsk_status: "standard" | "reduced" | "export_exempt" | "none"
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
      activity_type: [
        "note",
        "call",
        "email",
        "meeting",
        "task",
        "defect_note",
        "stage_change",
      ],
      deal_stage: [
        "inquiry",
        "quote_in_progress",
        "quote_sent",
        "order_confirmed",
        "ready_for_pickup",
        "delivered",
        "cancelled",
        "defect_reorder",
      ],
      decoration_technique: [
        "screen_print",
        "embroidery",
        "pad_print",
        "laser_engraving",
        "digital_print",
        "transfer",
        "doming",
        "sublimation",
        "uv_print",
        "other",
      ],
      defect_resolution: [
        "pending",
        "reorder",
        "refund",
        "credit_note",
        "resolved",
      ],
      invoice_status: ["not_invoiced", "full"],
      payment_status: ["unpaid", "partial", "paid"],
      po_status: ["ordered", "received", "invoiced", "paid", "cancelled"],
      quote_status: ["draft", "sent", "accepted", "rejected", "expired"],
      user_role: ["admin", "sales", "designer", "viewer"],
      vsk_status: ["standard", "reduced", "export_exempt", "none"],
    },
  },
} as const
