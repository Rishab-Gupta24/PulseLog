# System Architecture — PulseLog

## 1. System Overview & Control Flow
PulseLog uses a **Local-First Modular Architecture**. Every read and write operation goes through typed, unit-tested domain services into a local SQLite database (`expo-sqlite` configured in WAL mode). Hardware health integrations sit behind a clean `StepService` interface so Milestone 1 can be built and tested inside standard Expo Go before generating native iOS and Android folders in Milestone 2.

```text
[ React Native Screens (Expo Router) ]
                   │
                   ▼
[ Typed Domain Services (src/services/) ]
       ├──► TargetsService  ──┐
       ├──► WorkoutService  ──┤
       ├──► MealService     ──┼──► [ Local SQLite Database (WAL Mode) ]
       ├──► WeightService   ──┤          (Single Source of Truth)
       ├──► BackupService   ──┘          (Pre-Validated Exclusive Transaction Restore)
       │
       └──► StepService (Interface)
               ├── Milestone 1 (Expo Go): MockStepAdapter (Manual entry & edits)
               └── Milestone 2 (Dev Build): NativeStepAdapter (OS-Deduplicated HealthKit / Health Connect)
```

## 2. Project Directory Structure

```text
pulselog/
├── .design-rules/                # Reference submodule: dickwu/apple-design-skill
├── .github/
│   └── workflows/
│       └── ci.yml                # GitHub Actions: tsc --noEmit + npx jest
├── PRD.md                        # Product Requirements Document
├── Architecture.md               # System overview, schema & directory structure
├── Rules.md                      # Strict coding, UX & library guardrails
├── memory.md                     # Architectural decisions, bug log & measured benchmarks
├── design.md                     # Plain color tokens, HIG rules & Milestone 3 polish specs
├── tasks.md                      # Milestone-based build & test checklist
├── app/                          # Expo Router file-based navigation
│   ├── _layout.tsx               # Root layout: initializes SQLite DB & loads optional targets
│   ├── (tabs)/                   # Bottom tab navigation (4 tabs)
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Today Overview (totals + optional target progress)
│   │   ├── workouts.tsx          # Workout & Set Logger (CRUD + rough MET preset estimate)
│   │   ├── nutrition.tsx         # Approximate Meal & Portion Logger (Staple + Custom CRUD)
│   │   └── trends.tsx            # Weight Chart (Raw + 7d Moving Avg) & Step Sync/Entry
│   └── modals/
│       └── targets.tsx           # Optional Targets Settings + JSON Backup Export/Import
├── src/
│   ├── db/
│   │   ├── client.ts             # expo-sqlite initialization + PRAGMA WAL & foreign_keys
│   │   ├── schema.ts             # DDL table creation scripts (6 tables)
│   │   ├── seed.ts               # Optional synthetic data seeder for device profiling
│   │   └── profiler.ts           # performance.now() query timing wrapper
│   ├── utils/
│   │   └── dateUtils.ts          # Canonical local-timezone YYYY-MM-DD & midnight boundary helpers
│   ├── services/
│   │   ├── targetsService.ts     # Read/write/clear optional calorie, macro & step targets
│   │   ├── workoutService.ts     # Workout/Set CRUD + prior/same-day weight lookup & MET math
│   │   ├── mealService.ts        # Staple & custom meal CRUD + portion multiplier math
│   │   ├── weightService.ts      # Weight CRUD + 7-day moving average calculation
│   │   ├── backupService.ts      # Full schema validation + withExclusiveTransactionAsync restore
│   │   └── steps/
│   │       ├── types.ts          # StepService interface & conflict resolution types
│   │       ├── stepRepository.ts # Deterministic SQLite upsert & manual-precedence logic
│   │       ├── mockSteps.ts      # Manual step entry & storage (Milestone 1)
│   │       └── nativeSteps.ts    # Deduplicated HealthKit / Health Connect sync (Milestone 2)
│   ├── __tests__/                # Automated Jest test suite
│   │   ├── dateUtils.test.ts
│   │   ├── weightMovingAvg.test.ts
│   │   ├── workoutMetCrud.test.ts
│   │   ├── mealPortions.test.ts
│   │   ├── backupRestore.test.ts
│   │   └── stepConflictFallback.test.ts
│   ├── components/
│   │   ├── ui/                   # Solid surface cards, inputs, estimate badges, buttons
│   │   └── charts/               # Weight moving-average chart component
│   └── constants/
│       ├── theme.ts              # Plain solid color tokens & 8pt spacing scale
│       ├── workoutMets.ts        # Rough activity MET presets (Light 3.5, Moderate 5.0, Vigorous 6.0)
│       └── stapleFoods.ts        # Typed staple foods with 1x reference serving & portion multipliers
└── web/                          # (Milestone 3 Optional) Static portfolio showcase page
```

## 3. SQLite Database Schema (`src/db/schema.ts`)

