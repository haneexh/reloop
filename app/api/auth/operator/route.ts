import { NextRequest, NextResponse } from "next/server";
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
