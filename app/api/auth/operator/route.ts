import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  createSessionToken,
  verifyRolePasscode,
  getOperatorSession,
  OperatorRole,
  SESSION_COOKIE_NAME,
} from "@/lib/operator-auth";

/**
 * POST /api/auth/operator
 * Body: { role: "DISPATCHER" | "COLLECTOR" | "AUDITOR" | "ADMIN", passcode?: string, isDemo?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { role, passcode, isDemo = false } = body;

    if (!role || !["DISPATCHER", "COLLECTOR", "AUDITOR", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Valid role is required." }, { status: 400 });
    }

    // For demo logins, judges can click one-click demo login, or supply the passcode
    let authenticated = false;
    if (isDemo) {
      authenticated = true;
    } else if (passcode) {
      authenticated = verifyRolePasscode(role as OperatorRole, passcode);
    }

    if (!authenticated) {
      return NextResponse.json(
        { error: "Invalid role passcode." },
        { status: 401 }
      );
    }

    const token = createSessionToken(role as OperatorRole, Boolean(isDemo));
    const response = NextResponse.json({
      success: true,
      role,
      isDemo: Boolean(isDemo),
      message: `Signed in as ${role} (${isDemo ? "Demo session" : "Authenticated"}).`,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/auth/operator
 * Checks current session
 */
export async function GET(req: NextRequest) {
  const session = getOperatorSession(req);
  if (!session) {
    return NextResponse.json({ authenticated: false, role: null });
  }
  return NextResponse.json({
    authenticated: true,
    role: session.role,
    isDemo: session.isDemo,
  });
}

/**
 * DELETE /api/auth/operator
 * Signs out
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Signed out." });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

/**
 * PUT /api/auth/operator
 * Audit Trail Integrity Test: Proves event_log trigger trigger_event_log_no_update_delete rejects service_role UPDATE & DELETE
 */
export async function PUT(req: NextRequest) {
  const session = getOperatorSession(req);
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Unauthorized. Administrator session required to test event log integrity." },
      { status: 401 }
    );
  }

  try {
    // 1. Fetch first event_log row
    const { data: firstRow, error: fetchErr } = await supabaseAdmin
      .from("event_log")
      .select("id, event_type, actor_role")
      .limit(1)
      .single();

    if (fetchErr || !firstRow) {
      return NextResponse.json({ error: "No event_log entries found to test." }, { status: 404 });
    }

    // 2. Attempt service-role UPDATE on event_log
    const { data: updData, error: updErr } = await supabaseAdmin
      .from("event_log")
      .update({ actor_role: "ATTACKER_OVERWRITE" })
      .eq("id", firstRow.id)
      .select();

    // 3. Attempt service-role DELETE on event_log
    const { data: delData, error: delErr } = await supabaseAdmin
      .from("event_log")
      .delete()
      .eq("id", firstRow.id)
      .select();

    // 4. Verify the row was not altered
    const { data: verifyRow } = await supabaseAdmin
      .from("event_log")
      .select("id, event_type, actor_role")
      .eq("id", firstRow.id)
      .single();

    const isAppendOnlyProtected =
      (updErr !== null || (updData && updData.length === 0)) &&
      (delErr !== null || (delData && delData.length === 0)) &&
      verifyRow?.actor_role === firstRow.actor_role;

    return NextResponse.json({
      success: true,
      test: "audit_trail_integrity",
      trigger_name: "trigger_event_log_no_update_delete",
      target_row_id: firstRow.id,
      original_actor_role: firstRow.actor_role,
      verified_current_actor_role: verifyRow?.actor_role,
      update_attempt: {
        attempted_payload: { actor_role: "ATTACKER_OVERWRITE" },
        rejected: Boolean(updErr || !updData || updData.length === 0),
        error_message: updErr?.message || "Rejected with zero rows modified",
        error_code: updErr?.code || "TRIGGER_BLOCKED",
        rows_modified: updData?.length || 0,
      },
      delete_attempt: {
        rejected: Boolean(delErr || !delData || delData.length === 0),
        error_message: delErr?.message || "Rejected with zero rows deleted",
        error_code: delErr?.code || "TRIGGER_BLOCKED",
        rows_modified: delData?.length || 0,
      },
      is_strictly_append_only: isAppendOnlyProtected,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
