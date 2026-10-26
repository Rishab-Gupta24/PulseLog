# Step-by-Step Build & Test Plan (`tasks.md`)

Complete each task in order. Do not advance to the next milestone until every implementation item and automated Jest test in the current milestone passes. Update `memory.md` after completing each task.

## Milestone 1: Functional Core & Automated Tests in Expo Go (Plain Solid UI)
Execution Order: Database & Date Utils -> Weight & Workout Logging + Tests -> Meals, Manual Steps & Backup/Restore + Tests.

- [x] **Task 1.1: Project Scaffold, Jest Setup, Date Utils & Plain Theme Tokens**
  - Initialize Expo project using the current stable Expo SDK (`npx create-expo-app@latest pulselog`).
  - Install compatible testing packages via `npx expo install jest-expo jest @testing-library/react-native`.
  - Create `src/utils/dateUtils.ts` implementing `toLocalDateString(date)` (`YYYY-MM-DD` in local timezone) and local midnight-to-midnight day boundary helpers.
  - **Write & Run Test (`src/__tests__/dateUtils.test.ts`):** Verify local `YYYY-MM-DD` formatting around midnight without UTC date shifts.
  - Create `src/constants/theme.ts` with the plain solid color palette, `8` logical unit spacing constants, and `44x44` logical unit minimum touch target rules from `design.md`.
- [ ] **Task 1.2: SQLite Database, Schema & Query Profiler**
  - Install SQLite via `npx expo install expo-sqlite`.
  - Create `src/db/client.ts` enforcing `PRAGMA journal_mode = WAL;` and `PRAGMA foreign_keys = ON;`.
  - Create `src/db/schema.ts` implementing all 6 tables (`user_targets` with nullable columns, `workouts` with `workout_date`/`intensity_label`/`met_value`/`body_weight_kg_used`/`estimated_calories_burned`, `workout_sets` with optional `rpe`, `meal_logs` with `base_*` and `portion_multiplier`, `weight_logs`, `step_logs`).
  - Create `src/db/profiler.ts` with a `profileQuery()` helper using `performance.now()`.
- [ ] **Task 1.3: Optional User Targets (`targetsService.ts`)**
  - Build `src/services/targetsService.ts` to read, set, or clear individual targets (`NULL` allowed for any target).
  - Build `app/modals/targets.tsx` with a **"Skip / Clear Targets"** option so users are never forced to enter goals before logging.
- [ ] **Task 1.4: Weight Logging, 7-Day Moving Average & Tests (`weightService.ts`)**
  - Build `src/services/weightService.ts` to log, edit, and delete daily scale weights by local `logged_date` (`YYYY-MM-DD`), query the latest weight strictly **on or before** a given `YYYY-MM-DD` date (`logged_date <= target_date`), and compute a pure TypeScript **7-day moving average**.
  - Render the dual-line weight chart (raw daily entries + 7-day moving average) on `app/(tabs)/trends.tsx`.
  - **Write & Run Test (`src/__tests__/weightMovingAvg.test.ts`):** Verify 7-day moving average math across sparse and consecutive dates, and verify that prior-or-same-day weight lookup never returns a future weight log.
- [ ] **Task 1.5: Workout & Set Logger with Rough MET Presets & Tests (`workoutService.ts`)**
  - Create `src/constants/workoutMets.ts` (`light` = 3.5, `moderate` = 5.0, `vigorous` = 6.0).
  - Build `src/services/workoutService.ts` supporting create, read, edit, and delete for workouts and sets (`exercise_name`, `set_number`, `reps`, `weight_kg`, optional `rpe` 1–10).
  - Compute `estimated_calories_burned` using the rough `met_value`, `duration_minutes`, and `weightService.getLatestWeightOnOrBefore(workout_date)`. If no weight log exists on or before `workout_date`, set `body_weight_kg_used = NULL` and `estimated_calories_burned = NULL`.
  - Render on `app/(tabs)/workouts.tsx` showing the estimate and explicit assumptions (`"Estimated (MET approx.)"`).
  - **Write & Run Test (`src/__tests__/workoutMetCrud.test.ts`):** Verify workout/set CRUD, cascade delete, MET calculation with prior/same-day weight, and `NULL` result when only future weight logs or no weight logs exist.
