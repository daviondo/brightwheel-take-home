"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Wand2, AlertCircle, CheckCircle2, User, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PolicyRef {
  id: string;
  title: string;
}

interface ConversationMessage {
  id: string;
  role: "parent" | "ai" | "operator";
  content: string;
  confidence?: "high" | "medium" | "low" | null;
  confidence_reason?: string | null;
  awaiting_clarification?: boolean;
  policies_cited?: PolicyRef[];
  operator_name?: string;
  created_at: string;
}

interface ConversationDetail {
  id: string;
  status: string;
  urgency: "high" | "standard";
  triage: unknown;
  last_message_at: string;
  created_at: string;
  parent: { id: string; name: string; email: string; phone: string } | null;
  messages: ConversationMessage[];
}

interface DraftResult {
  draft_reply: string;
  policies_referenced: PolicyRef[];
  notes_for_operator: string | null;
}

interface Props {
  conversation: ConversationDetail;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ConfidencePill({ level, reason }: { level: string; reason?: string | null }) {
  const cfg = {
    high: { label: "High confidence", className: "bg-green-100 text-green-800" },
    medium: { label: "Medium confidence", className: "bg-yellow-100 text-yellow-800" },
    low: { label: "Low confidence", className: "bg-red-100 text-red-800" },
  }[level] ?? { label: level, className: "bg-muted text-muted-fg" };

  return (
    <span
      title={reason ?? undefined}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ConversationMessage }) {
  const isParent = msg.role === "parent";
  const isOperator = msg.role === "operator";

  return (
    <div className={`flex gap-2 ${isParent ? "flex-row-reverse" : "flex-row"}`}>
      <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-fg">
        {isParent ? <User className="h-4 w-4" /> : isOperator ? <CheckCircle2 className="h-4 w-4 text-blue-500" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={`flex max-w-[75%] flex-col gap-1 ${isParent ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-1.5 text-xs text-muted-fg">
          {isOperator && <span>{msg.operator_name ?? "Director"}</span>}
          {!isParent && !isOperator && <span>AI Assistant</span>}
          {isParent && <span>Parent</span>}
          <span>·</span>
          <span>{formatTime(msg.created_at)}</span>
        </div>

        <div
          className={[
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
            isParent
              ? "bg-primary text-white rounded-tr-sm"
              : isOperator
              ? "bg-blue-50 text-foreground border border-blue-200 rounded-tl-sm"
              : "bg-muted text-foreground rounded-tl-sm",
          ].join(" ")}
        >
          {msg.content}
        </div>

        {msg.confidence && (
          <div className="flex flex-wrap items-center gap-1.5">
            <ConfidencePill level={msg.confidence} reason={msg.confidence_reason} />
            {msg.awaiting_clarification && (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                Awaiting clarification
              </span>
            )}
          </div>
        )}

        {msg.policies_cited && msg.policies_cited.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {msg.policies_cited.map((p) => (
              <span
                key={p.id}
                className="rounded-full border px-2 py-0.5 text-xs text-muted-fg"
              >
                {p.title}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OperatorConversation({ conversation }: Props) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [reply, setReply] = useState("");
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [isDrafting, startDraft] = useTransition();
  const [isSending, startSend] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages.length]);

  const canReply = conversation.status !== "answered_by_operator" && conversation.status !== "answered";

  async function handleDraft() {
    setError(null);
    startDraft(async () => {
      const res = await fetch("/api/operator/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversation.id }),
      });
      if (!res.ok) {
        setError("Failed to generate draft. Try again.");
        return;
      }
      const data: DraftResult = await res.json();
      setDraft(data);
      setReply(data.draft_reply);
    });
  }

  async function handleSend() {
    if (!reply.trim()) return;
    setError(null);
    startSend(async () => {
      const res = await fetch("/api/operator/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversation.id, answer: reply }),
      });
      if (!res.ok) {
        setError("Failed to send reply. Try again.");
        return;
      }
      setReply("");
      setDraft(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Parent info bar */}
      {conversation.parent && (
        <div className="border-b bg-muted/30 px-4 py-3">
          <div className="mx-auto max-w-3xl flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="font-medium text-sm">{conversation.parent.name}</span>
              {conversation.parent.email && (
                <span className="ml-2 text-xs text-muted-fg">{conversation.parent.email}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {conversation.urgency === "high" && (
                <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  High priority
                </span>
              )}
              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-fg capitalize">
                {conversation.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-3xl space-y-4">
          {conversation.messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Reply panel */}
      <div className="border-t bg-white px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-3">
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          {draft?.notes_for_operator && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-900">
              <strong>Note:</strong> {draft.notes_for_operator}
            </div>
          )}

          {draft?.policies_referenced && draft.policies_referenced.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {draft.policies_referenced.map((p) => (
                <span
                  key={p.id}
                  className="rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-muted-fg"
                >
                  {p.title}
                </span>
              ))}
            </div>
          )}

          {canReply ? (
            <>
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply to the parent..."
                className="min-h-[100px] resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
                }}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDraft}
                  disabled={isDrafting || isSending}
                  className="gap-1.5"
                >
                  <Wand2 className="h-4 w-4" />
                  {isDrafting ? "Drafting…" : "Draft from policies"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={isSending || !reply.trim()}
                  className="ml-auto gap-1.5"
                >
                  <Send className="h-4 w-4" />
                  {isSending ? "Sending…" : "Send reply"}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-muted-fg py-2">
              This conversation has been answered.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
