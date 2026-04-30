import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const operator = await getCurrentOperator();
    if (!operator) {
      return NextResponse.json({ error: "operator session required" }, { status: 401 });
    }

    const { id } = await params;
    const { action, edited_title, edited_content, edited_category } = await request.json();

    if (!["approve", "edit", "discard"].includes(action)) {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }

    const db = createServiceClient();

    const { data: policy } = await db
      .from("policies")
      .select("id, proposed_from_conversation_id")
      .eq("id", id)
      .single();

    if (!policy) {
      return NextResponse.json({ error: "policy not found" }, { status: 404 });
    }

    if (action === "discard") {
      await db.from("policies").update({ status: "archived" }).eq("id", id);

      if (policy.proposed_from_conversation_id) {
        await db
          .from("conversations")
          .update({ policy_proposal_status: "discarded" })
          .eq("id", policy.proposed_from_conversation_id);
      }

      return NextResponse.json({ id, status: "archived" });
    }

    // approve or edit
    const updates: Record<string, string> = { status: "active" };
    if (action === "edit") {
      if (edited_title) updates.title = edited_title;
      if (edited_content) updates.content = edited_content;
      if (edited_category) updates.category = edited_category;
    }

    const { data: updated } = await db
      .from("policies")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, status")
      .single();

    if (policy.proposed_from_conversation_id) {
      await db
        .from("conversations")
        .update({ policy_proposal_status: action === "edit" ? "edited" : "approved" })
        .eq("id", policy.proposed_from_conversation_id);
    }

    return NextResponse.json({ id: updated?.id ?? id, status: updated?.status ?? "active" });
  } catch (error) {
    console.error("[operator/policies/approve]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
