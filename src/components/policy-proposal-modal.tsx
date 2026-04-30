"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

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

const DB_CATEGORIES = Object.keys(CATEGORY_LABELS);

interface Proposal {
  id: string;
  category: string;
  title: string;
  content: string;
}

interface Props {
  proposal: Proposal;
  reason: string;
  open: boolean;
  onClose: () => void;
}

export function PolicyProposalModal({ proposal, reason, open, onClose }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState(proposal.category);
  const [title, setTitle] = useState(proposal.title);
  const [content, setContent] = useState(proposal.content);
  const [isPending, setIsPending] = useState(false);

  const hasEdits =
    category !== proposal.category ||
    title !== proposal.title ||
    content !== proposal.content;

  async function submit(action: "approve" | "edit" | "discard") {
    setIsPending(true);
    try {
      const body: Record<string, string> = { action };
      if (action === "edit") {
        body.edited_title = title;
        body.edited_content = content;
        body.edited_category = category;
      }

      const res = await fetch(`/api/operator/policies/${proposal.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Request failed");

      if (action === "discard") {
        toast("Skipped.");
      } else {
        toast("Added to your knowledge base. Future parents asking about this will get a confident answer.");
      }

      onClose();
      router.push("/operator");
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setIsPending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start gap-3 border-b px-6 py-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
            <BookPlus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Should this become a policy?
            </h2>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-fg">
              <Sparkles className="h-3 w-3" />
              {reason}
            </p>
          </div>
        </div>

        {/* Editable fields */}
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="pol-category" className="text-sm font-medium">
              Category
            </Label>
            <select
              id="pol-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {DB_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pol-title" className="text-xs font-medium">
              Title
            </Label>
            <Input
              id="pol-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pol-content" className="text-xs font-medium">
              Policy text
            </Label>
            <Textarea
              id="pol-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] resize-none text-base leading-relaxed"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t px-6 pb-6 pt-4 sm:flex-row sm:items-center">
          <Button
            onClick={() => submit(hasEdits ? "edit" : "approve")}
            disabled={isPending || !title.trim() || !content.trim()}
            className="sm:flex-1"
          >
            {hasEdits ? "Edit & Approve" : "Approve as-is"}
          </Button>
          <Button
            variant="outline"
            onClick={() => submit("discard")}
            disabled={isPending}
            className="sm:flex-none text-muted-fg"
          >
            Skip this time
          </Button>
        </div>
      </div>
    </div>
  );
}
