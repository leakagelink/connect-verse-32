#!/usr/bin/env node
/**
 * RLS Security Test — Admin accounts must never appear to regular users.
 *
 * Creates 3 real auth users (admin, regular, other), exercises the
 * "profiles readable by authenticated" policy from each perspective, then
 * tears everything down.
 *
 * Run:
 *   node tests/rls/admin-hidden.test.mjs
 *
 * Env required:
 *   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

const URL  = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SVC) {
  console.error("Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const admin = createClient(URL, SVC, { auth: { persistSession: false, autoRefreshToken: false } });

const TAG  = `rlstest_${Date.now()}`;
const PW   = "TestPass!" + Math.random().toString(36).slice(2, 10) + "A1";
const USERS = {
  admin:   { email: `${TAG}_admin@example.test`,  password: PW, username: `${TAG}_admin` },
  regular: { email: `${TAG}_user@example.test`,   password: PW, username: `${TAG}_user`  },
  other:   { email: `${TAG}_other@example.test`,  password: PW, username: `${TAG}_other` },
};

const failures = [];
function assert(label, cond, detail = "") {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label} ${detail}`);
    failures.push(label);
  }
}

async function createUser(u) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email, password: u.password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${u.email}): ${error.message}`);
  u.id = data.user.id;
  // Upsert profile fields (trigger already inserted a row)
  const { error: pErr } = await admin
    .from("profiles")
    .update({ username: u.username, country: "India", gender: "male" })
    .eq("id", u.id);
  if (pErr) throw new Error(`profile update: ${pErr.message}`);
}

async function grantAdminRole(userId) {
  const { error } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: "admin" });
  if (error && !`${error.message}`.includes("duplicate")) {
    throw new Error(`grant admin: ${error.message}`);
  }
}

async function signIn(u) {
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: u.email, password: u.password });
  if (error) throw new Error(`signIn(${u.email}): ${error.message}`);
  return { client: c, token: data.session.access_token };
}

async function cleanup() {
  for (const u of Object.values(USERS)) {
    if (u.id) {
      try { await admin.auth.admin.deleteUser(u.id); } catch (e) { /* noop */ }
    }
  }
}

async function main() {
  console.log("Seeding test users…");
  await createUser(USERS.admin);
  await createUser(USERS.regular);
  await createUser(USERS.other);
  await grantAdminRole(USERS.admin.id);

  console.log("\n[regular user perspective]");
  const reg = await signIn(USERS.regular);

  {
    const { data, error } = await reg.client
      .from("profiles").select("id,username").eq("id", USERS.admin.id);
    assert("admin profile NOT visible via direct lookup",
      !error && Array.isArray(data) && data.length === 0,
      `→ got ${error?.message ?? JSON.stringify(data)}`);
  }
  {
    const { data } = await reg.client
      .from("profiles").select("id,username").eq("id", USERS.regular.id);
    assert("own profile IS visible", data?.length === 1);
  }
  {
    const { data } = await reg.client
      .from("profiles").select("id,username").eq("id", USERS.other.id);
    assert("other non-admin profile IS visible", data?.length === 1);
  }
  {
    const { data } = await reg.client
      .from("profiles").select("id,username").like("username", `${TAG}_%`);
    const ids = (data ?? []).map(r => r.id);
    assert("list/scan query excludes admin",
      !ids.includes(USERS.admin.id),
      `→ visible ids: ${JSON.stringify(ids)}`);
  }
  {
    const { data } = await reg.client
      .from("profiles").select("id").ilike("username", "%admin%");
    const ids = (data ?? []).map(r => r.id);
    assert("username ILIKE search excludes admin",
      !ids.includes(USERS.admin.id),
      `→ visible ids: ${JSON.stringify(ids)}`);
  }

  // Follows -> profiles join (simulates discovery, chat partners, etc.)
  await admin.from("follows").insert([
    { follower_id: USERS.regular.id, following_id: USERS.admin.id, status: "accepted" },
    { follower_id: USERS.regular.id, following_id: USERS.other.id, status: "accepted" },
  ]);
  {
    const { data } = await reg.client
      .from("follows")
      .select("following_id, profile:profiles!follows_following_id_fkey(id,username)")
      .eq("follower_id", USERS.regular.id);
    const visible = (data ?? []).filter(r => r.profile != null).map(r => r.profile.id);
    assert("follows→profiles join hides admin row",
      !visible.includes(USERS.admin.id),
      `→ visible joined profiles: ${JSON.stringify(visible)}`);
  }

  // Chat / messages surface — create a conversation and ensure peer profile lookups hide admin
  {
    const { data: convo, error: cErr } = await admin
      .from("conversations")
      .insert({ user_a: USERS.regular.id, user_b: USERS.admin.id })
      .select().single();
    if (!cErr && convo) {
      const { data } = await reg.client
        .from("profiles").select("id").eq("id", USERS.admin.id);
      assert("chat-peer profile lookup hides admin",
        (data ?? []).length === 0,
        `→ got ${JSON.stringify(data)}`);
    } else {
      console.log(`  · skipped chat test (conversations seed: ${cErr?.message})`);
    }
  }

  console.log("\n[admin perspective — positive control]");
  const ad = await signIn(USERS.admin);
  {
    const { data } = await ad.client
      .from("profiles").select("id").eq("id", USERS.admin.id);
    assert("admin can read own profile", data?.length === 1);
  }
  {
    const { data } = await ad.client
      .from("profiles").select("id").like("username", `${TAG}_%`);
    assert("admin sees all 3 test profiles",
      (data ?? []).length === 3,
      `→ got ${data?.length}`);
  }

  console.log("\n[anonymous perspective]");
  const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  {
    const { data } = await anon
      .from("profiles").select("id").in("id",
        [USERS.admin.id, USERS.regular.id, USERS.other.id]);
    assert("anonymous role cannot read profiles",
      (data ?? []).length === 0,
      `→ got ${JSON.stringify(data)}`);
  }
}

(async () => {
  let exitCode = 0;
  try {
    await main();
  } catch (e) {
    console.error("\nUNEXPECTED ERROR:", e.message);
    exitCode = 1;
  } finally {
    console.log("\nCleaning up test users…");
    await cleanup();
  }
  console.log("");
  if (failures.length) {
    console.error(`FAIL — ${failures.length} assertion(s) failed:`);
    failures.forEach(f => console.error("  • " + f));
    process.exit(exitCode || 1);
  }
  console.log("✅ ALL RLS ADMIN-HIDDEN TESTS PASSED");
  process.exit(exitCode);
})();
