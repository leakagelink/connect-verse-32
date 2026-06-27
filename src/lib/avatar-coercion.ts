// Runtime coercion helpers for profile avatar fields. Extracted so that
// account.functions.ts (server-only) can stay thin and these pure helpers
// can be unit-tested without pulling in server middleware.
import { AI_AVATAR_STYLES, pickDefaultStyle } from "@/lib/ai-avatar";

const VALID_STYLES = new Set(AI_AVATAR_STYLES.map((s) => s.id));
const VALID_GENDERS = new Set(["male", "female", "other"]);

/** Coerce any DB value into a known DiceBear style id, falling back by gender. */
export function safeAvatarStyle(value: unknown, gender: string | null): string {
  if (typeof value === "string" && VALID_STYLES.has(value)) return value;
  return pickDefaultStyle(gender);
}

/** Coerce any DB value into a known gender bucket; unknowns become null. */
export function safeGender(value: unknown): string | null {
  if (typeof value === "string" && VALID_GENDERS.has(value)) return value;
  return null;
}
