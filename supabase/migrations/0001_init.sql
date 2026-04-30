-- ============================================================
-- AUTH-ADJACENT (faked for prototype — no real Supabase Auth)
-- ============================================================

CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CHILDREN AND THEIR DATA
-- ============================================================

CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  age_group TEXT NOT NULL CHECK (age_group IN ('infant', 'toddler', 'preschool', 'pre_k')),
  enrollment_status TEXT DEFAULT 'enrolled'
    CHECK (enrollment_status IN ('enrolled', 'on_leave', 'withdrawn')),
  allergies TEXT[],
  emergency_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUTHORIZATION SOURCE OF TRUTH. Every API route that touches child data
-- MUST filter through this table.
CREATE TABLE parent_child (
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  child_id  UUID REFERENCES children(id) ON DELETE CASCADE,
  relationship TEXT,
  PRIMARY KEY (parent_id, child_id)
);

CREATE INDEX idx_parent_child_parent ON parent_child(parent_id);

CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  meals JSONB,
  naps JSONB,
  mood TEXT,
  diaper_changes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (child_id, log_date)
);

CREATE INDEX idx_daily_logs_child_date ON daily_logs(child_id, log_date DESC);

-- ============================================================
-- POLICIES — operator-owned source of truth, what the LLM grounds on
-- ============================================================

CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'hours_holidays',
    'tuition_fees',
    'illness_health',
    'meals_nutrition',
    'pickup_dropoff',
    'allergies',
    'enrollment_admissions',
    'special_events',
    'discipline_behavior',
    'communication',
    'other'
  )),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  structured_data JSONB,
  source TEXT DEFAULT 'authored'
    CHECK (source IN ('seeded', 'authored', 'proposed_by_ai')),
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'draft', 'archived')),
  created_by_operator UUID REFERENCES operators(id),
  proposed_from_conversation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policies_active ON policies(category, status) WHERE status = 'active';

-- ============================================================
-- CONVERSATIONS (threads) AND MESSAGES (turns)
-- ============================================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES parents(id),

  -- Triage data captured from the FIRST message of the thread.
  -- Don't re-run triage on every follow-up.
  triage JSONB,

  status TEXT NOT NULL DEFAULT 'answered' CHECK (status IN (
    'answered',                -- AI handled it confidently, no escalation
    'awaiting_clarification',  -- AI asked the parent a follow-up question
    'awaiting_operator',       -- escalated, in operator inbox
    'answered_by_operator',    -- operator replied
    'closed'
  )),
  urgency TEXT DEFAULT 'standard' CHECK (urgency IN ('high', 'standard')),

  -- Policy proposal back-link
  proposed_policy_id UUID REFERENCES policies(id),
  policy_proposal_status TEXT CHECK (policy_proposal_status IN (
    'pending', 'approved', 'edited', 'discarded', 'no_proposal'
  )),

  -- AUDIT — for security/observability
  authorized_child_ids UUID[],   -- which children's data we permitted into LLM context
  referenced_child_id UUID,      -- which child the question actually concerned (may differ; flag if so)

  last_message_at TIMESTAMPTZ DEFAULT NOW(),  -- for inbox sorting
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_inbox
  ON conversations(status, urgency, last_message_at DESC)
  WHERE status = 'awaiting_operator';

CREATE INDEX idx_conversations_parent ON conversations(parent_id, last_message_at DESC);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('parent', 'ai', 'operator', 'system')),
  content TEXT NOT NULL,

  -- Set on AI messages only
  ai_confidence TEXT CHECK (ai_confidence IN ('high', 'medium', 'low')),
  ai_confidence_reason TEXT,
  policies_cited UUID[],
  awaiting_clarification BOOLEAN DEFAULT FALSE,

  -- Set on operator messages only
  operator_id UUID REFERENCES operators(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
