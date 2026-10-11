import { NextRequest } from "next/server";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory bucket store for IP-based rate limiting per edge/server process
const ipBuckets = new Map<string, RateLimitRecord>();

/**
 * Clean up old buckets periodically
 */
function cleanupBuckets() {
  const now = Date.now();
  Array.from(ipBuckets.entries()).forEach(([key, record]) => {
    if (now > record.resetAt) {
      ipBuckets.delete(key);
    }
  });
}

/**
 * Checks and increments rate limit for an IP
 * @param req Request
 * @param limit Max requests allowed in window
 * @param windowSecs Window duration in seconds
 */
export function checkRateLimit(
  req: NextRequest,
  limit = 60,
  windowSecs = 60
): { allowed: boolean; remaining: number; resetInSecs: number } {
  cleanupBuckets();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  const path = req.nextUrl.pathname;
  const bucketKey = `${ip}:${path}`;
  const now = Date.now();

  const record = ipBuckets.get(bucketKey);

  if (!record || now > record.resetAt) {
    ipBuckets.set(bucketKey, {
      count: 1,
      resetAt: now + windowSecs * 1000,
    });
    return { allowed: true, remaining: limit - 1, resetInSecs: windowSecs };
  }

  if (record.count >= limit) {
    const resetInSecs = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return { allowed: false, remaining: 0, resetInSecs };
  }

  record.count += 1;
  const resetInSecs = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
  return { allowed: true, remaining: limit - record.count, resetInSecs };
}
