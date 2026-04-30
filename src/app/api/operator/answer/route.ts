import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/lib/auth";

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

    // Verify conversation exists
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
      .update({
        status: "answered_by_operator",
        last_message_at: new Date().toISOString(),
      })
      .eq("id", conversation_id);

    // Policy proposal is added in M4 — stub for now
    return NextResponse.json({
      message_id: message.id,
      policy_proposal: {
        propose: false,
        reason: "Policy proposal not yet implemented.",
        proposed: null,
      },
    });
  } catch (error) {
    console.error("[operator/answer]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
