import { MessageSquare, CheckCircle2, AlertCircle, BarChart2 } from "lucide-react";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { type Triage } from "@/prompts/triage";

const CATEGORY_LABELS: Record<string, string> = {
  hours_holidays: "Hours & Holidays",
  tuition_fees: "Tuition & Fees",
  illness_health: "Illness & Health",
  meals_nutrition: "Meals & Nutrition",
  pickup_dropoff: "Pickup & Drop-off",
  allergies: "Allergies",
  enrollment_admissions: "Enrollment & Admissions",
  special_events: "Special Events",
  discipline_behavior: "Discipline & Behavior",
  communication: "Communication",
  child_daily_activity: "Child Daily Activity",
  other: "Other",
};

async function getActivityData() {
  const db = createServiceClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [todayRes, weekRes, parentsRes] = await Promise.all([
    db
      .from("conversations")
      .select("id, status, urgency, triage, parent_id, created_at, last_message_at")
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false }),

    db
      .from("conversations")
      .select("triage")
      .gte("created_at", weekAgo),

    db.from("parents").select("id, name"),
  ]);

  const convs = todayRes.data ?? [];
  const parentMap = Object.fromEntries(
    (parentsRes.data ?? []).map((p) => [p.id, p.name]),
  );

  const total = convs.length;
  const answeredConfidently = convs.filter((c) => c.status === "answered").length;
  const neededHelp = convs.filter(
    (c) => c.status === "awaiting_operator" || c.status === "answered_by_operator",
  ).length;

  // Top 3 categories this week
  const categoryCounts: Record<string, number> = {};
  (weekRes.data ?? []).forEach((c) => {
    const triage = c.triage as Triage | null;
    (triage?.intent_categories ?? []).forEach((cat) => {
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    });
  });
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return { convs, parentMap, total, answeredConfidently, neededHelp, topCategories };
}

function statusLabel(status: string) {
  const labels: Record<string, { text: string; className: string }> = {
    answered: { text: "Answered by AI", className: "text-green-700 bg-green-50" },
    awaiting_operator: { text: "Awaiting reply", className: "text-accent bg-accent/10" },
    answered_by_operator: { text: "Answered by you", className: "text-blue-700 bg-blue-50" },
    awaiting_clarification: { text: "Awaiting parent", className: "text-yellow-700 bg-yellow-50" },
    closed: { text: "Closed", className: "text-muted-fg bg-muted/30" },
  };
  return labels[status] ?? { text: status, className: "text-muted-fg bg-muted/30" };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default async function ActivityPage() {
  const { convs, parentMap, total, answeredConfidently, neededHelp, topCategories } =
    await getActivityData();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h2 className="mb-5 text-xl font-semibold">Activity</h2>

      {/* Today's stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm text-center">
          <div className="mb-1 flex items-center justify-center gap-1.5 text-muted-fg">
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs font-medium">Today</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{total}</p>
          <p className="text-xs text-muted-fg">question{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm text-center">
          <div className="mb-1 flex items-center justify-center gap-1.5 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-medium">AI handled</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{answeredConfidently}</p>
          <p className="text-xs text-muted-fg">confidently</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm text-center">
          <div className="mb-1 flex items-center justify-center gap-1.5 text-accent">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Needed you</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{neededHelp}</p>
          <p className="text-xs text-muted-fg">escalated</p>
        </div>
      </div>

      {/* Top categories this week */}
      {topCategories.length > 0 && (
        <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <BarChart2 className="h-4 w-4 text-muted-fg" />
            Most asked this week
          </div>
          <div className="space-y-2">
            {topCategories.map(([cat, count], i) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="w-4 text-xs font-semibold text-muted-fg">{i + 1}</span>
                <span className="flex-1 text-sm text-foreground">
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
                <span className="text-xs text-muted-fg">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's conversations */}
      <h3 className="mb-3 text-sm font-semibold text-muted-fg uppercase tracking-wider">
        Today's conversations
      </h3>

      {convs.length === 0 ? (
        <div className="py-12 text-center text-muted-fg text-sm">
          No conversations yet today.
        </div>
      ) : (
        <ul className="space-y-2">
          {convs.map((conv) => {
            const triage = conv.triage as Triage | null;
            const s = statusLabel(conv.status);
            return (
              <li key={conv.id}>
                <Link
                  href={`/operator/conversation/${conv.id}`}
                  className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {conv.parent_id ? (parentMap[conv.parent_id] ?? "Anonymous") : "Anonymous"}
                      {triage?.referenced_child_name && (
                        <span className="ml-1 font-normal text-muted-fg">
                          re: {triage.referenced_child_name}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-fg">
                      {triage?.intent_categories?.map((c) => CATEGORY_LABELS[c] ?? c).join(", ")}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}
                  >
                    {s.text}
                  </span>
                  <span className="flex-shrink-0 text-xs text-muted-fg">
                    {timeAgo(conv.created_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
