import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { differenceInYears, parseISO } from "date-fns";
import { GUIDELINES_VERSION, MIN_AGE } from "./constants";

const OnboardingInput = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscore only"),
  gender: z.enum(["male", "female", "other"]),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  country: z.string().min(2).max(60),
  state: z.string().min(2).max(80).optional().nullable(),
  language: z.string().min(2).max(40),
  acceptGuidelines: z.literal(true),
  asCreator: z.boolean().optional(),
});

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OnboardingInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const age = differenceInYears(new Date(), parseISO(data.dob));
    if (age < MIN_AGE) throw new Error("You must be 18+ to use ConnectVerse");

    // username uniqueness
    const { data: existing } = await supabase
      .from("profiles").select("id").eq("username", data.username).maybeSingle();
    if (existing && existing.id !== userId) throw new Error("Username taken");

    const { error } = await supabase
      .from("profiles")
      .update({
        username: data.username,
        gender: data.gender,
        dob: data.dob,
        country: data.country,
        state: data.state ?? null,
        language: data.language,
        is_creator: !!data.asCreator,
        onboarded: true,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    await supabase
      .from("community_guidelines_acceptance")
      .upsert({ user_id: userId, version: GUIDELINES_VERSION, accepted_at: new Date().toISOString() });

    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      profile,
      roles: (roles ?? []).map((r) => r.role),
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    };
  });

export const discoverUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("id, username, gender, country, language, avatar_url, is_creator")
      .eq("is_banned", false)
      .eq("onboarded", true)
      .neq("id", userId)
      .limit(60);
    return data ?? [];
  });
