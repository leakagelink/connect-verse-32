export const APP_NAME = "ConnectVerse";
export const CHAT_COINS_PER_MINUTE = 2;
export const MESSAGE_COIN_COST_MALE = 1; // coins charged per text message from male senders (females free)
export const FREE_SECONDS_ON_SIGNUP = 300;
export const BONUS_TIERS = [0.5, 0.4, 0.3]; // 1st, 2nd, 3rd deposit
export const MIN_AGE = 18;
export const GUIDELINES_VERSION = "v1";

// Basic profanity / safety list (Phase 1 — AI moderation in Phase 2)
export const BLOCKED_WORDS = [
  "fuck", "shit", "bitch", "asshole", "cunt", "dick", "pussy",
  "rape", "kill yourself", "kys", "nigger", "faggot",
  "whatsapp", "telegram", "instagram", "snapchat", // off-platform handoff
];

export function containsBlockedContent(text: string): string | null {
  const lower = text.toLowerCase();
  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word)) return word;
  }
  return null;
}

export function bonusForDeposit(depositCount: number): number {
  return BONUS_TIERS[depositCount] ?? 0;
}
