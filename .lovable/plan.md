
# ConnectVerse — Phase 1 Build Plan

Aap ne bahut bada vision diya hai (chat, voice, video, live rooms, games, KYC, withdrawals, AI moderation, etc.). Ek hi turn me sab production-ready banana realistic nahi hai. Isliye main isse phases me banaunga. Ye plan **Phase 1 (MVP)** ke liye hai — jo aap ne select kiya.

## Platform recommendation

**Web app first + Capacitor wrap for Android (Play Store).**
- Lovable React/TanStack Start web banata hai.
- Same codebase ko Capacitor se Android APK/AAB me wrap karke Play Store par publish kar sakte hain.
- Play Store policy ke liye: digital coins ki real-money recharge **Google Play Billing** se hi honi chahiye Android par (Razorpay sirf web par allowed). Isliye Phase 1 me **mock recharge** se start karna sahi hai — payment provider Phase 3 me final karenge based on launch surface.

## Phase 1 scope (is plan ka deliverable)

### 1. Backend (Lovable Cloud / Supabase)
- Enable Lovable Cloud.
- Tables:
  - `profiles` — id (auth.users FK), username, gender, dob, country, language, avatar_url, role (`user` | `creator` | `admin`), is_banned, ban_reason, free_seconds_remaining (default 300), created_at.
  - `user_roles` — separate roles table (security best practice) with `app_role` enum (`admin`, `moderator`, `user`, `creator`) + `has_role()` SECURITY DEFINER function.
  - `wallets` — user_id, coin_balance, total_recharged, deposit_count.
  - `coin_plans` — id, price_inr, coins, is_active. Seeded with ₹9 → ₹49999 plans.
  - `transactions` — id, user_id, type (`recharge` | `bonus` | `chat_spend` | `refund`), coins_delta, inr_amount, plan_id, metadata, created_at.
  - `conversations` — id, user_a, user_b, last_message_at.
  - `messages` — id, conversation_id, sender_id, body, created_at, is_deleted.
  - `chat_sessions` — id, conversation_id, started_at, ended_at, seconds_billed, coins_spent, used_free_seconds — drives per-minute billing.
  - `reports` — id, reporter_id, target_user_id, reason (enum), context (chat/profile/call), message_excerpt, status (`open` | `reviewed` | `actioned`), created_at.
  - `bans` — id, user_id, banned_by, reason, type (`temp` | `perm`), expires_at, created_at.
  - `community_guidelines_acceptance` — user_id, accepted_at, version.
- RLS on every table; policies scoped to `auth.uid()`. Admin policies via `has_role(auth.uid(), 'admin')`.
- Realtime enabled on `messages` and `chat_sessions`.
- Server functions (`createServerFn`) for:
  - `startChatSession` — validates other user not blocked/banned, opens session.
  - `tickChatBilling` — runs every ~30s from client, deducts coins or burns free seconds, ends session if balance 0.
  - `endChatSession` — finalizes billing.
  - `mockRecharge` — given plan_id, credits coins + applies 50/40/30% bonus based on `wallets.deposit_count`, increments counter.
  - `submitReport`, `adminBanUser`, `adminUnbanUser`, `adminListReports`.

### 2. Auth + onboarding
- Lovable Cloud Auth: Email/password + Google (via `lovable.auth.signInWithOAuth`).
- Signup flow:
  1. Email/Google sign-in.
  2. Profile setup: username, gender, DOB (must be 18+), country, language, avatar upload.
  3. **Mandatory** Community Guidelines + Terms checkbox.
  4. On profile creation trigger: insert wallet row with 0 coins, set `free_seconds_remaining = 300` (5 minutes).
- Auth-gated routes under `src/routes/_authenticated/`.

