import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const operator = await getCurrentOperator();
    if (!operator) {
      return NextResponse.json({ error: "operator session required" }, { status: 401 });
    }

    const { id } = await params;
    const { category, title, content, status } = await request.json();

    const db = createServiceClient();
    const updates: Record<string, string> = { updated_at: new Date().toISOString() };
    if (category) updates.category = category;
    if (title) updates.title = title.trim();
    if (content) updates.content = content.trim();
    if (status) updates.status = status;

    const { data, error } = await db
      .from("policies")
      .update(updates)
      .eq("id", id)
      .select("id, category, title, content, source, status")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "policy not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[policies PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
