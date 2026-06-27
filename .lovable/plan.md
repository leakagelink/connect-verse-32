# Multi-Provider Calling Pool with Auto-Failover

Goal: Agora aur 100ms dono parallel chalenge. Aap admin panel se dono ke multiple credential sets daal sakte ho. Jab koi credential error de ya quota khatam ho, system automatically agle healthy credential pe switch ho jayega — user ko call drop nahi dikhega.

## 1. Database (new migration)

**New table `calling_credentials`:**
- `id uuid pk`
- `provider text` — `'agora'` ya `'100ms'`
- `label text` — admin-friendly naam (e.g. "Agora-Primary", "100ms-Backup-2")
- `priority int` — chhota number pehle try hoga (1 = highest)
- `is_active bool` — admin toggle
- `status text` — `'healthy' | 'degraded' | 'exhausted' | 'disabled'`
- `credentials jsonb` — Agora: `{app_id, app_certificate}`; 100ms: `{access_key, app_secret, template_id, subdomain}`
- `monthly_quota_minutes int` (nullable) — soft limit, e.g. 10000 for 100ms free tier
- `minutes_used_current_month int` — auto-incremented from `call_logs.duration`
- `quota_reset_at timestamptz` — har month 1st pe reset
- `consecutive_failures int` — 3+ ho to auto-degraded
- `last_error text`, `last_error_at timestamptz`, `last_used_at timestamptz`
- `created_at`, `updated_at`

Grants: `service_role` ALL; admin reads/writes via server fn only (no `authenticated` GRANT — credentials sensitive hain).

**`call_logs` me 2 column add:**
- `credential_id uuid` (kaunsa credential use hua)
- `failover_chain jsonb` (agar fallback hua to history)

## 2. Server functions (`src/lib/calling.functions.ts` extend)

- `getCallingConfig` (existing) → ab pool se best healthy credential return karega. Provider + appId/subdomain + credential_id return.
- `issueAgoraToken` (existing) → `credentialId` accept karega, us specific credential se token sign karega.
- **New** `issueHmsToken` → 100ms management token sign + room create/join via 100ms API.
- **New** `reportCallFailure({credentialId, errorCode, errorMessage})` → consecutive_failures++, 3+ pe `status='degraded'`, agla credential mark karega; client retry call kar sakta hai.
- **New** `recordCallMinutes` → call end pe `minutes_used_current_month` increment, threshold cross ho to `status='exhausted'`.

**Admin-only fns:**
- `adminListCredentials({provider?})` → masked values ke saath list
- `adminCreateCredential({provider, label, priority, credentials, monthly_quota_minutes?})`
- `adminUpdateCredential({id, ...patch})`
- `adminDeleteCredential({id})`
- `adminResetCredentialStatus({id})` — manual "ye theek hai, retry karo"

## 3. Failover logic

Selection order (server-side):
1. `is_active = true` AND `status = 'healthy'` filter
2. ORDER BY `priority ASC`, `consecutive_failures ASC`, `last_used_at NULLS FIRST` (round-robin within same priority)
3. Agar koi healthy nahi → degraded ones ko try karo (last resort)
4. Sab fail → throw "All calling providers down. Please retry in a few minutes."

Client-side (`agora-client.ts` + new `hms-client.ts`):
- Call setup wrapper try karega → fail/timeout pe `reportCallFailure` + `getCallingConfig` dobara → next credential pe rejoin (max 2 retries, 1s gap)
- Hosting/admin alerts: agar 50%+ credentials degraded ho to admin dashboard pe red banner

## 4. Admin panel UI (`src/routes/_authenticated/admin.index.tsx` me naya tab)

**"Calling Providers" tab:**
- Provider switcher tabs: Agora | 100ms
- Table: Label · Priority · Status badge · Minutes used / quota · Last error · Actions (Edit / Reset / Disable / Delete)
- "+ Add Credential" button → drawer with form (provider-specific fields)
- Top banner: global provider preference (mock / auto-pool)

## 5. 100ms client (`src/lib/hms-client.ts` new)

- `@100mslive/hms-video-store` install
- Audio + video call wrapper jo Agora ke jaisa API expose karega (`join`, `leave`, `toggleMic`, `toggleCam`, `onUserPublished`)
- Call screens (`call.$kind.$userId.tsx`, `matchmaker.$id.tsx`, `rooms.$id.tsx`) ek thin abstraction use karenge — `getCallingConfig` se decide hoga kaunsa client load karna hai (dynamic import for code-splitting)

## 6. Quota reset cron

`src/routes/api/public/hooks/reset-calling-quotas.ts` — month ke 1st pe `minutes_used_current_month=0`, `status='healthy'` (agar `exhausted` tha) set. HMAC-protected, pg_cron se trigger.

## Technical details

- `recordCallMinutes` server-side hi minutes count kare (client trusted nahi) — `call_logs.duration` se derive
- Credential secrets sirf `service_role` se readable; admin fns mask karke return karenge (`app_id_masked` style)
- Migration backwards-compat: existing `app_settings` ke `agora_app_id/cert` ko boot pe `calling_credentials` me seed kar dunga as priority=1 Agora credential
- 100ms tokens 24hr valid; per-call generate, cache nahi

## Out of scope (abhi nahi)

- LiveKit / ZegoCloud providers (architecture ready hai, future me add ho sakte hain)
- Cost-based routing (sirf priority + health)
- Region-based selection

## Estimated changes

- 1 new migration
- 3 new files: `hms-client.ts`, `calling-pool.ts` (selector helper), `reset-calling-quotas.ts`
- 4 file edits: `calling.functions.ts`, `agora-client.ts`, `admin.index.tsx`, call screen wrappers
