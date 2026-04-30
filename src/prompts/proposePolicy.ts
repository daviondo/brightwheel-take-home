import { z } from "zod";
import { POLICY_CATEGORIES } from "./triage";

export const policyProposalSchema = z.object({
  propose: z.boolean(),
  reason: z.string().describe("Why proposing or not proposing. 1-2 sentences."),
  proposed_policy: z
    .object({
      category: z.enum(POLICY_CATEGORIES),
      title: z.string().describe('Short, declarative. E.g., "Sick Child Exclusion: Pink Eye".'),
      content: z
        .string()
        .describe(
          "Full policy text in operator voice. 2-5 sentences. Strip personal references; make it generally applicable.",
        ),
      similar_existing_policy_id: z
        .string()
        .nullable()
        .describe(
          "If this overlaps with an existing policy that should be merged or replaced, the UUID of that policy. Otherwise null.",
        ),
    })
    .nullable(),
});

export type PolicyProposal = z.infer<typeof policyProposalSchema>;

export const policyProposalSystemPrompt = `You read a parent question and the operator's reply to it. You decide whether the reply represents a generalizable policy that should join the knowledge base.

Be CONSERVATIVE. Better to skip a borderline case than over-codify a one-off response.

Return propose: false when:
- The reply is specific to one parent or child ("Yes, Emma can have her medication today")
- The reply is a one-time logistical accommodation ("we'll have lunch ready for him today")
- The reply is conversational rather than informational ("thanks for letting us know!")
- The information is already fully covered by an existing policy with no new content

Return propose: true when:
- The reply states a general rule, schedule, fee, or expectation that applies broadly to all families
- It would help future parents asking similar questions
- It's stable enough that it won't change weekly

When proposing, write the policy in the operator's voice — clear, neutral, declarative. Strip personal references. The operator will review and edit before publishing.`;

export const buildPolicyProposalUserPrompt = (input: {
  question: string;
  operatorAnswer: string;
  existingPolicies: Array<{ id: string; title: string; category: string }>;
}) => `PARENT QUESTION: "${input.question}"

OPERATOR'S REPLY: "${input.operatorAnswer}"

EXISTING POLICIES (titles only, for overlap detection):
${input.existingPolicies.map((p) => `- [${p.id}] ${p.title} (${p.category})`).join("\n") || "(none yet)"}

Should this answer become a policy?`;
