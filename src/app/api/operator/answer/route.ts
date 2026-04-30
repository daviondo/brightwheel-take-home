import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/lib/auth";
import {
  policyProposalSchema,
  policyProposalSystemPrompt,
  buildPolicyProposalUserPrompt,
} from "@/prompts/proposePolicy";

export async function POST(request: NextRequest) {
  try {
    const operator = await getCurrentOperator();
    if (!operator) {
      return NextResponse.json({ error: "operator session required" }, { status: 401 });
    }

    const { conversation_id, answer } = await request.json();
    if (!conversation_id || !answer?.trim()) {
      return NextResponse.json(
        { error: "conversation_id and answer are required" },
        { status: 400 },
      );
    }

    const db = createServiceClient();

    const { data: conversation } = await db
      .from("conversations")
      .select("id, status")
      .eq("id", conversation_id)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: "conversation not found" }, { status: 404 });
    }

    // Insert operator message
    const { data: message, error: msgErr } = await db
      .from("messages")
      .insert({
        conversation_id,
        role: "operator",
        content: answer.trim(),
        operator_id: operator.id,
      })
      .select("id")
      .single();

    if (msgErr || !message) {
      throw new Error(`insert operator message: ${msgErr?.message}`);
    }

    // Update conversation status
    await db
      .from("conversations")
      .update({ status: "answered_by_operator", last_message_at: new Date().toISOString() })
      .eq("id", conversation_id);

    // Get original parent question + existing policy titles for proposal LLM
    const [firstParentMsgRes, existingPoliciesRes] = await Promise.all([
      db
        .from("messages")
        .select("content")
        .eq("conversation_id", conversation_id)
        .eq("role", "parent")
        .order("created_at", { ascending: true })
        .limit(1)
        .single(),

      db.from("policies").select("id, title, category").eq("status", "active"),
    ]);

    const originalQuestion = firstParentMsgRes.data?.content ?? "";
    const existingPolicies = existingPoliciesRes.data ?? [];

    // Call policy-proposal LLM
    const { object: proposal } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: policyProposalSchema,
      system: policyProposalSystemPrompt,
      prompt: buildPolicyProposalUserPrompt({
        question: originalQuestion,
        operatorAnswer: answer.trim(),
        existingPolicies,
      }),
    });

    // If proposing, insert draft policy and back-link conversation
    let proposedPolicyRecord: { id: string; category: string; title: string; content: string } | null = null;

    if (proposal.propose && proposal.proposed_policy) {
      const p = proposal.proposed_policy;
      const { data: newPolicy, error: policyErr } = await db
        .from("policies")
        .insert({
          category: p.category,
          title: p.title,
          content: p.content,
          status: "draft",
          source: "proposed_by_ai",
          proposed_from_conversation_id: conversation_id,
          created_by_operator: operator.id,
        })
        .select("id, category, title, content")
        .single();

      if (policyErr || !newPolicy) {
        console.error("[operator/answer] insert draft policy:", policyErr?.message);
      } else {
        proposedPolicyRecord = newPolicy;
        await db
          .from("conversations")
          .update({ proposed_policy_id: newPolicy.id, policy_proposal_status: "pending" })
          .eq("id", conversation_id);
      }
    }

    return NextResponse.json({
      message_id: message.id,
      policy_proposal: {
        propose: proposal.propose,
        reason: proposal.reason,
        proposed: proposedPolicyRecord,
      },
    });
  } catch (error) {
    console.error("[operator/answer]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
