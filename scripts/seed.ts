/**
 * Idempotent seed script for Sunshine Preschool.
 * Run with: npx tsx scripts/seed.ts
 *
 * Truncates all tables and reinserts canonical demo data.
 * Safe to run multiple times.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Env loading — reads .env.local so this works without exporting vars first
// ---------------------------------------------------------------------------

try {
  const lines = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // Already set via environment — fine in CI or Vercel
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertOk(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

function subtractYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() - years);
  return d;
}

function subtractMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  const today = new Date();
  console.log(`Seeding Sunshine Preschool data (today = ${toDateString(today)})…`);

  // ── Truncate in reverse dependency order ──────────────────────────────────
  console.log("  Truncating existing data…");
  for (const table of ["messages", "conversations", "daily_logs", "parent_child", "policies", "children", "parents", "operators"] as const) {
    if (table === "parent_child") {
      const { error } = await db.from(table).delete().not("parent_id", "is", null);
      assertOk(error, `truncate ${table}`);
    } else {
      const { error } = await db.from(table).delete().not("id", "is", null);
      assertOk(error, `truncate ${table}`);
    }
  }

  // ── Operators ─────────────────────────────────────────────────────────────
  console.log("  Inserting operators…");
  const { data: operators, error: opErr } = await db
    .from("operators")
    .insert([{ name: "Lisa Chen", role: "director", email: "lisa@sunshinepreschool.com" }])
    .select();
  assertOk(opErr, "insert operators");
  const lisa = operators![0];

  // ── Parents ───────────────────────────────────────────────────────────────
  console.log("  Inserting parents…");
  const { data: parents, error: parentErr } = await db
    .from("parents")
    .insert([
      { name: "Sarah Chen", email: "sarah.chen@example.com", phone: "(503) 555-0188" },
      { name: "Marcus Williams", email: "marcus.williams@example.com", phone: "(503) 555-0291" },
    ])
    .select();
  assertOk(parentErr, "insert parents");
  const sarah = parents!.find((p) => p.name === "Sarah Chen")!;
  const marcus = parents!.find((p) => p.name === "Marcus Williams")!;

  // ── Children (DOBs computed from today) ───────────────────────────────────
  console.log("  Inserting children…");
  const emmaDOB = subtractYears(today, 4);                        // preschool: 4 years old
  const liamDOB = subtractMonths(subtractYears(today, 2), 6);    // toddler: 2.5 years old
  const mayaDOB = subtractMonths(today, 11);                      // infant: 11 months old

  const { data: children, error: childErr } = await db
    .from("children")
    .insert([
      {
        name: "Emma Chen",
        date_of_birth: toDateString(emmaDOB),
        age_group: "preschool",
        allergies: ["peanuts"],
      },
      {
        name: "Liam Williams",
        date_of_birth: toDateString(liamDOB),
        age_group: "toddler",
        allergies: [],
      },
      {
        name: "Maya Williams",
        date_of_birth: toDateString(mayaDOB),
        age_group: "infant",
        allergies: ["dairy"],
      },
    ])
    .select();
  assertOk(childErr, "insert children");
  const emma = children!.find((c) => c.name === "Emma Chen")!;
  const liam = children!.find((c) => c.name === "Liam Williams")!;
  const maya = children!.find((c) => c.name === "Maya Williams")!;

  // ── Parent–child relationships ─────────────────────────────────────────────
  console.log("  Inserting parent_child links…");
  const { error: pcErr } = await db.from("parent_child").insert([
    { parent_id: sarah.id, child_id: emma.id, relationship: "parent" },
    { parent_id: marcus.id, child_id: liam.id, relationship: "parent" },
    { parent_id: marcus.id, child_id: maya.id, relationship: "parent" },
  ]);
  assertOk(pcErr, "insert parent_child");

  // ── Today's daily logs ────────────────────────────────────────────────────
  console.log("  Inserting daily logs…");
  const logDate = toDateString(today);

  const { error: logErr } = await db.from("daily_logs").insert([
    {
      child_id: emma.id,
      log_date: logDate,
      meals: {
        breakfast: { ate: true,  time: "08:15", notes: "finished oatmeal and banana" },
        lunch:     { ate: true,  time: "12:00", notes: "ate most of sandwich, skipped carrots" },
        snack:     { ate: true,  time: "15:00", notes: "apple slices" },
      },
      naps: [{ start: "13:15", end: "14:45" }],
      mood: "happy",
      diaper_changes: 0,
      notes: "Had a great morning at the art table. Built a tall block tower with classmate Marcus.",
    },
    {
      child_id: liam.id,
      log_date: logDate,
      meals: {
        breakfast: { ate: true,  time: "08:30", notes: "ate scrambled eggs and toast" },
        lunch:     { ate: false, time: "12:00", notes: "didn't want the turkey sandwich, ate the orange slices" },
        snack:     { ate: true,  time: "15:00", notes: "graham crackers" },
      },
      naps: [{ start: "12:30", end: "14:30" }],
      mood: "tired",
      diaper_changes: 3,
      notes: "A bit clingy at drop-off. Warmed up by mid-morning.",
    },
    {
      child_id: maya.id,
      log_date: logDate,
      meals: {
        breakfast: { ate: true, time: "08:00", notes: "finished her bottle, then dairy-free cereal" },
        lunch:     { ate: true, time: "11:45", notes: "soy yogurt instead of regular, soft fruit" },
        snack:     { ate: true, time: "14:30", notes: "rice puffs" },
      },
      naps: [
        { start: "09:30", end: "10:30" },
        { start: "13:00", end: "14:15" },
      ],
      mood: "great_day",
      diaper_changes: 4,
      notes: "Reached for a toy on her own for the first time today!",
    },
  ]);
  assertOk(logErr, "insert daily_logs");

  // ── Policies ──────────────────────────────────────────────────────────────
  console.log("  Inserting policies…");
  const { error: policyErr } = await db.from("policies").insert([
    {
      category: "hours_holidays",
      title: "Standard Operating Hours",
      content:
        "Sunshine Preschool is open Monday through Friday from 7:00 AM to 6:00 PM. We ask that all children be picked up no later than 6:00 PM to allow our staff time to close the facility. A late pickup fee applies to any child remaining in care after 6:15 PM.",
      structured_data: null,
      source: "seeded",
      status: "active",
      created_by_operator: lisa.id,
    },
    {
      category: "hours_holidays",
      title: "Federal Holiday Closures",
      content:
        "Sunshine Preschool is closed in observance of the following federal holidays each year: New Year's Day, Martin Luther King Jr. Day, Memorial Day, Independence Day (July 4th), Labor Day, Thanksgiving Day, the Friday after Thanksgiving, Christmas Eve, and Christmas Day. Families will receive advance notice of all scheduled closures through the parent app. Tuition is not prorated for planned holiday closures.",
      structured_data: null,
      source: "seeded",
      status: "active",
      created_by_operator: lisa.id,
    },
    {
      category: "hours_holidays",
      title: "Inclement Weather Closures",
      content:
        "Sunshine Preschool follows Portland Public Schools' decisions regarding unplanned closures and delayed openings due to inclement weather. Families will be notified of any weather-related closure via the parent app and email no later than 6:00 AM on the affected day. We encourage families to also sign up for Portland Public Schools weather alerts as an additional source of advance notice.",
      structured_data: null,
      source: "seeded",
      status: "active",
      created_by_operator: lisa.id,
    },
    {
      category: "tuition_fees",
      title: "Monthly Tuition by Age Group",
      content:
        "Sunshine Preschool offers full-time enrollment across four age groups with the following monthly tuition rates: Infants $1,950, Toddlers $1,750, Preschool $1,550, and Pre-K $1,450. Tuition is due on the first of each month. Please contact Director Lisa Chen at (503) 555-0142 with any questions about your child's billing or age group placement.",
      structured_data: {
        per_month_usd: { infant: 1950, toddler: 1750, preschool: 1550, pre_k: 1450 },
        due_day_of_month: 1,
      },
      source: "seeded",
      status: "active",
      created_by_operator: lisa.id,
    },
    {
      category: "tuition_fees",
      title: "Late Payment & Returned Check Fees",
      content:
        "Tuition not received by the 5th of the month will be assessed a $50 late fee, which will be added to the following month's invoice. Returned checks are subject to a $35 fee per occurrence, regardless of the reason for return. Accounts with a pattern of late payments or returned checks may be placed on a prepaid billing schedule at the director's discretion.",
      structured_data: null,
      source: "seeded",
      status: "active",
      created_by_operator: lisa.id,
    },
    {
      category: "tuition_fees",
      title: "Sibling Discount",
      content:
        "Families with two or more children simultaneously enrolled at Sunshine Preschool receive a 10% discount applied to the younger child's monthly tuition. The discount is applied automatically at the time of enrollment and remains in effect for as long as both children are enrolled. Contact Director Lisa Chen at (503) 555-0142 to confirm eligibility or with questions about multi-child billing.",
      structured_data: null,
      source: "seeded",
      status: "active",
      created_by_operator: lisa.id,
    },
    {
      category: "illness_health",
      title: "Sick Child Exclusion: Fever",
      content:
        "Children with a temperature of 100.4°F (38°C) or higher may not attend Sunshine Preschool. A child must be fever-free for a full 24 hours without the use of fever-reducing medication before returning to care. If a child develops a fever during the day, a parent or emergency contact will be called immediately for same-day pickup.",
      structured_data: null,
      source: "seeded",
      status: "active",
      created_by_operator: lisa.id,
    },
    {
      category: "illness_health",
      title: "Sick Child Exclusion: General Symptoms",
      content:
        "Children experiencing vomiting, two or more episodes of diarrhea within a 24-hour period, an unexplained rash, or conjunctivitis must be kept home until symptoms have resolved. A child may return to care once they have been symptom-free for 24 hours, or when a licensed physician has provided written clearance to return. Please notify Sunshine Preschool as early as possible on any day your child will be absent due to illness.",
      structured_data: null,
      source: "seeded",
      status: "active",
      created_by_operator: lisa.id,
    },
    {
      category: "illness_health",
      title: "Medication Administration",
      content:
        "Sunshine Preschool staff may administer medication only after a completed Authorization to Administer Medication form has been submitted by a parent or guardian. All medication must be brought in its original, labeled container with the child's full name affixed, and may not be expired. First doses of any new medication must be given at home — staff will not administer a child's first dose of any prescription or over-the-counter medication at school.",
      structured_data: null,
      source: "seeded",
      status: "active",
      created_by_operator: lisa.id,
    },
    {
      category: "meals_nutrition",
      title: "Meals Provided",
      content:
        "Sunshine Preschool provides three daily meals for all enrolled children: breakfast at 8:00 AM, lunch at 12:00 PM, and an afternoon snack at 3:00 PM. All meals are prepared to meet or exceed USDA nutrition guidelines for child care programs. The weekly menu is posted every Sunday in the parent app so families can review upcoming meals in advance.",
      structured_data: null,
      source: "seeded",
      status: "active",
      created_by_operator: lisa.id,
    },
    {
      category: "meals_nutrition",
      title: "Forgotten Lunch Policy",
      content:
        "If a child arrives without a packed lunch on a day the family is responsible for providing one, Sunshine Preschool will supply a nutritious backup meal so that no child goes without food. An $8 meal fee will be added to the family's next monthly invoice to cover the cost of the provided meal. We ask that families notify the front desk by 10:00 AM whenever possible if they anticipate a forgotten lunch.",
      structured_data: null,
      source: "seeded",
      status: "active",
      created_by_operator: lisa.id,
    },
    {
      category: "meals_nutrition",
      title: "Allergy Accommodations",
      content:
        "Sunshine Preschool accommodates documented food allergies and dietary restrictions by providing appropriate meal and snack substitutions at no additional charge. Prior to the child's first day, parents must submit a written Allergy Action Plan signed by a licensed physician detailing the specific allergy, symptoms to watch for, and emergency response instructions. Staff review all active allergy plans at the start of each enrollment year and whenever a child's medical needs are updated.",
      structured_data: null,
      source: "seeded",
      status: "active",
      created_by_operator: lisa.id,
    },
    {
      category: "pickup_dropoff",
      title: "Authorized Pickup List",
      content:
        "For the safety of every child in our care, only adults listed on the parent-authorized pickup list may pick up a child from Sunshine Preschool. Staff will request photo identification from any individual picking up a child for the first time. To add or remove a person from the authorized list, contact Director Lisa Chen at (503) 555-0142 or submit a written update to front desk staff in person.",
      structured_data: null,
      source: "seeded",
      status: "active",
      created_by_operator: lisa.id,
    },
    {
      category: "pickup_dropoff",
      title: "Late Pickup Fee",
      content:
        "All children must be picked up by 6:00 PM each day. A fee of $1.00 per minute will be assessed for any child remaining in care after 6:15 PM, and this charge will be added to the family's next monthly invoice. Repeated late pickups may result in a meeting with Director Lisa Chen to discuss the family's ongoing care arrangements.",
      structured_data: null,
      source: "seeded",
      status: "active",
      created_by_operator: lisa.id,
    },
    {
      category: "enrollment_admissions",
      title: "Tour Scheduling",
      content:
        "Sunshine Preschool welcomes prospective families to tour our facility on Tuesdays and Thursdays at 9:30 AM. To schedule a tour, email tours@sunshinepreschool.com or call the front desk at (503) 555-0142. Tours are led by a staff member who can answer questions about curriculum, daily routines, age group placement, and current enrollment availability.",
      structured_data: null,
      source: "seeded",
      status: "active",
      created_by_operator: lisa.id,
    },
  ]);
  assertOk(policyErr, "insert policies");

  console.log("✓ Seed complete.");
  console.log(`  Parents:    Sarah Chen, Marcus Williams`);
  console.log(`  Operators:  Lisa Chen (director)`);
  console.log(`  Children:   Emma Chen (DOB ${toDateString(emmaDOB)}), Liam Williams (DOB ${toDateString(liamDOB)}), Maya Williams (DOB ${toDateString(mayaDOB)})`);
  console.log(`  Daily logs: ${logDate} (all 3 children)`);
  console.log(`  Policies:   15 seeded`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
