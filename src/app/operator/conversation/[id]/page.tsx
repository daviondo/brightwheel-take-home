import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { OperatorConversation } from "@/components/operator-conversation";

async function getConversation(id: string) {
  const db = createServiceClient();

  const { data: conversation, error } = await db
    .from("conversations")
    .select("id, status, urgency, triage, parent_id, last_message_at, created_at")
    .eq("id", id)
    .single();

  if (error || !conversation) return null;

  const [messagesRes, parentRes] = await Promise.all([
    db
      .from("messages")
      .select(
        "id, role, content, ai_confidence, ai_confidence_reason, policies_cited, awaiting_clarification, operator_id, created_at",
      )
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),

    conversation.parent_id
      ? db
          .from("parents")
          .select("id, name, email, phone")
          .eq("id", conversation.parent_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const rawMessages = messagesRes.data ?? [];

  // Resolve operator names
  const operatorIds = [
    ...new Set(
      rawMessages
        .filter((m) => m.role === "operator" && m.operator_id)
        .map((m) => m.operator_id as string),
    ),
  ];
  const operatorNames: Record<string, string> = {};
  if (operatorIds.length > 0) {
    const { data: ops } = await db.from("operators").select("id, name").in("id", operatorIds);
    (ops ?? []).forEach((op) => { operatorNames[op.id] = op.name; });
  }

  // Resolve policy titles
  const allPolicyIds = [
    ...new Set(rawMessages.flatMap((m) => (m.policies_cited as string[] | null) ?? [])),
  ];
  const policyTitles: Record<string, string> = {};
  if (allPolicyIds.length > 0) {
    const { data: pols } = await db.from("policies").select("id, title").in("id", allPolicyIds);
    (pols ?? []).forEach((p) => { policyTitles[p.id] = p.title; });
  }

  const messages = rawMessages.map((m) => ({
    id: m.id,
    role: m.role as "parent" | "ai" | "operator",
    content: m.content,
    confidence: m.ai_confidence as "high" | "medium" | "low" | null,
    confidence_reason: m.ai_confidence_reason,
    awaiting_clarification: m.awaiting_clarification,
    policies_cited: ((m.policies_cited as string[] | null) ?? []).map((pid) => ({
      id: pid,
      title: policyTitles[pid] ?? pid,
    })),
    operator_name: m.operator_id ? operatorNames[m.operator_id] : undefined,
    created_at: m.created_at,
  }));

  return {
    id: conversation.id,
    status: conversation.status,
    urgency: conversation.urgency as "high" | "standard",
    triage: conversation.triage,
    last_message_at: conversation.last_message_at,
    created_at: conversation.created_at,
    parent: parentRes.data
      ? {
          id: parentRes.data.id,
          name: parentRes.data.name,
          email: parentRes.data.email,
          phone: parentRes.data.phone,
        }
      : null,
    messages,
  };
}

export default async function OperatorConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversation = await getConversation(id);

  if (!conversation) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b bg-white px-4 py-3">
        <Link
          href="/operator"
          className="inline-flex items-center gap-1 text-sm text-muted-fg hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Inbox
        </Link>
      </div>
      <OperatorConversation conversation={conversation} />
    </div>
  );
}
