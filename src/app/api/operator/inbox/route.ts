import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { type Triage } from "@/prompts/triage";

export async function GET(request: NextRequest) {
  try {
    const db = createServiceClient();
    const { searchParams } = new URL(request.url);
    const urgencyFilter = searchParams.get("urgency") as
      | "high"
      | "standard"
      | null;

    // Fetch awaiting conversations — 'high' < 'standard' alphabetically, so asc puts high first
    let query = db
      .from("conversations")
      .select("id, urgency, triage, last_message_at, parent_id")
      .eq("status", "awaiting_operator")
      .order("urgency", { ascending: true })
      .order("last_message_at", { ascending: true });

    if (urgencyFilter) {
      query = query.eq("urgency", urgencyFilter);
    }

    const { data: conversations, error } = await query;
    if (error) throw new Error(error.message);

    const convIds = (conversations ?? []).map((c) => c.id);
    const parentIds = [
      ...new Set(
        (conversations ?? [])
          .map((c) => c.parent_id)
          .filter(Boolean) as string[],
      ),
    ];

    // Fetch supporting data in parallel
    const [messagesRes, parentsRes, answeredCountRes] = await Promise.all([
      convIds.length > 0
        ? db
            .from("messages")
            .select("id, conversation_id, role, content, ai_confidence, created_at")
            .in("conversation_id", convIds)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),

      parentIds.length > 0
        ? db.from("parents").select("id, name").in("id", parentIds)
        : Promise.resolve({ data: [] }),

      db
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("status", "answered"),
    ]);

    const messages = messagesRes.data ?? [];
    const parentMap = Object.fromEntries(
      (parentsRes.data ?? []).map((p) => [p.id, p.name]),
    );

    // Build inbox items
    const items = (conversations ?? []).map((conv) => {
      const convMessages = messages.filter(
        (m) => m.conversation_id === conv.id,
      );
      const firstParentMsg = convMessages.find((m) => m.role === "parent");
      const lastAiMsg = [...convMessages]
        .reverse()
        .find((m) => m.role === "ai");
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

    // Counts
    const highCount = (conversations ?? []).filter(
      (c) => c.urgency === "high",
    ).length;
    const standardCount = (conversations ?? []).filter(
      (c) => c.urgency === "standard",
    ).length;

    return NextResponse.json({
      items,
      counts: {
        high: highCount,
        standard: standardCount,
        total: items.length,
      },
      answered_count: answeredCountRes.count ?? 0,
    });
  } catch (error) {
    console.error("[operator/inbox]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
