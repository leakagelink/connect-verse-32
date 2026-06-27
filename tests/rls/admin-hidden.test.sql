-- ============================================================================
-- RLS Security Test: Admin accounts must NEVER appear in user-facing queries
-- ============================================================================
-- Verifies the "profiles readable by authenticated" RLS policy.
-- Runs inside a transaction and ROLLBACKs at the end — no real data touched.
--
-- Run with:   psql -f tests/rls/admin-hidden.test.sql
-- Exit code: non-zero if any assertion fails.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ---------- Seed two synthetic users ----------
DO $$
DECLARE
  v_admin_id   uuid := '11111111-1111-1111-1111-111111111111';
  v_user_id    uuid := '22222222-2222-2222-2222-222222222222';
  v_other_id   uuid := '33333333-3333-3333-3333-333333333333';
BEGIN
  -- Minimal auth.users rows (FK target). Superuser-only insert; OK in tests.
  INSERT INTO auth.users (id, instance_id, aud, role, email,
                          encrypted_password, email_confirmed_at,
                          created_at, updated_at,
                          raw_app_meta_data, raw_user_meta_data)
  VALUES
    (v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rlstest_admin@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_user_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rlstest_user@example.test',  '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
    (v_other_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rlstest_other@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

  -- Profiles (handle_new_user trigger may already insert; UPSERT to be safe)
  INSERT INTO public.profiles (id, username, gender, country)
  VALUES
    (v_admin_id, 'rlstest_admin', 'male', 'India'),
    (v_user_id,  'rlstest_user',  'male', 'India'),
    (v_other_id, 'rlstest_other', 'female', 'India')
  ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username, country = EXCLUDED.country;

  -- Ensure clean role state for the synthetic users
  DELETE FROM public.user_roles WHERE user_id IN (v_admin_id, v_user_id, v_other_id);

  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_admin_id, 'admin'),
    (v_admin_id, 'user'),
    (v_user_id,  'user'),
    (v_other_id, 'user');
END $$;

-- ============================================================================
-- TEST 1: A regular signed-in user CANNOT see the admin profile
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

DO $$
DECLARE
  v_admin_visible int;
  v_self_visible  int;
  v_other_visible int;
BEGIN
  SELECT count(*) INTO v_admin_visible
    FROM public.profiles
    WHERE id = '11111111-1111-1111-1111-111111111111';

  SELECT count(*) INTO v_self_visible
    FROM public.profiles
    WHERE id = '22222222-2222-2222-2222-222222222222';

  SELECT count(*) INTO v_other_visible
    FROM public.profiles
    WHERE id = '33333333-3333-3333-3333-333333333333';

  IF v_admin_visible <> 0 THEN
    RAISE EXCEPTION 'FAIL [direct lookup]: regular user CAN see admin profile (count=%)', v_admin_visible;
  END IF;
  IF v_self_visible <> 1 THEN
    RAISE EXCEPTION 'FAIL [self lookup]: regular user cannot see own profile (count=%)', v_self_visible;
  END IF;
  IF v_other_visible <> 1 THEN
    RAISE EXCEPTION 'FAIL [peer lookup]: regular user cannot see another non-admin profile (count=%)', v_other_visible;
  END IF;
  RAISE NOTICE 'PASS test 1: direct profile lookup hides admin from regular user';
END $$;

-- ============================================================================
-- TEST 2: Admin is excluded from a "discovery / list all" style query
-- ============================================================================
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.profiles
    WHERE username LIKE 'rlstest_%'
      AND id = '11111111-1111-1111-1111-111111111111';

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [list scan]: admin appears in a username scan (count=%)', v_count;
  END IF;
  RAISE NOTICE 'PASS test 2: admin hidden from list/scan queries';
END $$;

-- ============================================================================
-- TEST 3: Admin is excluded from search (username/country ILIKE)
-- ============================================================================
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.profiles
    WHERE username ILIKE '%admin%';

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [search]: admin matched a username search (count=%)', v_count;
  END IF;
  RAISE NOTICE 'PASS test 3: admin hidden from username search';
END $$;

-- ============================================================================
-- TEST 4: Joins through follows/conversations also hide admin rows
-- ============================================================================
RESET ROLE;
INSERT INTO public.follows (follower_id, following_id, status)
VALUES
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'accepted'),
  ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'accepted')
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

DO $$
DECLARE
  v_count int;
BEGIN
  -- Simulate UI joining follows -> profiles. RLS on profiles must filter admin.
  SELECT count(*) INTO v_count
  FROM public.follows f
  JOIN public.profiles p ON p.id = f.following_id
  WHERE f.follower_id = '22222222-2222-2222-2222-222222222222';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [follows join]: expected 1 visible following (non-admin only), got %', v_count;
  END IF;
  RAISE NOTICE 'PASS test 4: admin hidden through follows -> profiles join';
END $$;

-- ============================================================================
-- TEST 5: Admin sessions CAN still see admin (positive control)
-- ============================================================================
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.profiles
    WHERE id = '11111111-1111-1111-1111-111111111111';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [admin self]: admin cannot read own profile (count=%)', v_count;
  END IF;
  RAISE NOTICE 'PASS test 5: admin can still read profiles (positive control)';
END $$;

-- ============================================================================
-- TEST 6: Anonymous (logged-out) cannot read profiles at all
-- ============================================================================
RESET ROLE;
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.profiles
    WHERE id IN (
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333'
    );

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [anon]: anonymous role can read profiles (count=%)', v_count;
  END IF;
  RAISE NOTICE 'PASS test 6: anonymous role denied';
END $$;

RESET ROLE;

-- ============================================================================
-- All assertions passed — roll back synthetic data
-- ============================================================================
\echo '----------------------------------------------------------------'
\echo 'ALL RLS ADMIN-HIDDEN TESTS PASSED'
\echo '----------------------------------------------------------------'

ROLLBACK;
