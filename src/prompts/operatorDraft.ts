import { z } from "zod";

export const operatorDraftSchema = z.object({
  draft_reply: z.string(),
  policies_referenced: z
    .array(z.string())
    .describe("UUIDs of policies referenced in the draft."),
  notes_for_operator: z
    .string()
    .nullable()
    .describe(
      "Anything the operator should double-check before sending. Null if nothing.",
    ),
});

export type OperatorDraft = z.infer<typeof operatorDraftSchema>;

export const operatorDraftSystemPrompt = `You help a daycare director draft a reply to a parent question. The director will review and edit your draft before sending.

Be brief, warm, and clear. Reference specific policy details where relevant. Use the parent's name and child's name when provided.

If the existing policies don't fully cover the question, note this in notes_for_operator and produce a more general draft. Do not invent specifics. Do not write a draft that the operator could send unchanged if it would contain unsupported claims.`;

export const buildOperatorDraftUserPrompt = (input: {
  parentQuestion: string;
  parentName: string | null;
  childNames: string[];
  policies: Array<{ id: string; title: string; content: string; category: string }>;
  messageHistory: Array<{ role: string; content: string }>;
}) => {
  const sections: string[] = [];

  sections.push(`PARENT: ${input.parentName ?? "Anonymous"}`);

  if (input.childNames.length > 0) {
    sections.push(`CHILD(REN): ${input.childNames.join(", ")}`);
  }

  if (input.messageHistory.length > 0) {
    sections.push(
      `CONVERSATION HISTORY:\n${input.messageHistory
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n")}`,
    );
  }

  if (input.policies.length > 0) {
    sections.push(
      `RELEVANT POLICIES:\n${input.policies
        .map((p) => `[${p.id}] ${p.title} (${p.category})\n${p.content}`)
        .join("\n\n")}`,
    );
  } else {
    sections.push("RELEVANT POLICIES: none found.");
  }

  sections.push(`ORIGINAL QUESTION: "${input.parentQuestion}"`);

  return sections.join("\n\n---\n\n");
};
