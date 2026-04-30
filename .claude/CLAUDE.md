# Brightwheel Take-Home — AI Front Desk

## Overview
AI-powered front desk prototype for "Sunshine Preschool". Parents ask routine questions
(hours, tuition, illness policies, their child's day); Claude answers from grounded policies
or escalates to the director. The director replies and can promote answers into new policies —
an operator-in-the-loop teaching loop.

**Spec**: `~/Downloads/BRIGHTWHEEL_ASSIGNMENT_HANDOFF_SPEC.md`

## Tech Stack
- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind 4, shadcn/ui
- **Database**: Supabase (Postgres) — no RLS; authorization enforced at API layer
- **Auth**: Faked demo session (cookie-based parent/operator switcher, no Supabase Auth)
- **LLM**: Anthropic Claude via Vercel AI SDK (`ai` + `@ai-sdk/anthropic`), `generateObject` + Zod
- **Model**: `claude-sonnet-4-6`
- **Hosting**: Vercel
- **Tests**: Vitest; eval harness in `tests/eval/`
- **Package Manager**: pnpm

## Commands
- `pnpm dev` — start dev server
- `pnpm build` — production build
- `pnpm lint` — run ESLint
- `pnpm test` — run Vitest
- `npx tsx scripts/seed.ts` — seed database (idempotent)

## Project Structure
```
src/
├── app/
│   ├── (parent)/         # Parent-facing routes (chat)
│   │   └── chat/         # Main chat UI
│   ├── operator/         # Operator routes (inbox, policies, activity)
│   └── api/              # API routes
├── components/
│   └── ui/               # shadcn/ui primitives
├── lib/
│   ├── supabase/         # server.ts (createServiceClient), client.ts
│   ├── auth.ts           # Demo session: getCurrentParent / getCurrentOperator
│   ├── authz.ts          # Authorization: getAuthorizedChildIds / getAuthorizedDailyLogs
│   └── center-config.ts  # Single-center config (Sunshine Preschool)
├── prompts/              # LLM prompt files (triage, answer, proposePolicy, operatorDraft)
└── types/                # TypeScript types (no Supabase-generated types yet)
scripts/
└── seed.ts               # Idempotent seed script
supabase/
└── migrations/
    └── 0001_init.sql     # Full schema
tests/
└── eval/
    └── eval.test.ts      # 20-question eval harness
```

## Architecture Notes
- **No RLS** — all Supabase queries use the service role key; authorization is enforced by
  `getAuthorizedChildIds()` in `lib/authz.ts`. Every route that touches child data MUST go through it.
- **No streaming** (M2–M5) — `generateObject` with Zod schemas for all LLM calls.
- **Demo auth** — `demo_parent_id` and `demo_operator_id` cookies. No Supabase Auth.
- **Triage runs once** per conversation (first message only); saved to `conversations.triage`.
- **Sensitive intents always escalate** even when confidence is high.
- **Deterministic source verification**: after every answer LLM call, verify all cited policy
  UUIDs were actually in the prompt. If not, force confidence='low' and escalate.

## Key Implementation Rules (from spec — do not violate)
1. Authorization at API layer, never via prompt instructions
2. Deterministic source verification on every answer LLM call
3. Triage is a hard gate — don't call answer LLM if in_scope is false
4. Sensitive intents always escalate
5. Don't re-triage on follow-up turns
6. No console.log with PII before deploy
7. No localStorage/sessionStorage for app state
8. Policy proposal modal appears immediately after operator reply (same screen)
9. Mobile-first: 380px viewport, tap targets ≥44px, body text ≥16px
