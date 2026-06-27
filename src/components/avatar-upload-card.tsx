import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { setMyAvatar, clearMyAvatar } from "@/lib/onboarding.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Sparkles, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Props = {
  username?: string | null;
  avatarUrl?: string | null;
  gender?: string | null;
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function AvatarUploadCard({ username, avatarUrl, gender }: Props) {
  const qc = useQueryClient();
  const setFn = useServerFn(setMyAvatar);
  const clearFn = useServerFn(clearMyAvatar);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const isFemale = gender === "female";

  const clearMut = useMutation({
    mutationFn: () => clearFn(),
    onSuccess: () => {
      toast.success("Photo removed");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function onPick(file: File) {
    if (!OK_TYPES.includes(file.type)) {
      toast.error("Please pick a JPG, PNG or WebP image");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${uid}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      await setFn({ data: { objectPath: path } });
      toast.success("Profile photo updated");
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card className="glass mt-4 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Camera className="size-4 text-primary" />
        <p className="text-sm font-semibold">Profile photo</p>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
          Optional
        </span>
      </div>

      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {avatarUrl && <AvatarImage src={avatarUrl} />}
          <AvatarFallback className="brand-gradient text-primary-foreground font-bold">
            {(username ?? "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
            }}
          />
          <Button
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {avatarUrl ? "Change photo" : "Upload photo"}
          </Button>
          {avatarUrl && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => clearMut.mutate()}
              disabled={clearMut.isPending}
              className="text-destructive"
            >
              <Trash2 className="size-4 mr-1" /> Remove
            </Button>
          )}
        </div>
      </div>

      {isFemale && (
        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="size-4" />
            <p className="text-xs font-semibold">
              Show your face, earn more
            </p>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Adding a clear, real profile photo of yourself can help you receive
            up to <span className="font-semibold text-foreground">3× more
            gifts and tips</span> from fans. It is completely optional — you
            can keep the default avatar and still chat, call and earn on
            Talkora.
          </p>
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5 mt-0.5 shrink-0 text-primary" />
        <p>
          Upload only your own photo. Nudity, sexually suggestive content,
          photos of minors, or photos of someone else are not allowed and will
          be removed. See our{" "}
          <a className="underline" href="/community-guidelines">Community Guidelines</a>.
        </p>
      </div>
    </Card>
  );
}
