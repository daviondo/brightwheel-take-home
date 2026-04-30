import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentParent } from "@/lib/auth";
import { getAuthorizedChildIds, getAuthorizedDailyLogs } from "@/lib/authz";
import { CENTER } from "@/lib/center-config";
import {
  triageSchema,
  triageSystemPrompt,
  buildTriageUserPrompt,
  type Triage,
} from "@/prompts/triage";
import {
  answerSchema,
  answerSystemPrompt,
  buildAnswerUserPrompt,
} from "@/prompts/answer";

// Policy categories that exist in the DB (excludes triage-only 'child_daily_activity')
const DB_POLICY_CATEGORIES = [
  "hours_holidays",
  "tuition_fees",
  "illness_health",
  "meals_nutrition",
  "pickup_dropoff",
  "allergies",
  "enrollment_admissions",
  "special_events",
  "discipline_behavior",
  "communication",
  "other",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, conversation_id } = body as {
      question: string;
      conversation_id?: string;
    };

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const db = createServiceClient();
    const parent = await getCurrentParent();
    const parentId = parent?.id ?? null;

    // ── Step 2: Conversation resolution ──────────────────────────────────────
    let conversation: Record<string, unknown> | null = null;
    let isNewConversation = true;

    if (conversation_id) {
      const { data: existing } = await db
        .from("conversations")
        .select("*")
        .eq("id", conversation_id)
        .single();

      if (!existing) {
        return NextResponse.json({ error: "conversation not found" }, { status: 404 });
      }

      if (existing.parent_id !== parentId) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }

      if (existing.status === "awaiting_clarification") {
        conversation = existing;
        isNewConversation = false;
      }
    }

    if (!conversation) {
      const { data: newConv, error: convErr } = await db
        .from("conversations")
        .insert({ parent_id: parentId, status: "answered" })
        .select()
        .single();
      if (convErr || !newConv) throw new Error(`create conversation: ${convErr?.message}`);
      conversation = newConv;
      isNewConversation = true;
    }

    if (!conversation) throw new Error("conversation unexpectedly null");
    const convId = conversation.id as string;

    // ── Step 3: Insert parent message ─────────────────────────────────────────
    const { data: parentMsg, error: parentMsgErr } = await db
      .from("messages")
      .insert({ conversation_id: convId, role: "parent", content: question.trim() })
      .select("id")
      .single();
    if (parentMsgErr) throw new Error(`insert parent message: ${parentMsgErr.message}`);

    // ── Step 4: Triage ────────────────────────────────────────────────────────
    let triage: Triage;

    if (!isNewConversation && conversation.triage) {
      triage = conversation.triage as Triage;
    } else {
      const { object } = await generateObject({
        model: anthropic("claude-sonnet-4-6"),
        schema: triageSchema,
        system: triageSystemPrompt,
        prompt: buildTriageUserPrompt(question),
      });
      triage = object;

      await db
        .from("conversations")
        .update({ triage })
        .eq("id", convId);
    }

    // ── Step 5a: Out-of-scope gate ────────────────────────────────────────────
    if (!triage.in_scope) {
      const content =
        "I can help with questions about Sunshine Preschool. For other questions, I'm not the right tool — try asking me about hours, tuition, illness policies, or your child's day.";

      const { data: aiMsg } = await db
        .from("messages")
        .insert({
          conversation_id: convId,
          role: "ai",
          content,
          ai_confidence: "high",
          ai_confidence_reason: "Out of scope — redirecting.",
          awaiting_clarification: false,
        })
        .select("id")
        .single();

      await db
        .from("conversations")
        .update({ status: "answered", last_message_at: new Date().toISOString() })
        .eq("id", convId);

      return NextResponse.json({
        conversation_id: convId,
        message: {
          id: aiMsg!.id,
          role: "ai",
          content,
          confidence: "high",
          awaiting_clarification: false,
          policies_cited: [],
        },
        conversation_status: "answered",
        urgency: "standard",
        requires_signin: false,
      });
    }

    // ── Step 5b: Requires sign-in gate ────────────────────────────────────────
    if (triage.requires_personal_data && !parentId) {
      return NextResponse.json({
        conversation_id: convId,
        requires_signin: true,
        conversation_status: "answered",
        urgency: triage.urgency,
      });
    }

    // ── Step 6: Retrieve grounding ────────────────────────────────────────────
    const policyCategories = triage.intent_categories.filter((c) =>
      DB_POLICY_CATEGORIES.includes(c),
    );

    let policies: Array<{
      id: string;
      title: string;
      content: string;
      category: string;
    }> = [];

    if (policyCategories.length > 0) {
      const { data } = await db
        .from("policies")
        .select("id, title, content, category")
        .in("category", policyCategories)
        .eq("status", "active");
      policies = data ?? [];
    }

    let childContext: Array<{
      name: string;
      ageGroup: string;
      allergies: string[];
    }> = [];
    let todaysLogs: Array<{
      childName: string;
      date: string;
      meals: unknown;
      naps: unknown;
      mood: string;
      notes: string;
      diaperChanges: number;
    }> = [];

    if (parentId && triage.requires_personal_data) {
      const authorizedChildIds = await getAuthorizedChildIds(parentId);

      if (authorizedChildIds.length > 0) {
        const { data: childData } = await db
          .from("children")
          .select("id, name, age_group, allergies")
          .in("id", authorizedChildIds);

        childContext = (childData ?? []).map((c) => ({
          name: c.name,
          ageGroup: c.age_group,
          allergies: (c.allergies as string[]) ?? [],
        }));

        const today = new Date().toISOString().split("T")[0];
        const logs = await getAuthorizedDailyLogs(parentId, today);
        todaysLogs = logs.map((l) => ({
          childName: l.child_name,
          date: l.log_date,
          meals: l.meals,
          naps: l.naps,
          mood: l.mood ?? "",
          notes: l.notes ?? "",
          diaperChanges: l.diaper_changes ?? 0,
        }));

        // Audit trail
        await db
          .from("conversations")
          .update({ authorized_child_ids: authorizedChildIds })
          .eq("id", convId);

        // Check if the referenced child name is authorized
        if (triage.referenced_child_name) {
          const matched = (childData ?? []).find((c) =>
            c.name.toLowerCase().startsWith(
              triage.referenced_child_name!.toLowerCase(),
            ),
          );
          await db
            .from("conversations")
            .update({ referenced_child_id: matched?.id ?? null })
            .eq("id", convId);
        }
      }
    }

    // ── Step 7: Early escalation (no grounding at all) ────────────────────────
    if (policies.length === 0 && todaysLogs.length === 0) {
      const content = `I don't have information that covers your question. Let me get this to ${CENTER.director}, our director — she'll get back to you.`;

      const { data: aiMsg } = await db
        .from("messages")
        .insert({
          conversation_id: convId,
          role: "ai",
          content,
          ai_confidence: "low",
          ai_confidence_reason: "No relevant policies or data found.",
          awaiting_clarification: false,
        })
        .select("id")
        .single();

      await db
        .from("conversations")
        .update({
          status: "awaiting_operator",
          urgency: triage.urgency,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", convId);

      return NextResponse.json({
        conversation_id: convId,
        message: {
          id: aiMsg!.id,
          role: "ai",
          content,
          confidence: "low",
          awaiting_clarification: false,
          policies_cited: [],
        },
        conversation_status: "awaiting_operator",
        urgency: triage.urgency,
        requires_signin: false,
      });
    }

    // ── Step 8: Recent messages (continuations only) ──────────────────────────
    let recentMessages: Array<{ role: string; content: string }> = [];

    if (!isNewConversation) {
      const { data: history } = await db
        .from("messages")
        .select("role, content, id")
        .eq("conversation_id", convId)
        .neq("id", parentMsg!.id)
        .order("created_at", { ascending: true })
        .limit(6);

      recentMessages = (history ?? []).map((m) => ({
        role: m.role,
        content: m.content,
      }));
    }

    // ── Step 9: Answer LLM ────────────────────────────────────────────────────
    const { object: answer } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: answerSchema,
      system: answerSystemPrompt({ centerName: CENTER.name, directorName: CENTER.director }),
      prompt: buildAnswerUserPrompt({
        question,
        parentName: parent?.name ?? null,
        childContext,
        todaysLogs,
        policies,
        recentMessages,
      }),
    });

    // ── Step 10: Deterministic source verification ────────────────────────────
    const validPolicyIds = new Set(policies.map((p) => p.id));
    let confidence = answer.confidence;
    let shouldEscalate = answer.should_escalate;
    let escalationReason = answer.escalation_reason;

    const verifiedSourceIds = answer.sources_used.filter((id) => {
      if (!validPolicyIds.has(id)) {
        console.warn(`[chat/source-check] AI cited policy ID not in context: ${id}`);
        confidence = "low";
        shouldEscalate = true;
        escalationReason =
          (escalationReason ?? "") +
          " AI cited a policy ID not in its context — escalating for human review.";
        return false;
      }
      return true;
    });

    // ── Step 11: Sensitive-intent override ────────────────────────────────────
    if (triage.sensitivity !== "none") {
      shouldEscalate = true;
      escalationReason =
        escalationReason ??
        `Sensitive topic (${triage.sensitivity}) — requires human confirmation.`;
    }

    // ── Step 12: Clarification handling ───────────────────────────────────────
    const awaitingClarification = answer.awaiting_clarification;
    if (awaitingClarification) {
      shouldEscalate = false;
    }

    // ── Step 13: Insert AI message ────────────────────────────────────────────
    const { data: aiMsg } = await db
      .from("messages")
      .insert({
        conversation_id: convId,
        role: "ai",
        content: answer.answer,
        ai_confidence: confidence,
        ai_confidence_reason: answer.confidence_reason,
        policies_cited: verifiedSourceIds,
        awaiting_clarification: awaitingClarification,
      })
      .select("id")
      .single();

    // ── Step 14: Update conversation ──────────────────────────────────────────
    const conversationStatus = awaitingClarification
      ? "awaiting_clarification"
      : shouldEscalate
        ? "awaiting_operator"
        : "answered";

    const updatePayload: Record<string, unknown> = {
      status: conversationStatus,
      last_message_at: new Date().toISOString(),
    };
    if (isNewConversation) {
      updatePayload.urgency = triage.urgency;
    }

    await db.from("conversations").update(updatePayload).eq("id", convId);

    // ── Step 15: Return ───────────────────────────────────────────────────────
    const policiesCited = verifiedSourceIds
      .map((id) => policies.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => ({ id: p!.id, title: p!.title }));

    return NextResponse.json({
      conversation_id: convId,
      message: {
        id: aiMsg!.id,
        role: "ai",
        content: answer.answer,
        confidence,
        awaiting_clarification: awaitingClarification,
        policies_cited: policiesCited,
      },
      conversation_status: conversationStatus,
      urgency: triage.urgency,
      requires_signin: false,
    });
  } catch (error) {
    console.error("[chat] Unhandled error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
