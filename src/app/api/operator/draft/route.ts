import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/lib/auth";
import { type Triage } from "@/prompts/triage";
import {
  operatorDraftSchema,
  operatorDraftSystemPrompt,
  buildOperatorDraftUserPrompt,
} from "@/prompts/operatorDraft";

// Policy categories that exist in the DB
const DB_POLICY_CATEGORIES = [
  "hours_holidays", "tuition_fees", "illness_health", "meals_nutrition",
  "pickup_dropoff", "allergies", "enrollment_admissions", "special_events",
  "discipline_behavior", "communication", "other",
];

export async function POST(request: NextRequest) {
  try {
    const operator = await getCurrentOperator();
    if (!operator) {
      return NextResponse.json({ error: "operator session required" }, { status: 401 });
    }

    const { conversation_id } = await request.json();
    if (!conversation_id) {
      return NextResponse.json({ error: "conversation_id required" }, { status: 400 });
    }

    const db = createServiceClient();

    // Fetch conversation + messages + parent
    const { data: conversation } = await db
      .from("conversations")
      .select("id, triage, parent_id")
      .eq("id", conversation_id)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: "conversation not found" }, { status: 404 });
    }

    const [messagesRes, parentRes] = await Promise.all([
      db
        .from("messages")
        .select("role, content, created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at", { ascending: true }),

      conversation.parent_id
        ? db.from("parents").select("name").eq("id", conversation.parent_id).single()
        : Promise.resolve({ data: null }),
    ]);

    const messages = messagesRes.data ?? [];
    const triage = conversation.triage as Triage | null;

    // Pull relevant policies based on triage intent categories
    const policyCategories = (triage?.intent_categories ?? []).filter((c) =>
      DB_POLICY_CATEGORIES.includes(c),
    );

    let policies: Array<{ id: string; title: string; content: string; category: string }> = [];
    if (policyCategories.length > 0) {
      const { data } = await db
        .from("policies")
        .select("id, title, content, category")
        .in("category", policyCategories)
        .eq("status", "active");
      policies = data ?? [];
    }

    // Get child names from parent_child if parent is known
    let childNames: string[] = [];
    if (conversation.parent_id) {
      const { data: pc } = await db
        .from("parent_child")
        .select("children(name)")
        .eq("parent_id", conversation.parent_id);
      childNames = (pc ?? [])
        .flatMap((row) => {
          const c = row.children as { name: string } | { name: string }[] | null;
          if (!c) return [];
          return Array.isArray(c) ? c.map((x) => x.name) : [c.name];
        })
        .filter(Boolean);
    }

    const firstParentMsg = messages.find((m) => m.role === "parent");

    const { object: draft } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: operatorDraftSchema,
      system: operatorDraftSystemPrompt,
      prompt: buildOperatorDraftUserPrompt({
        parentQuestion: firstParentMsg?.content ?? "",
        parentName: parentRes.data?.name ?? null,
        childNames,
        policies,
        messageHistory: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    // Verify policy UUIDs are real
    const validIds = new Set(policies.map((p) => p.id));
    const verifiedPolicies = draft.policies_referenced
      .filter((id) => validIds.has(id))
      .map((id) => {
        const p = policies.find((pol) => pol.id === id)!;
        return { id: p.id, title: p.title };
      });

    return NextResponse.json({
      draft_reply: draft.draft_reply,
      policies_referenced: verifiedPolicies,
      notes_for_operator: draft.notes_for_operator,
    });
  } catch (error) {
    console.error("[operator/draft]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
