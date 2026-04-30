# Sunshine Preschool AI Front Desk

A Claude-powered chat experience where parents ask routine questions about a fictional preschool and the AI either answers from grounded policies or escalates to the director. The director replies and can promote her answer into a new policy — an operator-in-the-loop teaching loop that makes the system smarter over time without retraining a model.

**Live demo:** https://brightwheel.davidpair.com

---

## Running locally

```bash
# 1. Install dependencies
pnpm install

# 2. Set environment variables
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#          SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

# 3. Apply the database migration
# In your Supabase project: SQL Editor → paste supabase/migrations/0001_init.sql → Run

# 4. Seed the database
npx tsx scripts/seed.ts

# 5. Start the dev server
pnpm dev

# 6. Run the eval harness (requires dev server running on port 3000)
pnpm test
```

---

## Architecture

```
Parent sends question
  → POST /api/chat
      → Triage LLM: classify intent, urgency, sensitivity
          → if out of scope        → polite redirect, no answer LLM called
          → if needs sign-in       → return requires_signin: true
      → Pull relevant policies from DB (by triage intent_categories)
      → Pull authorized daily logs (if personalized question)
      → Answer LLM: grounded on policies + child data only
      → Deterministic source verification
          → any cited policy UUID not in the prompt → force low confidence + escalate
      → Sensitive intent override → always escalate (medical, safety, custody, financial)
      → Insert AI message, update conversation status
  ← Response to parent

Operator reviews escalated conversation
  → GET /api/operator/inbox       (awaiting_operator, high urgency first)
  → GET /api/operator/conversation/[id]  (full thread + original triage)
  → POST /api/operator/draft      (AI-generated reply grounded in policies)
  → POST /api/operator/answer
      → Insert operator message
      → Policy proposal LLM: should this reply become a policy?
          → if yes → insert draft policy (source: proposed_by_ai)
      → Return proposal → modal appears on same screen immediately

Operator approves / edits / discards proposal
  → POST /api/operator/policies/[id]/approve → flip to active
  → Next similar question → AI answers confidently, citing the new policy
```

---

## Eval results

Run `pnpm test` with the dev server running to generate `tests/eval/results.md`. The harness covers 21 scenarios: general hours/tuition questions, personalized child-data lookups, health/safety escalations, authorization boundary checks (parent asking about another family's child), off-topic and adversarial inputs, and a two-turn clarification flow.

<!-- Replace the placeholder below with the contents of tests/eval/results.md after running pnpm test -->

| ID | Question | Expected | Actual | Pass |
|---|---|---|---|---|
| — | Run `pnpm test` to generate results | — | — | — |

---

## Design rationale

**No RAG / vector store.** The policy knowledge base is small, structured, and operator-owned. Exact-match retrieval by category is deterministic and auditable — the operator can see exactly which policies the AI was given. Semantic search adds complexity and makes it harder to reason about why a policy was or wasn't in the model's context.

**No model training.** The teaching loop grows the knowledge base, not the model. When the operator answers a new question and promotes it to a policy, every future similar question benefits immediately — no fine-tuning pipeline, no deployment cycle. The model stays fixed; the context gets richer.

**Authorization at the API layer, not via prompts.** `getAuthorizedChildIds()` is the only path to child data. The LLM never receives data a parent isn't authorized for. Authorization instructions in a prompt can be overridden or ignored; code cannot.

**Three confidence levels, two urgency levels.** Confidence (high / medium / low) describes how well-grounded the answer is. Urgency (high / standard) describes the operational priority of the escalation. These are orthogonal: a low-confidence answer about hours is standard urgency; a high-confidence answer about a fever is high urgency. Collapsing them into one dimension loses that signal.

**Sage-and-cream palette with coral accent.** Warm and approachable for a parent-facing product, intentionally distinct from Brightwheel's production brand so reviewers can tell this is a prototype at a glance.

---

## Intentional cuts

| What | Why cut | What production would look like |
|---|---|---|
| Real auth | Demo uses a cookie-based switcher — enough to exercise all authorization logic | Supabase Auth with magic link or Google OAuth; RLS as a second defense layer |
| Row Level Security | API-layer authz via `getAuthorizedChildIds` is the single source of truth here | RLS policies mirroring `parent_child` as defense-in-depth |
| SMS / email notifications | Resend is in the personal project this was forked from; stripped for scope | Notify operator on high-urgency escalation; notify parent when operator replies |
| Real-time updates | Parent chat polls every 10 seconds for operator replies | Supabase Realtime subscription — zero-latency delivery |
| Voice input | M6 stretch; deprioritized in favor of the teaching loop | Web Speech API for dictation; text-to-speech for accessibility |
| Multi-language | Spanish is the obvious first add for US childcare | i18n on prompts + UI; parent language preference on the parent record |
| Vector similarity | Could surface "you've been asked this before" to operators | pgvector on policy embeddings for semantic deduplication |
| Multi-center | Single-center config in `lib/center-config.ts` | Per-center config in DB; operator scoped to center; separate policy namespaces |
| Operational actions | The AI Front Desk answers questions; it doesn't take actions yet | Tool calls to trigger Calendly for tours, Stripe for tuition, etc. |
| Analytics depth | Lightweight activity tab with today's stats | Full funnel: confidence trends, escalation rate, policy coverage gaps over time |

---

## What I'd build next

**30 days**
- Real auth (Supabase Auth + magic link) and Row Level Security
- SMS / email notifications via Resend: operator on escalation, parent on reply
- Supabase Realtime instead of 10-second polling

**60 days**
- Voice input (Web Speech API) and text-to-speech replies
- Spanish language support (prompt + UI i18n)
- Analytics: escalation rate over time, top unanswered categories, confidence distribution

**90 days**
- Multi-center: per-center policy namespaces, operator scoping
- pgvector semantic deduplication: surface near-duplicate questions before the operator types
- Tool calls for operational actions: tour scheduling, payment links, attendance check-in
