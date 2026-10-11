import crypto from "crypto";
import type { NextRequest } from "next/server";

export type OperatorRole = "DISPATCHER" | "COLLECTOR" | "AUDITOR" | "ADMIN";

const SESSION_COOKIE_NAME = "reloop_operator_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "reloop-demo-secret-key-32-chars-long!";

export interface SessionPayload {
  role: OperatorRole;
  issuedAt: number;
  expiresAt: number;
  isDemo: boolean;
}

/**
 * Generate cryptographically random, at least 128-bit, URL-safe tracking token.
 * Example: RLP-c9f28a7b1e45d603a1b2c3d4e5f60718
 */
export function generateSecureTrackingToken(): string {
  // 16 bytes = 128 bits of cryptographic entropy
  const randomHex = crypto.randomBytes(16).toString("hex");
  return `RLP-${randomHex}`;
}

/**
 * Sign payload using HMAC-SHA256
 */
function signPayload(payloadStr: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payloadStr).digest("hex");
}

export function createSessionToken(role: OperatorRole, isDemo = false, maxAgeHours = 24): string {
  const now = Date.now();
  const payload: SessionPayload = {
    role,
    issuedAt: now,
    expiresAt: now + maxAgeHours * 60 * 60 * 1000,
    isDemo,
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(payloadStr);
  return `${payloadStr}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadStr, signature] = parts;
    const expectedSig = signPayload(payloadStr);
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    const payload: SessionPayload = JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf8"));
    if (Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Validates role passcodes stored in env vars with safe demo defaults
 */
export function verifyRolePasscode(role: OperatorRole, passcode: string): boolean {
  if (!passcode) return false;
  const expectedMap: Record<OperatorRole, string> = {
    DISPATCHER: process.env.DEMO_DISPATCHER_PASSCODE || "DISPATCH-2026",
    COLLECTOR: process.env.DEMO_COLLECTOR_PASSCODE || "COLLECT-2026",
    AUDITOR: process.env.DEMO_AUDITOR_PASSCODE || "AUDIT-2026",
    ADMIN: process.env.DEMO_ADMIN_PASSCODE || "ADMIN-2026",
  };
  const expected = expectedMap[role];
  if (!expected) return false;
  return passcode.trim() === expected.trim();
}

/**
 * Extract active session from request cookies or headers
 */
export function getOperatorSession(req: NextRequest): SessionPayload | null {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie) {
    const verified = verifySessionToken(cookie);
    if (verified) return verified;
  }

  // Check Bearer authorization header if provided
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const verified = verifySessionToken(token);
    if (verified) return verified;
  }

  return null;
}

/**
 * Enforces role authorization for route handlers. Returns null if allowed, or NextResponse with error.
 */
export function enforceOperatorRole(
  req: NextRequest,
  allowedRoles: OperatorRole[]
): { session: SessionPayload } | { errorResponse: Response } {
  const session = getOperatorSession(req);
  if (!session) {
    return {
      errorResponse: Response.json(
        {
          error: "Unauthorized: Operator authentication required. Please sign in via the demo role bar.",
          code: "UNAUTHORIZED_OPERATOR",
        },
        { status: 401 }
      ),
    };
  }

  if (session.role !== "ADMIN" && !allowedRoles.includes(session.role)) {
    return {
      errorResponse: Response.json(
        {
          error: `Forbidden: Role '${session.role}' is not authorized for this operational action. Required: ${allowedRoles.join(" or ")}.`,
          code: "FORBIDDEN_ROLE",
        },
        { status: 403 }
      ),
    };
  }

  return { session };
}

export { SESSION_COOKIE_NAME };
