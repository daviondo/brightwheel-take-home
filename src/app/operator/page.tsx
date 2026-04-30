import Link from "next/link";
import { AlertCircle, Clock, MessageSquare } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { type Triage } from "@/prompts/triage";

interface InboxItem {
  conversation_id: string;
  first_question: string;
  parent_name: string | null;
  referenced_child_name: string | null;
  urgency: "high" | "standard";
  sensitivity: string;
  last_ai_message: string | null;
  last_ai_confidence: string | null;
  message_count: number;
  last_message_at: string;
}

async function getInboxData(urgency?: string) {
  const db = createServiceClient();

  let query = db
    .from("conversations")
    .select("id, urgency, triage, last_message_at, parent_id")
    .eq("status", "awaiting_operator")
    .order("urgency", { ascending: true })
    .order("last_message_at", { ascending: true });

  if (urgency === "high" || urgency === "standard") {
    query = query.eq("urgency", urgency);
  }

  const [{ data: conversations, error }, { count: answeredCount }, { data: allInbox }] =
    await Promise.all([
      query,
      db
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("status", "answered"),
      // Always fetch unfiltered counts so chip labels are stable across filters
      db
        .from("conversations")
        .select("id, urgency")
        .eq("status", "awaiting_operator"),
    ]);

  if (error) throw new Error(error.message);

  const convs = conversations ?? [];
  const convIds = convs.map((c) => c.id);
  const parentIds = [...new Set(convs.map((c) => c.parent_id).filter(Boolean) as string[])];

  const [messagesRes, parentsRes] = await Promise.all([
    convIds.length > 0
      ? db
          .from("messages")
          .select("id, conversation_id, role, content, ai_confidence, created_at")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; conversation_id: string; role: string; content: string; ai_confidence: string | null; created_at: string }[] }),
    parentIds.length > 0
      ? db.from("parents").select("id, name").in("id", parentIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const messages = messagesRes.data ?? [];
  const parentMap = Object.fromEntries((parentsRes.data ?? []).map((p) => [p.id, p.name]));

  const items: InboxItem[] = convs.map((conv) => {
    const convMessages = messages.filter((m) => m.conversation_id === conv.id);
    const firstParentMsg = convMessages.find((m) => m.role === "parent");
    const lastAiMsg = [...convMessages].reverse().find((m) => m.role === "ai");
    const triage = conv.triage as Triage | null;

    return {
      conversation_id: conv.id,
      first_question: firstParentMsg?.content ?? "",
      parent_name: conv.parent_id ? (parentMap[conv.parent_id] ?? null) : null,
      referenced_child_name: triage?.referenced_child_name ?? null,
      urgency: conv.urgency as "high" | "standard",
      sensitivity: triage?.sensitivity ?? "none",
      last_ai_message: lastAiMsg?.content ?? null,
      last_ai_confidence: lastAiMsg?.ai_confidence ?? null,
      message_count: convMessages.length,
      last_message_at: conv.last_message_at,
    };
  });

  const all = allInbox ?? [];
  return {
    items,
    counts: {
      high: all.filter((c) => c.urgency === "high").length,
      standard: all.filter((c) => c.urgency === "standard").length,
      total: all.length,
    },
    answered_count: answeredCount ?? 0,
  };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ConfidenceBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const cls =
    level === "high"
      ? "bg-green-100 text-green-800"
      : level === "medium"
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {level}
    </span>
  );
}

export default async function OperatorInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ urgency?: string }>;
}) {
  const { urgency } = await searchParams;
  const data = await getInboxData(urgency);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Inbox</h2>
        <span className="text-sm text-muted-fg">{data.answered_count} answered</span>
      </div>

      {/* Urgency filter chips */}
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { label: "All", value: undefined, count: data.counts.total },
          { label: "High priority", value: "high", count: data.counts.high },
          { label: "Standard", value: "standard", count: data.counts.standard },
        ].map(({ label, value, count }) => {
          const active = urgency === value || (!urgency && !value);
          const href = value ? `/operator?urgency=${value}` : "/operator";
          return (
            <Link
              key={label}
              href={href}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-white"
                  : "bg-muted/30 text-muted-fg hover:bg-muted/50",
              ].join(" ")}
            >
              {label}
              <span
                className={[
                  "rounded-full px-1.5 py-0.5 text-xs font-semibold",
                  active ? "bg-white/25 text-white" : "bg-background text-foreground",
                ].join(" ")}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Conversation list */}
      {data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-fg">
          <MessageSquare className="h-10 w-10 opacity-30" />
          <p className="font-medium">No questions waiting.</p>
          <p className="text-sm">
            The AI handled the last {data.answered_count} question
            {data.answered_count !== 1 ? "s" : ""} confidently.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.items.map((item) => (
            <li key={item.conversation_id}>
              <Link
                href={`/operator/conversation/${item.conversation_id}`}
                className={[
                  "block rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md",
                  item.urgency === "high" ? "border-l-4 border-l-accent" : "",
                ].join(" ")}
              >
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={[
                        "mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full",
                        item.urgency === "high" ? "bg-accent" : "bg-muted",
                      ].join(" ")}
                    />
                    <span className="truncate font-medium text-foreground">
                      {item.parent_name ?? "Anonymous"}
                      {item.referenced_child_name && (
                        <span className="ml-1 font-normal text-muted-fg">
                          re: {item.referenced_child_name}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1 text-xs text-muted-fg">
                    <Clock className="h-3.5 w-3.5" />
                    {timeAgo(item.last_message_at)}
                  </div>
                </div>

                <p className="mb-2 line-clamp-2 text-sm text-foreground">
                  {item.first_question}
                </p>

                {item.last_ai_message && (
                  <p className="line-clamp-1 text-xs text-muted-fg">
                    AI: {item.last_ai_message}
                  </p>
                )}

                <div className="mt-2 flex items-center gap-2">
                  {item.sensitivity !== "none" && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {item.sensitivity}
                    </Badge>
                  )}
                  <ConfidenceBadge level={item.last_ai_confidence} />
                  <span className="ml-auto text-xs text-muted-fg">
                    {item.message_count} msg{item.message_count !== 1 ? "s" : ""}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
