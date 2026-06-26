import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listRooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, host_id, title, topic, kind, max_seats, cover_url, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(80);
    if (!rooms?.length) return [];
    const hostIds = [...new Set(rooms.map((r) => r.host_id))];
    const [{ data: hosts }, { data: parts }] = await Promise.all([
      supabase.from("profiles").select("id, username, avatar_url").in("id", hostIds),
      supabase.from("room_participants").select("room_id").in("room_id", rooms.map((r) => r.id)),
    ]);
    const hmap = new Map((hosts ?? []).map((h) => [h.id, h]));
    const counts = new Map<string, number>();
    (parts ?? []).forEach((p) => counts.set(p.room_id, (counts.get(p.room_id) ?? 0) + 1));
    return rooms.map((r) => ({ ...r, host: hmap.get(r.host_id), participants: counts.get(r.id) ?? 0 }));
  });

export const createRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().trim().min(3).max(60),
    topic: z.string().trim().max(160).optional(),
    kind: z.enum(["voice", "video", "game", "live"]),
    max_seats: z.number().int().min(2).max(20).default(8),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: room, error } = await supabase
      .from("rooms")
      .insert({ host_id: userId, title: data.title, topic: data.topic ?? null, kind: data.kind, max_seats: data.max_seats })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("room_participants").insert({ room_id: room.id, user_id: userId });
    return { id: room.id };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: room } = await supabase.from("rooms").select("id, max_seats, is_active").eq("id", data.roomId).maybeSingle();
    if (!room || !room.is_active) throw new Error("Room is not available");
    const { count } = await supabase.from("room_participants").select("id", { count: "exact", head: true }).eq("room_id", data.roomId);
    if ((count ?? 0) >= room.max_seats) throw new Error("Room is full");
    await supabase.from("room_participants").upsert({ room_id: data.roomId, user_id: userId }, { onConflict: "room_id,user_id" });
    return { ok: true };
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("room_participants").delete().eq("room_id", data.roomId).eq("user_id", userId);
    // host ends the room if they leave
    const { data: room } = await supabase.from("rooms").select("host_id").eq("id", data.roomId).maybeSingle();
    if (room?.host_id === userId) {
      await supabase.from("rooms").update({ is_active: false }).eq("id", data.roomId);
    }
    return { ok: true };
  });

export const getRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: room } = await supabase
      .from("rooms")
      .select("id, host_id, title, topic, kind, max_seats, is_active, created_at")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room) throw new Error("Room not found");
    const { data: parts } = await supabase
      .from("room_participants")
      .select("user_id, joined_at")
      .eq("room_id", data.roomId);
    const ids = (parts ?? []).map((p) => p.user_id);
    const { data: profiles } = await supabase.from("profiles").select("id, username, avatar_url, is_creator").in("id", ids);
    return { room, participants: profiles ?? [] };
  });
