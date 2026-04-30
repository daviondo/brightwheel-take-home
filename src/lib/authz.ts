import { createServiceClient } from "./supabase/server";

/** Returns the child IDs this parent is authorized to see. */
export async function getAuthorizedChildIds(parentId: string): Promise<string[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("parent_child")
    .select("child_id")
    .eq("parent_id", parentId);

  return (data ?? []).map((row) => row.child_id);
}

export interface DailyLog {
  id: string;
  child_id: string;
  child_name: string;
  log_date: string;
  meals: unknown;
  naps: unknown;
  mood: string | null;
  diaper_changes: number | null;
  notes: string | null;
}

/**
 * Returns daily logs for the child IDs the parent is authorized to see.
 * Filters strictly — never accepts an arbitrary child_id list.
 */
export async function getAuthorizedDailyLogs(
  parentId: string,
  dateISO: string,
): Promise<DailyLog[]> {
  const childIds = await getAuthorizedChildIds(parentId);
  if (childIds.length === 0) return [];

  const db = createServiceClient();
  const { data } = await db
    .from("daily_logs")
    .select("*, children(name)")
    .in("child_id", childIds)
    .eq("log_date", dateISO);

  return (data ?? []).map((row) => ({
    id: row.id,
    child_id: row.child_id,
    child_name: (row.children as { name: string } | null)?.name ?? "Unknown",
    log_date: row.log_date,
    meals: row.meals,
    naps: row.naps,
    mood: row.mood,
    diaper_changes: row.diaper_changes,
    notes: row.notes,
  }));
}
