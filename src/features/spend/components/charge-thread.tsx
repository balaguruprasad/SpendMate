"use client";

/** The conversation on one charge.
 *
 * Accounts opens it to say what is wrong — the wrong bill, a missing GST
 * breakup — and puts the charge on hold; the cardholder (or whoever helps
 * them) answers here. Holds and releases appear in the same thread as
 * one-line markers, so the reason sits next to the reply rather than in a
 * field nobody reads. Both sides get an in-app notification; the weekly
 * reminder remains the only SpendMate mail that reaches an inbox. */
import { useEffect, useRef, useState } from "react";
import { PauseCircle, PlayCircle, SendHorizonal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAddComment, useChargeComments, useSetHold } from "../hooks/use-spend";
import type { SpendTransaction } from "../types";

const money = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

/** "14:32" today, "12 Sep" before that. */
function stamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return sameDay
    ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function ChargeThread({
  charge,
  isAdmin,
  currentUserId,
  onClose,
}: {
  charge: SpendTransaction | null;
  isAdmin: boolean;
  currentUserId: string | null;
  onClose: () => void;
}) {
  const { data: comments, isLoading } = useChargeComments(charge?.id ?? null);
  const add = useAddComment();
  const hold = useSetHold();
  const [text, setText] = useState("");
  const [holdMode, setHoldMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Stick to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments?.length]);

  useEffect(() => {
    if (!charge) {
      setText("");
      setHoldMode(false);
    }
  }, [charge]);

  if (!charge) return null;

  function post() {
    const body = text.trim();
    if (!body || !charge) return;
    if (holdMode) {
      // One action: the reason becomes the first line of the conversation.
      hold.mutate(
        { id: charge.id, onHold: true, reason: body },
        {
          onSuccess: () => {
            setText("");
            setHoldMode(false);
          },
        },
      );
      return;
    }
    add.mutate({ id: charge.id, body }, { onSuccess: () => setText("") });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{charge.description}</DialogTitle>
          <DialogDescription>
            {money(charge.amountPaise)} · {charge.cardholder} · {charge.card}
            {charge.onHold && (
              <Badge variant="destructive" className="ml-2 text-[0.65rem]">
                On hold
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="flex max-h-72 min-h-24 flex-col gap-1.5 overflow-y-auto pr-1"
        >
          {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!isLoading && (comments ?? []).length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nothing here yet. Ask for whatever is missing — the cardholder gets a notification.
            </p>
          )}
          {(comments ?? []).map((c) => {
            if (c.kind !== "COMMENT") {
              // A hold or a release is context, not conversation: one line.
              return (
                <div key={c.id} className="flex items-center gap-2 py-0.5">
                  <span className="h-px flex-1 bg-border" />
                  <span className="whitespace-nowrap text-[0.65rem] text-muted-foreground">
                    {c.kind === "HOLD" ? "Put on hold" : "Hold released"} · {c.authorName} ·{" "}
                    {stamp(c.createdAt)}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              );
            }
            const mine = c.authorId === currentUserId;
            return (
              <div key={c.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs leading-snug",
                    mine ? "bg-primary/10" : "bg-muted",
                  )}
                >
                  {!mine && (
                    <p className="text-[0.65rem] font-semibold text-muted-foreground">
                      {c.authorName}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{c.body}</p>
                  <p className="mt-0.5 text-right text-[0.6rem] text-muted-foreground">
                    {stamp(c.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {charge.onHold && charge.holdReason && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs">
            <span className="font-medium">On hold:</span> {charge.holdReason}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Textarea
            rows={2}
            className="resize-none text-xs"
            placeholder={
              holdMode
                ? "What needs fixing? The cardholder sees this."
                : "Write a message — the other side gets notified"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                post();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            {isAdmin ? (
              charge.onHold ? (
                <Button
                  size="sm"
                  variant="outline"
                  loading={hold.isPending}
                  onClick={() => hold.mutate({ id: charge.id, onHold: false, reason: "" })}
                >
                  <PlayCircle className="size-3.5" /> Release hold
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant={holdMode ? "default" : "outline"}
                  onClick={() => setHoldMode((v) => !v)}
                >
                  <PauseCircle className="size-3.5" />
                  {holdMode ? "Cancel hold" : "Put on hold"}
                </Button>
              )
            ) : (
              <span className="text-[0.65rem] text-muted-foreground">
                {charge.onHold ? "Reply here once you have fixed it." : ""}
              </span>
            )}
            <Button
              size="sm"
              disabled={text.trim().length === 0}
              loading={add.isPending || hold.isPending}
              onClick={post}
            >
              <SendHorizonal className="size-3.5" />
              {holdMode ? "Hold & notify" : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