### 3. Coin wallet + mock recharge
- `/wallet` page: balance, free minutes remaining, transaction history tabs.
- `/recharge` page: grid of plan cards (₹9, ₹19, ₹29, ₹49, ₹99, ₹199, ₹299, ₹499, ₹999, ₹1999, ₹4999, ₹9999, ₹19999, ₹49999) with "MOCK" badge.
- Bonus banner shows current bonus % based on `deposit_count` (50% → 40% → 30% → 0%).
- Clicking plan calls `mockRecharge` server fn → instantly credits coins + bonus transaction.

### 4. Realtime chat with coin metering
- `/chat` page: conversations list + chat view.
- New chat: search/select another user (only verified, non-banned).
- Coin rate: e.g. **2 coins/minute** (configurable in `app_settings`).
- Flow:
  - Open chat → `startChatSession`.
  - Every 30s while window active, client calls `tickChatBilling`. Uses free seconds first, then coins.
  - If balance hits 0 → session ends, modal: "Out of coins, recharge to continue."
  - Visible timer + "coins remaining" indicator.
- Per-message actions: report, block, mute, delete.

### 5. Report + admin panel
- Report dialog on any user/message: reason dropdown (Harassment, Nudity, Fake Profile, Spam, Threat, Violence, Scam, Other) + optional note.
- `/_authenticated/_admin/*` layout gated by `has_role('admin')`:
  - **Dashboard** — counts: users, open reports, today's mock recharges, active chats.
  - **Users** — search, filter (banned/active/creator), row actions: view profile, ban (temp/perm), unban.
  - **Reports** — queue with reporter, target, reason, excerpt; actions: dismiss, warn, ban target.
  - **Transactions** — recharge + bonus + spend history with filters.
  - **Bans** — active bans list with unban action.
- Ban enforcement: middleware in `requireSupabaseAuth` checks `is_banned`; banned users see "Account suspended" screen with reason.

### 6. Safety baseline (Play Store friendly)
- 18+ DOB check at signup (hard block under-18).
- Mandatory Community Guidelines acceptance.
- Profanity filter on outgoing chat messages (basic word list — AI moderation in Phase 2).
- Block list per user.
- "Report & Block" button always 1 tap away in chat.
- No public photo galleries, no location sharing in Phase 1.
- App marketed as **social communication / creator community** — NOT dating, NOT escort, NOT adult.

### 7. UI/design system
- Modern, premium, dark-first with glassmorphism accents.
- Tailwind v4 semantic tokens in `src/styles.css` (no hardcoded colors in components).
- Smooth Framer Motion transitions on key screens.
- Fully responsive (mobile-first, since the goal is Android).

## Routes

```
/                          Landing (features, CTA to sign up)
/auth                      Sign in / sign up
/onboarding                Profile setup + guidelines
/home                      Discover users
/chat                      Conversations list
/chat/$conversationId      Active chat (metered)
/wallet                    Balance + history
/recharge                  Coin plans (mock)
/profile/$userId           Public profile + report
/settings                  Account, blocks, logout
/banned                    Suspended screen
/_authenticated/_admin/...  Admin panel
```

## Out of scope for Phase 1 (later phases)

- **Phase 2:** Agora SDK voice + video calling (coin metered), live rooms with mic seats.
- **Phase 3:** Real payments (Razorpay web + Google Play Billing Android), creator KYC, INR withdrawals.
- **Phase 4:** AI text/image moderation (Lovable AI Gateway), face verification, screenshot detection.
- **Phase 5:** Mini games (Ludo, Quiz, Tic Tac Toe), virtual gifts, VIP subscription.

## Open items for you to confirm before I start building

1. **App final name** — "ConnectVerse" placeholder ok, ya aap koi naam denge?
2. **Coin rate** for text chat — main default **2 coins / minute** rakh raha hu, theek hai?
3. **Coin → INR mapping** for plans — main default approx **1 coin = ₹0.10** rakhunga (₹9 = 90 coins, ₹49999 = ~5 lakh coins). Adjust karna ho to batayein.
4. **Apka admin email** — taaki main first signup ko admin role auto-assign kar saku (ya seed migration me directly daal du).

Confirm karte hi main build start kar dunga.
