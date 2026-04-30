import Link from "next/link";
import { Plus, Sparkles, BookOpen, PenLine, Sprout } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

type PolicyStatus = "active" | "draft" | "archived";
type PolicySource = "seeded" | "authored" | "proposed_by_ai";

interface Policy {
  id: string;
  category: string;
  title: string;
  content: string;
  source: PolicySource;
  status: PolicyStatus;
}

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
  other: "Other",
};

const SOURCE_CONFIG: Record<PolicySource, { label: string; icon: React.ReactNode; className: string }> = {
  seeded: {
    label: "Seeded",
    icon: <Sprout className="h-3 w-3" />,
    className: "bg-muted/50 text-muted-fg",
  },
  authored: {
    label: "Authored",
    icon: <PenLine className="h-3 w-3" />,
    className: "bg-blue-50 text-blue-700",
  },
  proposed_by_ai: {
    label: "Proposed by AI",
    icon: <Sparkles className="h-3 w-3" />,
    className: "bg-primary/10 text-primary",
  },
};

async function getPoliciesData(status?: string) {
  const db = createServiceClient();

  let query = db
    .from("policies")
    .select("id, category, title, content, source, status")
    .order("category", { ascending: true })
    .order("title", { ascending: true });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const [{ data: policies }, { count: activeCount }, { count: aiCount }] = await Promise.all([
    query,
    db
      .from("policies")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    db
      .from("policies")
      .select("id", { count: "exact", head: true })
      .eq("source", "proposed_by_ai")
      .eq("status", "active"),
  ]);

  return { policies: (policies ?? []) as Policy[], activeCount: activeCount ?? 0, aiCount: aiCount ?? 0 };
}

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const currentStatus = status ?? "active";
  const { policies, activeCount, aiCount } = await getPoliciesData(currentStatus);

  // Group by category
  const grouped = policies.reduce<Record<string, Policy[]>>((acc, p) => {
    const key = p.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const filterTabs = [
    { label: "Active", value: "active" },
    { label: "Draft", value: "draft" },
    { label: "Archived", value: "archived" },
    { label: "All", value: "all" },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Policies</h2>
        <Link
          href="/operator/policies/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Policy
        </Link>
      </div>

      {/* Stats */}
      <p className="mb-5 text-sm text-muted-fg">
        {activeCount} active {activeCount === 1 ? "policy" : "policies"}.{" "}
        {aiCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {aiCount} came from your conversations.
          </span>
        )}
      </p>

      {/* Filter chips */}
      <div className="mb-5 flex gap-2">
        {filterTabs.map(({ label, value }) => {
          const active = currentStatus === value;
          const href = `/operator/policies${value !== "active" ? `?status=${value}` : ""}`;
          return (
            <Link
              key={value}
              href={href}
              className={[
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-white"
                  : "bg-muted/30 text-muted-fg hover:bg-muted/50",
              ].join(" ")}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Empty state for AI-proposed filter */}
      {policies.length === 0 && currentStatus === "draft" ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-fg">
          <Sparkles className="h-10 w-10 opacity-30" />
          <p className="font-medium">Policies you approve from your conversations will show up here.</p>
          <p className="text-sm">The more questions you answer, the smarter the AI gets.</p>
        </div>
      ) : policies.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-fg">
          <BookOpen className="h-10 w-10 opacity-30" />
          <p className="font-medium">No policies found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-fg">
                {CATEGORY_LABELS[category] ?? category}
              </h3>
              <ul className="space-y-2">
                {items.map((policy) => {
                  const src = SOURCE_CONFIG[policy.source] ?? SOURCE_CONFIG.authored;
                  const firstSentence = policy.content.split(/[.!?]/)[0]?.trim() ?? "";
                  return (
                    <li key={policy.id}>
                      <Link
                        href={`/operator/policies/${policy.id}`}
                        className="block rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <span className="font-medium text-sm text-foreground">{policy.title}</span>
                          <span
                            className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${src.className}`}
                          >
                            {src.icon}
                            {src.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-fg line-clamp-1">
                          {firstSentence}{firstSentence ? "." : ""}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
