import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { setMyAiAvatarStyle } from "@/lib/onboarding.functions";
import { AI_AVATAR_STYLES, aiAvatarUrl, pickDefaultStyle } from "@/lib/ai-avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  currentStyle?: string | null;
  gender?: string | null;
  hasPhoto?: boolean;
};

export function AiAvatarPicker({ userId, currentStyle, gender, hasPhoto }: Props) {
  const qc = useQueryClient();
  const setFn = useServerFn(setMyAiAvatarStyle);
  const initial = currentStyle ?? pickDefaultStyle(gender);
  const [selected, setSelected] = useState<string>(initial);

  const saveMut = useMutation({
    mutationFn: (style: string) => setFn({ data: { style } }),
    onSuccess: () => {
      toast.success("AI avatar updated");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  return (
    <Card className="glass mt-4 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="size-4 text-primary" />
        <p className="text-sm font-semibold">AI avatar</p>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
          {hasPhoto ? "Backup" : "Shown to others"}
        </span>
      </div>
      <p className="text-[12px] text-muted-foreground mb-3">
        {hasPhoto
          ? "Your uploaded photo is shown to others. If you remove it, this AI avatar appears instead."
          : "You haven't uploaded a photo — this AI avatar is shown to other users. Pick a style you like."}
      </p>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {AI_AVATAR_STYLES.map((s) => {
          const url = aiAvatarUrl(userId, s.id, gender);
          const active = selected === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s.id)}
              className={cn(
                "relative rounded-xl border bg-card/40 p-1.5 flex flex-col items-center gap-1 transition hover:border-primary/60",
                active ? "border-primary ring-2 ring-primary/40" : "border-border",
              )}
              aria-pressed={active}
              aria-label={`Choose ${s.label} avatar`}
            >
              <img
                src={url}
                alt={s.label}
                width={48}
                height={48}
                loading="lazy"
                className="size-12 rounded-full bg-muted"
              />
              <span className="text-[10px] leading-tight text-muted-foreground truncate w-full text-center">
                {s.label}
              </span>
              {active && (
                <span className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="size-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          disabled={saveMut.isPending || selected === (currentStyle ?? pickDefaultStyle(gender))}
          onClick={() => saveMut.mutate(selected)}
        >
          {saveMut.isPending ? "Saving…" : "Save AI avatar"}
        </Button>
      </div>
    </Card>
  );
}
