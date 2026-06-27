// AI Avatar helper — deterministic, no-API-key fallback avatars for users
// who haven't uploaded a profile photo. Uses DiceBear's open SVG service.
// Deterministic seed (user id) means every viewer sees the same avatar
// for the same user, and the image is cacheable + free.

export const DICEBEAR_BASE = "https://api.dicebear.com/9.x";

// Curated set of AI avatar styles users can pick from in Settings.
// Each entry is { id (DiceBear style), label, sample seed for preview }.
export const AI_AVATAR_STYLES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "avataaars", label: "Cartoon" },
  { id: "adventurer", label: "Adventurer" },
  { id: "lorelei", label: "Lorelei" },
  { id: "micah", label: "Micah" },
  { id: "notionists", label: "Notion" },
  { id: "personas", label: "Personas" },
  { id: "fun-emoji", label: "Fun Emoji" },
  { id: "bottts", label: "Robot" },
  { id: "thumbs", label: "Thumbs" },
  { id: "pixel-art", label: "Pixel" },
  { id: "shapes", label: "Shapes" },
  { id: "initials", label: "Initials" },
];

const STYLE_IDS = new Set(AI_AVATAR_STYLES.map((s) => s.id));

const DEFAULT_STYLE_BY_GENDER: Record<string, string> = {
  female: "lorelei",
  male: "avataaars",
  other: "personas",
};

export function pickDefaultStyle(gender?: string | null): string {
  if (gender && DEFAULT_STYLE_BY_GENDER[gender]) return DEFAULT_STYLE_BY_GENDER[gender];
  return "avataaars";
}

export function aiAvatarUrl(seed: string, style?: string | null, gender?: string | null): string {
  const safeStyle = style && STYLE_IDS.has(style) ? style : pickDefaultStyle(gender);
  const safeSeed = encodeURIComponent(seed || "talkora");
  // backgroundType=gradientLinear gives a nicer pop in dark UI; harmless if style ignores it.
  return `${DICEBEAR_BASE}/${safeStyle}/svg?seed=${safeSeed}&radius=50&backgroundType=gradientLinear`;
}

// Server-side helper: backfill `avatar_url` on a profile-like row when the
// user hasn't uploaded a photo. Safe to use on arrays of profiles too.
export function withAiAvatar<T extends {
  id?: string | null;
  avatar_url?: string | null;
  ai_avatar_style?: string | null;
  gender?: string | null;
} | null | undefined>(row: T): T {
  if (!row) return row;
  if (row.avatar_url) return row;
  if (!row.id) return row;
  return {
    ...row,
    avatar_url: aiAvatarUrl(row.id, row.ai_avatar_style ?? null, row.gender ?? null),
  };
}

export function withAiAvatars<T extends {
  id?: string | null;
  avatar_url?: string | null;
  ai_avatar_style?: string | null;
  gender?: string | null;
}>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).map((r) => withAiAvatar(r) as T);
}
