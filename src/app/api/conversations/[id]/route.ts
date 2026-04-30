import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentParent } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = createServiceClient();
    const parent = await getCurrentParent();

    const { data: conversation, error } = await db
      .from("conversations")
      .select("id, status, urgency, parent_id")
      .eq("id", id)
      .single();

    if (error || !conversation) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    if (conversation.parent_id !== (parent?.id ?? null)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { data: rawMessages } = await db
      .from("messages")
      .select("id, role, content, ai_confidence, policies_cited, awaiting_clarification, operator_id, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    // Resolve operator names for operator messages
    const operatorIds = [
      ...new Set(
        (rawMessages ?? [])
          .filter((m) => m.role === "operator" && m.operator_id)
          .map((m) => m.operator_id as string),
      ),
    ];

    const operatorNames: Record<string, string> = {};
    if (operatorIds.length > 0) {
      const { data: ops } = await db
        .from("operators")
        .select("id, name")
        .in("id", operatorIds);
      (ops ?? []).forEach((op) => { operatorNames[op.id] = op.name; });
    }

    // Resolve policy titles for cited policies
    const allPolicyIds = [
      ...new Set(
        (rawMessages ?? [])
          .flatMap((m) => (m.policies_cited as string[] | null) ?? []),
      ),
    ];

    const policyTitles: Record<string, string> = {};
    if (allPolicyIds.length > 0) {
      const { data: pols } = await db
        .from("policies")
        .select("id, title")
        .in("id", allPolicyIds);
      (pols ?? []).forEach((p) => { policyTitles[p.id] = p.title; });
    }

    const messages = (rawMessages ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      confidence: m.ai_confidence,
      awaiting_clarification: m.awaiting_clarification,
      policies_cited: ((m.policies_cited as string[] | null) ?? []).map((pid) => ({
        id: pid,
        title: policyTitles[pid] ?? pid,
      })),
      operator_name: m.operator_id ? operatorNames[m.operator_id] : undefined,
      created_at: m.created_at,
    }));

    return NextResponse.json({
      id: conversation.id,
      status: conversation.status,
      urgency: conversation.urgency,
      messages,
    });
  } catch (error) {
    console.error("[conversations/id] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
