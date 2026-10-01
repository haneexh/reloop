export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PartnerType = "repair" | "ngo" | "recycler" | "refurbisher" | "informal";
export type RecommendedAction = "repair" | "reuse" | "donate" | "refurbish" | "recycle";
export type ItemCondition =
  "functional" | "cosmetic_damage" | "partially_working" | "severely_damaged" | string;

export interface Database {
  public: {
    Tables: {
      items: {
        Row: {
          id: string;
          image_url: string | null;
          item_type: string | null;
          brand: string | null;
          estimated_age_years: number | null;
          condition: string | null;
          repair_cost_est: number | null;
          resale_value_est: number | null;
          co2e_saved_est: number | null;
          waste_avoided_kg: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          image_url?: string | null;
          item_type?: string | null;
          brand?: string | null;
          estimated_age_years?: number | null;
          condition?: string | null;
          repair_cost_est?: number | null;
          resale_value_est?: number | null;
          co2e_saved_est?: number | null;
          waste_avoided_kg?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          image_url?: string | null;
          item_type?: string | null;
          brand?: string | null;
          estimated_age_years?: number | null;
          condition?: string | null;
          repair_cost_est?: number | null;
          resale_value_est?: number | null;
          co2e_saved_est?: number | null;
          waste_avoided_kg?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      partners: {
        Row: {
          id: string;
          name: string;
          partner_type: PartnerType;
          lat: number;
          lng: number;
          city: string;
          contact: string | null;
          verified: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          partner_type: PartnerType;
          lat: number;
          lng: number;
          city: string;
          contact?: string | null;
          verified?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          partner_type?: PartnerType;
          lat?: number;
          lng?: number;
          city?: string;
          contact?: string | null;
          verified?: boolean;
        };
        Relationships: [];
      };
      recommendations: {
        Row: {
          id: string;
          item_id: string;
          recommended_action: RecommendedAction;
          confidence: number | null;
          rationale: string | null;
          alt_action_1: string | null;
          alt_action_2: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          recommended_action: RecommendedAction;
          confidence?: number | null;
          rationale?: string | null;
          alt_action_1?: string | null;
          alt_action_2?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          recommended_action?: RecommendedAction;
          confidence?: number | null;
          rationale?: string | null;
          alt_action_1?: string | null;
          alt_action_2?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recommendations_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
