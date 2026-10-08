import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { mapPartnerToFacility } from "@/lib/recovery-engine";

export async function GET() {
  try {
    const { data: partners, error } = await supabase
      .from("partners")
      .select("id, name, partner_type, city, lat, lng, contact, verified")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching recovery facilities:", error);
      return NextResponse.json(
        { error: "Failed to retrieve recovery facilities." },
        { status: 500 }
      );
    }

    const facilities = (partners || []).map(mapPartnerToFacility);

    return NextResponse.json({
      success: true,
      data: facilities,
      total_count: facilities.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
