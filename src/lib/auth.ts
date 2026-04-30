import { cookies } from "next/headers";
import { createServiceClient } from "./supabase/server";

export async function getCurrentParent(): Promise<{
  id: string;
  name: string;
} | null> {
  const cookieStore = await cookies();
  const parentId = cookieStore.get("demo_parent_id")?.value;
  if (!parentId) return null;

  const db = createServiceClient();
  const { data } = await db
    .from("parents")
    .select("id, name")
    .eq("id", parentId)
    .single();

  return data ?? null;
}

export async function getCurrentOperator(): Promise<{
  id: string;
  name: string;
} | null> {
  const cookieStore = await cookies();
  const operatorId = cookieStore.get("demo_operator_id")?.value;
  if (!operatorId) return null;

  const db = createServiceClient();
  const { data } = await db
    .from("operators")
    .select("id, name")
    .eq("id", operatorId)
    .single();

  return data ?? null;
}