- [ ] **Task 1.6: Staple & Custom Meal Portion Logger & Tests (`mealService.ts`)**
  - Create `src/constants/stapleFoods.ts` with typed reference servings (`1.0x` base calories/macros) and portion multipliers (`Small 0.75x`, `Medium 1.0x`, `Large 1.5x`, `0.5/1/2 Fist/Palm/Thumb`).
  - Build `src/services/mealService.ts` and `app/(tabs)/nutrition.tsx` supporting both staple selection and custom meal entry (`meal_name`, `base_calories`, optional `base_protein_g`/`base_carbs_g`/`base_fat_g`, and `portion_multiplier`), plus full editing and deleting.
  - Badge all meal and daily totals with `"Approximate Estimate"`.
  - **Write & Run Test (`src/__tests__/mealPortions.test.ts`):** Verify staple and custom meal portion multiplier math, editing a meal's portion multiplier, and daily local-date macro totals.
- [ ] **Task 1.7: Manual Step Logging, Today Dashboard & Exclusive-Transaction Backup/Restore (`stepRepository.ts` & `backupService.ts`)**
  - Implement `src/services/steps/stepRepository.ts` and `mockSteps.ts` enforcing idempotent upserts on `logged_date` and protecting `source = 'manual'` rows from automatic sync overwrites unless `forceOverwriteManual: true` is passed.
  - Build `app/(tabs)/index.tsx` showing today's local-date totals and optional target progress bars.
  - Install file utilities via `npx expo install expo-file-system expo-sharing expo-document-picker`.
  - Build `src/services/backupService.ts`:
    1. Validate the entire backup JSON schema, date formats, and foreign keys in memory before opening a transaction.
    2. Prompt the user with a destructive confirmation dialog stating that restoring **replaces all existing local data**.
    3. Execute the wipe and restore inside `await db.withExclusiveTransactionAsync(async (txn) => { ... })` using `txn.runAsync(...)`.
  - **Write & Run Test (`src/__tests__/backupRestore.test.ts`):** Verify that invalid JSON or broken foreign keys abort before touching the DB, and valid payloads replace all 6 tables inside the exclusive transaction.

## Milestone 2: Native Health Integration, Fallback Tests & Device Profiling
Goal: Transition from Expo Go to a native Development Build to connect Apple HealthKit and Android Health Connect, verify permission/conflict behavior, and measure real hardware performance.

- [ ] **Task 2.1: Expo Prebuild & Deduplicated Native Health Bridges (`nativeSteps.ts`)**
  - Run `npx expo install expo-dev-client` and `npx expo prebuild` to generate native iOS and Android projects.
  - Install `@kingstinct/react-native-healthkit` (iOS) and `react-native-health-connect` (Android). *(Verify deprecated `expo-health-connect` is NOT installed).*
  - Implement `src/services/steps/nativeSteps.ts` using OS-deduplicated daily queries (`HKStatisticsOptionCumulativeSum` on iOS, `aggregateRecord` on Android) over local midnight-to-midnight boundaries on foreground launch.
  - **Write & Run Test (`src/__tests__/stepConflictFallback.test.ts`):** Mock OS permission denial, repeated same-day sync calls (idempotency), and conflict handling when a `'manual'` step entry already exists for that day.
- [ ] **Task 2.2: Real Routine Testing & Hardware Benchmarking**
  - Use the app on your own phone for 7 days and test the JSON export/import flow.
  - Run `src/db/seed.ts` (1,000 synthetic workout/meal rows) on a physical device, record actual `performance.now()` query latencies in `memory.md`, and verify native step imports before adding metrics to your CV.

## Milestone 3: Post-MVP Visual Polish & Portfolio Extras (Optional)
Goal: Add visual refinements and a portfolio web page only after Milestones 1 and 2 and all automated tests are complete.

- [ ] **Task 3.1: Apple HIG Audit & Liquid Glass Chrome**
  - Clone `dickwu/apple-design-skill` into `.design-rules/` and audit all screens for `44x44` logical unit touch targets and `8` logical unit grid alignment.
  - Run `npx expo install expo-blur` and apply restrained Liquid Glass styling strictly to the floating bottom tab bar and modal sheets.
- [ ] **Task 3.2: Portfolio Showcase Website (`/web`)**
  - Build `web/index.html`, `web/styles.css`, and `web/main.js` showcasing real app recordings, the offline SQLite architecture, passing Jest test suite, and verified benchmarks from `memory.md`.
