"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

interface Policy {
  id: string;
  category: string;
  title: string;
  content: string;
  source: string;
  status: string;
}

interface Props {
  policy: Policy;
  isNew?: boolean;
}

export function PolicyEditor({ policy, isNew = false }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState(policy.category);
  const [title, setTitle] = useState(policy.title);
  const [content, setContent] = useState(policy.content);
  const [isSaving, startSave] = useTransition();
  const [isArchiving, startArchive] = useTransition();

  async function handleSave() {
    startSave(async () => {
      const url = isNew ? "/api/policies" : `/api/policies/${policy.id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title: title.trim(), content: content.trim() }),
      });

      if (!res.ok) {
        toast.error("Failed to save. Try again.");
        return;
      }

      toast("Policy saved.");
      router.push("/operator/policies");
      router.refresh();
    });
  }

  async function handleArchive() {
    startArchive(async () => {
      const res = await fetch(`/api/policies/${policy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });

      if (!res.ok) {
        toast.error("Failed to archive. Try again.");
        return;
      }

      toast("Policy archived.");
      router.push("/operator/policies");
      router.refresh();
    });
  }

  const isPending = isSaving || isArchiving;
  const canSave = title.trim().length > 0 && content.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h2 className="mb-6 text-xl font-semibold">{isNew ? "New Policy" : "Edit Policy"}</h2>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="category" className="text-sm font-medium">
            Category
          </Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-sm font-medium">
            Title
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short, declarative title"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="content" className="text-sm font-medium">
            Policy text
          </Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write the policy in clear, parent-facing language…"
            className="min-h-[180px] resize-y text-sm leading-relaxed"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={isPending || !canSave}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          {!isNew && policy.status !== "archived" && (
            <Button
              variant="outline"
              onClick={handleArchive}
              disabled={isPending}
              className="ml-auto text-muted-fg hover:text-foreground"
            >
              {isArchiving ? "Archiving…" : "Archive"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