All tables use `YYYY-MM-DD` local calendar dates (`workout_date` / `logged_date`) for daily queries and ISO-8601 UTC strings (`created_at` / `updated_at`) for audit timestamps.

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. Optional user-controlled targets (Nullable fields; user can skip or set any subset)
CREATE TABLE IF NOT EXISTS user_targets (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  daily_calorie_target INTEGER CHECK (daily_calorie_target IS NULL OR daily_calorie_target > 0),
  daily_protein_g INTEGER CHECK (daily_protein_g IS NULL OR daily_protein_g >= 0),
  daily_carbs_g INTEGER CHECK (daily_carbs_g IS NULL OR daily_carbs_g >= 0),
  daily_fat_g INTEGER CHECK (daily_fat_g IS NULL OR daily_fat_g >= 0),
  daily_steps_target INTEGER CHECK (daily_steps_target IS NULL OR daily_steps_target > 0),
  updated_at TEXT NOT NULL -- ISO-8601 timestamp
);

-- 2. Workouts & Sets (Keyed by local workout_date YYYY-MM-DD; stores explicit MET assumptions)
CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_date TEXT NOT NULL, -- Local YYYY-MM-DD
  created_at TEXT NOT NULL,   -- ISO-8601 timestamp for ordering multiple sessions on same day
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  intensity_label TEXT NOT NULL DEFAULT 'moderate' CHECK (intensity_label IN ('light', 'moderate', 'vigorous')),
  met_value REAL NOT NULL DEFAULT 5.0 CHECK (met_value > 0),
  body_weight_kg_used REAL CHECK (body_weight_kg_used IS NULL OR body_weight_kg_used > 0),
  estimated_calories_burned INTEGER, -- NULL if body_weight_kg_used is NULL or duration_minutes = 0
  notes TEXT
);

CREATE TABLE IF NOT EXISTS workout_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL CHECK (set_number > 0),
  reps INTEGER NOT NULL CHECK (reps >= 0),
  weight_kg REAL NOT NULL CHECK (weight_kg >= 0),
  rpe REAL CHECK (rpe IS NULL OR (rpe >= 1.0 AND rpe <= 10.0)),
  FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
);

-- 3. Approximate Meal Logging (Supports both staple food presets and custom entries)
CREATE TABLE IF NOT EXISTS meal_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  logged_date TEXT NOT NULL,           -- Local YYYY-MM-DD
  created_at TEXT NOT NULL,            -- ISO-8601 timestamp
  staple_food_id TEXT,                 -- NULL if custom meal entry
  meal_name TEXT NOT NULL,
  portion_label TEXT NOT NULL,         -- e.g. 'Medium (1x)', '1 Fist', 'Large (1.5x)'
  portion_multiplier REAL NOT NULL DEFAULT 1.0 CHECK (portion_multiplier > 0),
  base_calories INTEGER NOT NULL CHECK (base_calories >= 0),
  base_protein_g REAL NOT NULL DEFAULT 0 CHECK (base_protein_g >= 0),
  base_carbs_g REAL NOT NULL DEFAULT 0 CHECK (base_carbs_g >= 0),
  base_fat_g REAL NOT NULL DEFAULT 0 CHECK (base_fat_g >= 0),
  est_calories INTEGER NOT NULL CHECK (est_calories >= 0),
  est_protein_g REAL NOT NULL DEFAULT 0 CHECK (est_protein_g >= 0),
  est_carbs_g REAL NOT NULL DEFAULT 0 CHECK (est_carbs_g >= 0),
  est_fat_g REAL NOT NULL DEFAULT 0 CHECK (est_fat_g >= 0)
);

-- 4. Weight History & Steps
CREATE TABLE IF NOT EXISTS weight_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  logged_date TEXT NOT NULL UNIQUE, -- Local YYYY-MM-DD
  weight_kg REAL NOT NULL CHECK (weight_kg > 0)
);

