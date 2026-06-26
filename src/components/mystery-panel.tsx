import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Users, Folder, FileText, Mic2, MessagesSquare, AtSign,
  CheckCircle2, XCircle, Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { getMysteryCase, submitGuess } from "@/lib/mystery.functions";

export function MysteryPanel({
  caseId,
  open,
  onOpenChange,
}: {
  caseId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getMysteryCase);
  const submitFn = useServerFn(submitGuess);
  const [picked, setPicked] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["mystery-case", caseId],
    queryFn: () => getFn({ data: { caseId: caseId! } }),
    enabled: !!caseId && open,
    refetchInterval: open ? 4000 : false,
  });

  async function submit() {
    if (!picked || !caseId) return;
    try {
      const res = await submitFn({ data: { caseId, personId: picked } });
      if (res.isCorrect) toast.success("🎉 You solved it!");
      else toast.error("Not quite — but the answer is now revealed.");
      await refetch();
      qc.invalidateQueries({ queryKey: ["mystery-case", caseId] });
    } catch (e: any) {
      toast.error(e.message ?? "Could not submit guess");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[88vh] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Search className="size-5 text-primary" />
            {data?.title ?? "Mystery Case"}
            {data?.status === "solved" && (
              <Badge variant="default" className="ml-auto gap-1">
                <Trophy className="size-3" /> Solved
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {!caseId || isLoading || !data ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Loading case…
          </div>
        ) : (
          <Tabs defaultValue="brief" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-3 mt-2 grid grid-cols-4">
              <TabsTrigger value="brief">Brief</TabsTrigger>
              <TabsTrigger value="suspects">Suspects</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
              <TabsTrigger value="solve">Solve</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 px-3 py-3">
              <TabsContent value="brief" className="mt-0 space-y-3">
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">{data.setting}</p>
                  <p className="text-sm leading-relaxed">{data.brief}</p>
                </Card>
                <p className="text-[11px] text-muted-foreground text-center">
                  Discuss the case on your call — review suspects & evidence together, then each player submits a guess.
                </p>
              </TabsContent>

              <TabsContent value="suspects" className="mt-0 space-y-2">
                {data.persons.map((p: any) => (
                  <Card key={p.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold flex items-center gap-1.5">
                          <Users className="size-3.5 text-primary" />
                          {p.name}
                          {p.age && <span className="text-xs text-muted-foreground">· {p.age}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{p.role}{p.relationship ? ` · ${p.relationship}` : ""}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{p.id}</Badge>
                    </div>
                    <div className="mt-2 space-y-1 text-xs">
                      <p><span className="font-medium text-foreground">Alibi:</span> <span className="text-muted-foreground">{p.alibi}</span></p>
                      <p><span className="font-medium text-foreground">Motive:</span> <span className="text-muted-foreground">{p.motive}</span></p>
                    </div>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="evidence" className="mt-0">
                <Tabs defaultValue="chat">
                  <TabsList className="grid grid-cols-4 mb-2">
                    <TabsTrigger value="chat"><MessagesSquare className="size-3.5" /></TabsTrigger>
                    <TabsTrigger value="social"><AtSign className="size-3.5" /></TabsTrigger>
                    <TabsTrigger value="voice"><Mic2 className="size-3.5" /></TabsTrigger>
                    <TabsTrigger value="forensic"><FileText className="size-3.5" /></TabsTrigger>
                  </TabsList>

                  <TabsContent value="chat" className="space-y-2 mt-0">
                    {data.evidence.chat_logs?.map((c: any, i: number) => (
                      <Card key={i} className="p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">{c.between}</p>
                        <div className="space-y-1">
                          {c.messages.map((m: any, j: number) => (
                            <div key={j} className="text-xs">
                              <span className="font-semibold text-primary">{m.from}:</span>{" "}
                              <span>{m.text}</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="social" className="space-y-2 mt-0">
                    {data.evidence.social_profile?.map((s: any, i: number) => (
                      <Card key={i} className="p-3">
                        <p className="text-xs font-semibold mb-1">@{s.person_id}</p>
                        <p className="text-xs text-muted-foreground mb-2">{s.bio}</p>
                        <div className="space-y-1">
                          {s.recent_posts?.map((post: string, j: number) => (
                            <p key={j} className="text-xs border-l-2 border-primary/40 pl-2">{post}</p>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="voice" className="mt-0">
                    <Card className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="size-10 rounded-full brand-gradient flex items-center justify-center">
                          <Mic2 className="size-4 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold">Voice note from {data.evidence.voice_note?.person_id}</p>
                          <p className="text-[10px] text-muted-foreground">Transcript</p>
                        </div>
                      </div>
                      <p className="text-xs italic text-muted-foreground">"{data.evidence.voice_note?.transcript}"</p>
                    </Card>
                  </TabsContent>

                  <TabsContent value="forensic" className="mt-0">
                    <Card className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="size-4 text-primary" />
                        <p className="text-xs font-semibold uppercase tracking-wide">Forensic Report</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{data.evidence.forensic_report?.summary}</p>
                      <p className="text-[11px] mb-1"><span className="font-medium">Time of incident:</span> {data.evidence.forensic_report?.time_of_incident}</p>
                      <ul className="text-xs list-disc list-inside space-y-1">
                        {data.evidence.forensic_report?.findings?.map((f: string, i: number) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </Card>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="solve" className="mt-0 space-y-3">
                {data.myGuess ? (
                  <Card className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {data.myGuess.is_correct ? (
                        <CheckCircle2 className="size-5 text-emerald-500" />
                      ) : (
                        <XCircle className="size-5 text-destructive" />
                      )}
                      <p className="font-semibold">
                        {data.myGuess.is_correct ? "You solved it!" : "Wrong guess"}
                      </p>
                    </div>
                    {data.culpritId && (
                      <p className="text-xs">
                        <span className="font-medium">Culprit:</span>{" "}
                        {data.persons.find((p: any) => p.id === data.culpritId)?.name}
                      </p>
                    )}
                    {data.solutionExplanation && (
                      <p className="text-xs text-muted-foreground mt-2">{data.solutionExplanation}</p>
                    )}
                  </Card>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">Pick the person you think is guilty:</p>
                    <div className="space-y-2">
                      {data.persons.map((p: any) => (
                        <button
                          key={p.id}
                          onClick={() => setPicked(p.id)}
                          className={`w-full text-left p-3 rounded-lg border transition ${
                            picked === p.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                          }`}
                        >
                          <p className="text-sm font-semibold">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.role}</p>
                        </button>
                      ))}
                    </div>
                    <Button className="w-full" disabled={!picked} onClick={submit}>
                      <Folder className="size-4 mr-2" /> Submit final guess
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground">
                      You only get one guess. The answer reveals after you submit.
                    </p>
                  </>
                )}

                {data.guesses && data.guesses.length > 0 && (
                  <Card className="p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Both players</p>
                    <div className="space-y-1 text-xs">
                      {data.guesses.map((g: any) => {
                        const person = data.persons.find((p: any) => p.id === g.guessed_person_id);
                        return (
                          <div key={g.user_id} className="flex items-center justify-between">
                            <span>{g.user_id.slice(0, 8)}… guessed {person?.name ?? g.guessed_person_id}</span>
                            {g.is_correct ? (
                              <CheckCircle2 className="size-3.5 text-emerald-500" />
                            ) : (
                              <XCircle className="size-3.5 text-destructive" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
