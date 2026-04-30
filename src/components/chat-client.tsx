"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send, AlertCircle, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CENTER } from "@/lib/center-config";

// ── Voice input hook ──────────────────────────────────────────────────────────

function useSpeechInput(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  const supported =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(( window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  function start() {
    if (!supported) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => onResult(e.results[0][0].transcript);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    recRef.current = rec;
    rec.start();
    setIsListening(true);
  }

  function stop() {
    recRef.current?.stop();
    setIsListening(false);
  }

  return { isListening, supported, start, stop };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PolicyCited {
  id: string;
  title: string;
}

interface ChatMessage {
  id: string;
  role: "parent" | "ai" | "operator";
  content: string;
  confidence?: "high" | "medium" | "low";
  awaiting_clarification?: boolean;
  policies_cited?: PolicyCited[];
  operator_name?: string;
  is_escalated?: boolean;
}

interface ChatClientProps {
  parent: { id: string; name: string } | null;
  childNames: string[];
}

// ── Confidence dot ─────────────────────────────────────────────────────────────

function ConfidenceDot({ level }: { level: "high" | "medium" | "low" }) {
  const color = {
    high: "var(--success)",
    medium: "var(--warning)",
    low: "var(--danger)",
  }[level];
  return (
    <span
      title={`Confidence: ${level}`}
      className="inline-block h-2 w-2 rounded-full flex-shrink-0 mt-1.5"
      style={{ backgroundColor: color }}
    />
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isEscalated,
}: {
  message: ChatMessage;
  isEscalated: boolean;
}) {
  const isParent = message.role === "parent";
  const isOperator = message.role === "operator";

  if (isParent) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 text-white text-[17px] leading-relaxed"
          style={{ backgroundColor: "var(--primary)" }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  if (isOperator) {
    return (
      <div className="flex flex-col gap-1">
        <p
          className="text-xs font-semibold ml-1"
          style={{ color: "var(--accent)" }}
        >
          {message.operator_name ?? CENTER.director} replied
        </p>
        <div className="max-w-[85%]">
          <div
            className="rounded-2xl rounded-tl-sm px-4 py-3 text-[17px] leading-relaxed border"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "var(--accent)",
              color: "var(--foreground)",
            }}
          >
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // AI message
  return (
    <div className="flex gap-2 max-w-[85%]">
      {message.confidence && <ConfidenceDot level={message.confidence} />}
      <div className="flex flex-col gap-2">
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 text-[17px] leading-relaxed shadow-sm"
          style={{
            backgroundColor: "var(--card)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
        >
          {message.content}

          {message.awaiting_clarification && (
            <p className="mt-2 text-sm italic" style={{ color: "var(--muted-fg)" }}>
              [awaiting your reply]
            </p>
          )}

          {isEscalated && !message.awaiting_clarification && (
            <p className="mt-2 text-sm" style={{ color: "var(--muted-fg)" }}>
              I&apos;ve sent this to {CENTER.director}, our director. You&apos;ll hear back soon.
            </p>
          )}
        </div>

        {message.policies_cited && message.policies_cited.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
              Sources:
            </span>
            {message.policies_cited.map((p) => (
              <span
                key={p.id}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: "var(--border)",
                  color: "var(--muted-fg)",
                }}
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

// ── Sign-in CTA ───────────────────────────────────────────────────────────────

function SignInCta() {
  return (
    <div className="flex">
      <div
        className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 border text-[17px] leading-relaxed flex items-start gap-3"
        style={{
          backgroundColor: "var(--card)",
          borderColor: "var(--warning)",
        }}
      >
        <AlertCircle
          className="h-5 w-5 flex-shrink-0 mt-0.5"
          style={{ color: "var(--warning)" }}
        />
        <div>
          <p className="font-medium" style={{ color: "var(--foreground)" }}>
            Sign in to ask about your child
          </p>
          <p className="text-base mt-1" style={{ color: "var(--muted-fg)" }}>
            Use the <strong>Demo mode</strong> dropdown at the top to select a parent.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main chat client ──────────────────────────────────────────────────────────

export function ChatClient({ parent, childNames }: ChatClientProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<string>("answered");
  const [requiresSignin, setRequiresSignin] = useState(false);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastActivityRef = useRef(Date.now());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isListening, supported: speechSupported, start: startListening, stop: stopListening } =
    useSpeechInput((transcript) => {
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, requiresSignin]);

  // Track user activity for polling cutoff
  useEffect(() => {
    const onActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener("focus", onActivity);
    window.addEventListener("keydown", onActivity);
    return () => {
      window.removeEventListener("focus", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, []);

  // Poll for operator replies every 10s, stop after 2 min of inactivity
  useEffect(() => {
    if (!conversationId || conversationStatus !== "awaiting_operator") return;

    const interval = setInterval(async () => {
      if (Date.now() - lastActivityRef.current > 2 * 60 * 1000) return;

      try {
        const res = await fetch(`/api/conversations/${conversationId}`);
        if (!res.ok) return;
        const data = await res.json();

        const incoming: ChatMessage[] = (data.messages ?? []).filter(
          (m: ChatMessage) => m.role === "operator",
        );
        const existingIds = new Set(messages.map((m) => m.id));
        const newMessages = incoming.filter((m) => !existingIds.has(m.id));

        if (newMessages.length > 0) {
          setMessages((prev) => [...prev, ...newMessages]);
          setConversationStatus(data.status);
        }
      } catch {
        // Polling failures are silent
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [conversationId, conversationStatus, messages]);

  // Auto-resize textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const question = input.trim();
    if (!question || isPending) return;

    // Optimistically add parent message
    const tempId = `temp-${Date.now()}`;
    const parentMessage: ChatMessage = {
      id: tempId,
      role: "parent",
      content: question,
    };
    setMessages((prev) => [...prev, parentMessage]);
    setInput("");
    setRequiresSignin(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    startTransition(async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            conversation_id: conversationStatus === "awaiting_clarification"
              ? conversationId
              : undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? { ...m, id: `${tempId}-err` }
                : m,
            ),
          );
          return;
        }

        if (data.requires_signin) {
          setRequiresSignin(true);
          setConversationId(data.conversation_id ?? null);
          return;
        }

        setConversationId(data.conversation_id);
        setConversationStatus(data.conversation_status);

        const aiMessage: ChatMessage = {
          ...data.message,
          is_escalated: data.conversation_status === "awaiting_operator",
        };
        setMessages((prev) => [...prev, aiMessage]);
      } catch {
        // Keep the parent message visible; silently fail
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  // Build empty state copy per spec
  const emptyStateMessage = (() => {
    if (!parent) {
      return `Ask me anything about ${CENTER.name}. Sign in as a parent via the Demo mode dropdown to ask about your child's day.`;
    }
    const firstName = parent.name.split(" ")[0];
    if (childNames.length === 0) {
      return `Hi ${firstName}! Ask me anything about ${CENTER.name}.`;
    }
    if (childNames.length === 1) {
      return `Hi ${firstName}! Ask me anything about ${CENTER.name}, or about ${childNames[0]}'s day. I can also escalate to Director ${CENTER.director} if needed.`;
    }
    const listed = childNames.slice(0, -1).join(", ") + " and " + childNames[childNames.length - 1];
    return `Hi ${firstName}! Ask me anything about ${CENTER.name}, or about ${listed}'s day. I can also escalate to Director ${CENTER.director} if needed.`;
  })();

  return (
    <div className="flex flex-1 flex-col">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center text-xl"
                style={{ backgroundColor: "var(--primary)", color: "white" }}
              >
                ☀
              </div>
              <p
                className="text-[17px] max-w-sm leading-relaxed"
                style={{ color: "var(--muted-fg)" }}
              >
                {emptyStateMessage}
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isEscalated={
                  msg.role === "ai" &&
                  conversationStatus === "awaiting_operator" &&
                  msg.id === messages.filter((m) => m.role === "ai").at(-1)?.id
                }
              />
            ))
          )}

          {requiresSignin && <SignInCta />}

          {isPending && (
            <div className="flex gap-2 max-w-[85%]">
              <div className="h-2 w-2 rounded-full mt-3.5 flex-shrink-0" style={{ backgroundColor: "var(--muted)" }} />
              <div
                className="rounded-2xl rounded-tl-sm px-4 py-3.5"
                style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
              >
                <div className="flex gap-1.5 items-center h-5">
                  {[0, 160, 320].map((delay) => (
                    <span
                      key={delay}
                      className="h-2 w-2 rounded-full animate-bounce"
                      style={{ backgroundColor: "var(--muted-fg)", animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div
        className="sticky bottom-0 border-t px-4 py-3 bg-background"
        style={{ borderColor: "var(--border)" }}
      >
        <form
          onSubmit={handleSubmit}
          className="mx-auto max-w-2xl flex items-end gap-2"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question…"
            rows={1}
            disabled={isPending}
            className="flex-1 resize-none rounded-2xl border px-4 py-3 text-[17px] leading-relaxed focus:outline-none focus:ring-2 disabled:opacity-50 min-h-[52px] max-h-40"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--card)",
              color: "var(--foreground)",
              "--tw-ring-color": "var(--primary)",
            } as React.CSSProperties}
          />
          {speechSupported && (
            <Button
              type="button"
              onClick={isListening ? stopListening : startListening}
              disabled={isPending}
              className="h-[52px] w-[52px] rounded-full flex-shrink-0 p-0 flex items-center justify-center transition-colors"
              style={{
                backgroundColor: isListening ? "var(--danger)" : "var(--border)",
                color: isListening ? "white" : "var(--muted-fg)",
              }}
              aria-label={isListening ? "Stop recording" : "Dictate question"}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          )}
          <Button
            type="submit"
            disabled={!input.trim() || isPending}
            className="h-[52px] w-[52px] rounded-full flex-shrink-0 p-0 flex items-center justify-center"
            style={{
              backgroundColor: input.trim() && !isPending ? "var(--primary)" : "var(--border)",
              color: "white",
            }}
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