CREATE TABLE IF NOT EXISTS step_logs (
  logged_date TEXT NOT NULL PRIMARY KEY, -- Local YYYY-MM-DD
  step_count INTEGER NOT NULL CHECK (step_count >= 0),
  source TEXT NOT NULL CHECK (source IN ('manual', 'health_connect', 'healthkit')),
  updated_at TEXT NOT NULL -- ISO-8601 timestamp
);
```

## 4. Key Domain Specifications

### A. Unified Date & Timezone Rule (`src/utils/dateUtils.ts`)

* **Never use `new Date().toISOString().slice(0, 10)` for local dates**, as UTC conversion shifts dates backward or forward near midnight in non-UTC timezones.
* **Canonical Local Date Helper:**

  ```ts
  export function toLocalDateString(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  ```

* **Local Day Boundaries for Health Sync:** For any `YYYY-MM-DD` string, construct start-of-day (`new Date(year, month - 1, day, 0, 0, 0, 0)`) and end-of-day (`new Date(year, month - 1, day, 23, 59, 59, 999)`) in the user's local timezone before querying HealthKit or Health Connect.

### B. Rough MET Presets & Strict Prior-Weight Lookup (`workoutService.ts`)

* **Rough Intensity Presets (`src/constants/workoutMets.ts`):** Treated explicitly as rough Compendium-inspired estimates, not exact measurements:
  * `light`: `3.5 MET` (Light resistance / mobility / long rest)
  * `moderate`: `5.0 MET` (Standard strength / hypertrophy session)
  * `vigorous`: `6.0 MET` (High-density circuit / short rest intervals)
* **Strict Prior/Same-Day Weight Lookup Rule (No Future Fallback):** When creating or editing a workout on `workout_date` (`YYYY-MM-DD`), query:

  ```sql
  SELECT weight_kg FROM weight_logs
  WHERE logged_date <= ?
  ORDER BY logged_date DESC
  LIMIT 1;
  ```

  If no weight log exists on or before `workout_date`, `body_weight_kg_used` is `NULL` and `estimated_calories_burned` is `NULL` (never use a weight logged on a future date).
* **Formula & Display:**

  $$\text{estimated\_calories\_burned} = \text{round}\!\left(\text{met\_value} \times \text{body\_weight\_kg\_used} \times \frac{\text{duration\_minutes}}{60}\right)$$

  The UI always shows the assumptions alongside the number (e.g., `"~250 kcal (MET approx. • Moderate 5.0 MET @ 75.0 kg for 40 min)"`).

### C. Staple Food Reference Data & Custom Meal Portion Math (`stapleFoods.ts` & `mealService.ts`)

* **Staple Food Schema (`src/constants/stapleFoods.ts`):** Each staple item defines a concrete `1.0x` reference serving and allowed portion choices:

  ```ts
  export interface PortionOption {
    label: string;      // e.g. '0.5 Fist (~75g)', '1 Fist (~150g)', '2 Fists (~300g)'
    multiplier: number; // e.g. 0.5, 1.0, 2.0
  }

  export interface StapleFoodItem {
    id: string;                 // e.g. 'cooked_white_rice'
    name: string;               // e.g. 'Cooked White Rice'
    referenceServing: string;   // e.g. '1 Fist (~150g cooked)'
    baseCalories: number;       // e.g. 195
    baseProteinG: number;       // e.g. 4.0
    baseCarbsG: number;         // e.g. 42.0
    baseFatG: number;           // e.g. 0.4
    portions: PortionOption[];  // e.g. 0.5x, 1.0x, 1.5x, 2.0x
  }
  ```

* **Custom Meal Entry:** When a user logs a custom meal not in `stapleFoods`, they enter `meal_name`, `base_calories` (required), and optional `base_protein_g`, `base_carbs_g`, `base_fat_g` (defaulting to `0`), then pick a portion multiplier (`Small (0.75x)`, `Medium / Standard (1.0x)`, `Large (1.5x)`).
* **Deterministic Multiplier Calculation:**
  * `est_calories = Math.round(base_calories * portion_multiplier)`
  * `est_protein_g = Math.round(base_protein_g * portion_multiplier * 10) / 10` (rounded to 1 decimal place; same for carbs and fat).
  * Storing `base_*` and `portion_multiplier` on `meal_logs` allows users to edit a logged meal's portion size later (e.g., changing from `1 Fist` to `2 Fists`) and recalculate `est_*` accurately.

### D. Step Import Deduplication & Conflict Precedence (`stepRepository.ts` & `nativeSteps.ts`)

1. **Multi-Device Deduplication:** Always call the OS aggregated query (`HKStatisticsOptionCumulativeSum` on iOS HealthKit, which merges data across sources like iPhone and Apple Watch by default; `aggregateRecord` with `StepsRecord.COUNT_TOTAL` on Android Health Connect) for the local day boundaries.
2. **Idempotent Repeated Imports:** Re-syncing the same day updates the existing `healthkit` or `health_connect` row for `logged_date` with the latest aggregated daily total—never adding to it.
3. **Manual vs. Synced Conflict Precedence:** If `step_logs` for `logged_date` has `source = 'manual'`, automatic foreground sync skips overwriting that row unless the user explicitly triggers `"Replace with Health Sync"` (`forceOverwriteManual: true`).

### E. Pre-Validated Backup & Exclusive-Transaction Restore (`backupService.ts`)

1. **Full In-Memory Validation Before Database Touch:** Parse and validate the entire JSON payload (`schema_version`, required arrays for all 6 tables, valid `YYYY-MM-DD` date strings, numeric ranges, and foreign-key integrity between `workouts.id` and `workout_sets.workout_id`) **before** starting a transaction.
2. **Explicit User Confirmation (Full Replace):** Show a destructive confirmation alert informing the user that restoring permanently replaces all current local data.
3. **Exclusive SQLite Transaction (`withExclusiveTransactionAsync`):** Execute the wipe and re-insertion inside `await db.withExclusiveTransactionAsync(async (txn) => { ... })`, running every query via `txn.runAsync(...)`.
