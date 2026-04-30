import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const operator = await getCurrentOperator();
    if (!operator) {
      return NextResponse.json({ error: "operator session required" }, { status: 401 });
    }

    const db = createServiceClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");

    let query = db
      .from("policies")
      .select("id, category, title, content, source, status, created_at, updated_at")
      .order("category", { ascending: true })
      .order("title", { ascending: true });

    if (status) query = query.eq("status", status);
    if (category) query = query.eq("category", category);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ policies: data ?? [] });
  } catch (error) {
    console.error("[policies GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const operator = await getCurrentOperator();
    if (!operator) {
      return NextResponse.json({ error: "operator session required" }, { status: 401 });
    }

    const { category, title, content } = await request.json();
    if (!category || !title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "category, title, and content are required" }, { status: 400 });
    }

    const db = createServiceClient();
    const { data, error } = await db
      .from("policies")
      .insert({
        category,
        title: title.trim(),
        content: content.trim(),
        status: "active",
        source: "authored",
        created_by_operator: operator.id,
      })
      .select("id, category, title, content, source, status")
      .single();

    if (error || !data) throw new Error(error?.message);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("[policies POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
