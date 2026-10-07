export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PartnerType = "repair" | "ngo" | "recycler" | "refurbisher" | "informal";
export type RecommendedAction =
  | "repair"
  | "reuse"
  | "donate"
  | "resell"
  | "refurbish"
  | "recycle";
export type ItemCondition =
  | "functional"
  | "cosmetic_damage"
  | "partially_working"
  | "severely_damaged"
  | string;

export type CollectionRequestStatus =
  | "pending"
  | "scheduled"
  | "assigned"
  | "collected"
  | "weighed"
  | "sorted"
  | "sent_to_facility"
  | "recovered"
  | "cancelled";

export type CollectionRequestPriority = "low" | "normal" | "high" | "urgent";

export type VehicleType = "EV_VAN" | "CNG_TRUCK" | "MINI_TRUCK";

export type VehicleStatus = "available" | "assigned" | "in_route" | "maintenance" | "inactive";

export type RouteStatus = "planned" | "assigned" | "in_progress" | "completed" | "cancelled";

export type UserRole = "CITIZEN" | "DISPATCHER" | "COLLECTOR" | "FACILITY" | "ADMIN";

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
          request_id: string | null;
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
          request_id?: string | null;
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
          request_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "items_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "collection_requests";
            referencedColumns: ["id"];
          },
        ];
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
      collection_zones: {
        Row: {
          id: string;
          name: string;
          code: string;
          center_lat: number;
          center_lng: number;
          radius_km: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          center_lat: number;
          center_lng: number;
          radius_km: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          center_lat?: number;
          center_lng?: number;
          radius_km?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      collection_requests: {
        Row: {
          id: string;
          citizen_name: string | null;
          citizen_phone: string | null;
          address: string;
          zone_id: string | null;
          lat: number | null;
          lng: number | null;
          pickup_date: string | null;
          pickup_slot: string | null;
          status: CollectionRequestStatus;
          priority: CollectionRequestPriority;
          notes: string | null;
          qr_token: string | null;
          is_simulated: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          citizen_name?: string | null;
          citizen_phone?: string | null;
          address: string;
          zone_id?: string | null;
          lat?: number | null;
          lng?: number | null;
          pickup_date?: string | null;
          pickup_slot?: string | null;
          status?: CollectionRequestStatus;
          priority?: CollectionRequestPriority;
          notes?: string | null;
          qr_token?: string | null;
          is_simulated?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          citizen_name?: string | null;
          citizen_phone?: string | null;
          address?: string;
          zone_id?: string | null;
          lat?: number | null;
          lng?: number | null;
          pickup_date?: string | null;
          pickup_slot?: string | null;
          status?: CollectionRequestStatus;
          priority?: CollectionRequestPriority;
          notes?: string | null;
          qr_token?: string | null;
          is_simulated?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collection_requests_zone_id_fkey";
            columns: ["zone_id"];
            isOneToOne: false;
            referencedRelation: "collection_zones";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicles: {
        Row: {
          id: string;
          vehicle_code: string;
          capacity_kg: number;
          vehicle_type: VehicleType;
          status: VehicleStatus;
          depot_name: string | null;
          depot_lat: number | null;
          depot_lng: number | null;
          max_route_hours: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_code: string;
          capacity_kg: number;
          vehicle_type: VehicleType;
          status?: VehicleStatus;
          depot_name?: string | null;
          depot_lat?: number | null;
          depot_lng?: number | null;
          max_route_hours?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_code?: string;
          capacity_kg?: number;
          vehicle_type?: VehicleType;
          status?: VehicleStatus;
          depot_name?: string | null;
          depot_lat?: number | null;
          depot_lng?: number | null;
          max_route_hours?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      collection_routes: {
        Row: {
          id: string;
          vehicle_id: string | null;
          zone_id: string | null;
          route_date: string;
          status: RouteStatus;
          total_distance_km: number;
          total_load_kg: number;
          estimated_duration_minutes: number;
          stops_json: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id?: string | null;
          zone_id?: string | null;
          route_date: string;
          status?: RouteStatus;
          total_distance_km?: number;
          total_load_kg?: number;
          estimated_duration_minutes?: number;
          stops_json?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string | null;
          zone_id?: string | null;
          route_date?: string;
          status?: RouteStatus;
          total_distance_km?: number;
          total_load_kg?: number;
          estimated_duration_minutes?: number;
          stops_json?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collection_routes_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_routes_zone_id_fkey";
            columns: ["zone_id"];
            isOneToOne: false;
            referencedRelation: "collection_zones";
            referencedColumns: ["id"];
          },
        ];
      };
      collection_records: {
        Row: {
          id: string;
          request_id: string;
          route_id: string | null;
          collector_id: string | null;
          actual_weight_kg: number;
          verified_at: string;
          verification_method: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          route_id?: string | null;
          collector_id?: string | null;
          actual_weight_kg: number;
          verified_at?: string;
          verification_method?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          route_id?: string | null;
          collector_id?: string | null;
          actual_weight_kg?: number;
          verified_at?: string;
          verification_method?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collection_records_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "collection_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_records_route_id_fkey";
            columns: ["route_id"];
            isOneToOne: false;
            referencedRelation: "collection_routes";
            referencedColumns: ["id"];
          },
        ];
      };
      recovery_transfers: {
        Row: {
          id: string;
          facility_id: string | null;
          route_id: string | null;
          total_weight_kg: number;
          refurbished_pct: number;
          recycled_pct: number;
          residual_pct: number;
          transferred_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          facility_id?: string | null;
          route_id?: string | null;
          total_weight_kg: number;
          refurbished_pct?: number;
          recycled_pct?: number;
          residual_pct?: number;
          transferred_at?: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          facility_id?: string | null;
          route_id?: string | null;
          total_weight_kg?: number;
          refurbished_pct?: number;
          recycled_pct?: number;
          residual_pct?: number;
          transferred_at?: string;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recovery_transfers_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recovery_transfers_route_id_fkey";
            columns: ["route_id"];
            isOneToOne: false;
            referencedRelation: "collection_routes";
            referencedColumns: ["id"];
          },
        ];
      };
      event_log: {
        Row: {
          id: string;
          event_type: string;
          entity_type: string;
          entity_id: string;
          actor_role: string | null;
          payload_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          entity_type: string;
          entity_id: string;
          actor_role?: string | null;
          payload_json?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          entity_type?: string;
          entity_id?: string;
          actor_role?: string | null;
          payload_json?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Relationships: [];
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
