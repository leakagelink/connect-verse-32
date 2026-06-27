# Talkora Home Page Revamp — Plan

Total: **4 Phases**. Leaderboards skipped per your instruction. Har phase ek turn me ship hoga.

---

## Phase 13 — Home Foundation & Live Strip
**Goal:** Home page ka core skeleton + sabse high-impact section.

- **Sticky Free-Minutes Hero Banner** (countdown timer + "Use Now" auto-match CTA — improve current banner)
- **Live Online Creators Strip** — horizontal auto-scrolling rail
  - Real photo (if female + uploaded), AI avatar (males), green "Live" dot
  - Per-min coin rate badge (audio + video)
  - Tap = instant call routing
  - Realtime presence-based (already presence infra hai)
- **Quick Actions Grid** — 4 big tiles: Voice Call · Video Call · Mystery Game · Rooms
- **Recharge Offer Card** — only shown if user has pending 1st/2nd/3rd bonus

---

## Phase 14 — Matchmaker Audio Rooms (FRND-style)
**Goal:** Signature differentiator feature.

- New tables: `matchmaker_rooms`, `matchmaker_candidates`, `matchmaker_votes`
- Host (female creator) opens a room with 2 male "candidates" + N listeners
- Voting system: listeners vote which candidate wins the chat
- Gifts during the room boost candidate score
- Winner gets 1-on-1 private call with host
- Home section: **"🔥 Live Matchmaker Rooms"** with listener count badges
- Reuse Agora multi-host channel

---

## Phase 15 — Engagement Sections on Home
**Goal:** Repeat-visit hooks.

- **Daily Check-in Streak Strip** — visual 7-day ladder with flame icons (upgrade existing)
- **Trending Now** carousel:
  - Most-gifted creator (24h)
  - Hottest room
  - New joiners this hour
- **Fan Club Spotlight** — featured creator + "Join for X coins/month" CTA
- **Recently Played With** — quick re-connect tiles (from `call_logs`)
- **For You** — personalized creators filtered by language + state

---

## Phase 16 — Trust, Safety & Polish
**Goal:** Play Store + user confidence.

- **Trust badge strip** (bottom of home): "24×7 Moderated · Verified Creators · KYC Secured · 18+ Only"
- **SOS button** — floating subtle, accessible from home
- **Animation pass** — framer-motion entry animations, marquee tuning, skeleton loaders
- **Mobile spacing/typography polish** — bottom-bar safe area, scroll snap on rails
- **i18n strings** for all new sections (EN/HI/TA/TE/BN/MR)

---

## Final scroll order on Home (after all 4 phases)

```
Header (balance · inbox · notifications · profile)
↓
Free Minutes Hero Banner (Phase 13)
↓
Live Online Strip (Phase 13)
↓
Quick Actions Grid 2x2 (Phase 13)
↓
Recharge Offer Card — conditional (Phase 13)
↓
Live Matchmaker Rooms (Phase 14)
↓
Daily Check-in Streak (Phase 15)
↓
Trending Now (Phase 15)
↓
Fan Club Spotlight (Phase 15)
↓
Recently Played With (Phase 15)
↓
For You — personalized (Phase 15)
↓
Trust badges + SOS (Phase 16)
↓
Bottom Bar (existing)
```

---

**Confirm karo to Phase 13 se start karta hu.**
