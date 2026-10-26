# Project Memory & Decision Log (`memory.md`)

This file records architectural decisions, schema refinements, platform traps, test coverage status, and verified hardware measurements across development sessions.

## 1. Current Project Status
* **Project Name:** PulseLog
* **Specification Status:** Locked & Ready for Milestone 1 Implementation
* **Active Milestone:** Milestone 1 — Database, Weight & Workout Logging + Tests first, followed by Meal Portion Logging, Manual Steps, and Exclusive-Transaction Backup/Restore.
* **Completed Tasks:** 1.1 (Expo SDK 58 scaffold, Jest 30 + jest-expo, `dateUtils.ts` + tests, `theme.ts`).
* **Next Task:** 1.2 — SQLite database, schema & query profiler.
* **Test Status:** `npx jest` → 1 suite, 19 tests passing (`dateUtils.test.ts`). `npx tsc --noEmit` clean. `npx expo-doctor` 20/20.

## 2. Architectural Decision Records (ADRs)
* **ADR-001 (Non-AI Offline-First Focus):** Removed the paid AI Coach, ad networks, and cloud Vision APIs. Focusing on local SQLite storage, clean relational CRUD, moving-average math, automated tests, and native health permissions produces a verifiable mobile engineering project.
* **ADR-002 (Version-Agnostic Expo Setup):** Standardized on the current stable Expo SDK and `npx expo install` rather than hardcoding an older SDK floor.
* **ADR-003 (Optional, Nullable User Targets):** Made all target fields in `user_targets` nullable and onboarding skippable so users can log workouts, meals, weight, or steps immediately without forced goal setup.
* **ADR-004 (Strict Prior/Same-Day Weight Lookup for MET Estimates):** Resolved the earlier contradiction—workout calorie estimates strictly query `logged_date <= workout_date`. Removed the future-weight fallback so past workouts are never calculated using weights logged days later. If no weight exists on or before `workout_date`, `estimated_calories_burned` is `NULL`.
* **ADR-005 (Explicit Staple Reference Servings & Custom Meal Multipliers):** Defined `StapleFoodItem` with a concrete `1.0x` reference serving, base macros, and portion multipliers (`Small 0.75x`, `Medium 1.0x`, `Large 1.5x`, `0.5/1/2 Fist/Palm/Thumb`), plus custom meal entry storing `base_*` and `portion_multiplier` on `meal_logs` so edits recalculate cleanly.
* **ADR-006 (Unified Local-Timezone Date Rule):** Standardized all daily logs (`workout_date`, `logged_date`) on local `YYYY-MM-DD` strings via `toLocalDateString()` (`src/utils/dateUtils.ts`) and local midnight-to-midnight boundaries, preventing UTC date shifts around midnight.
* **ADR-007 (Step Deduplication & Conflict Precedence):** Native step imports use OS-aggregated daily totals (`HKStatisticsOptionCumulativeSum` / Health Connect `aggregateRecord`) to avoid multi-device double-counting, and never silently overwrite `source = 'manual'` entries.
* **ADR-008 (Pre-Validated Exclusive-Transaction Restore):** `backupService.ts` validates the full JSON payload in memory before touching SQLite, warns the user that restoring **replaces all existing data**, and runs all `DELETE`/`INSERT` queries inside `db.withExclusiveTransactionAsync(async (txn) => ...)` using the `txn` handle.
* **ADR-009 (Routes in Root `app/`, Not `src/app/`):** The SDK 58 default template puts Expo Router routes in `src/app/`. PulseLog keeps them in root `app/` as specified in `Architecture.md` §2; non-route code lives in `src/` and is imported via the `@/*` → `./src/*` path alias. Template demo screens, components, hooks and the `reset-project` script were not kept.
* **ADR-010 (Real-Timezone Date Tests):** `dateUtils.test.ts` runs under `jest/timezoneEnvironment.js` (jest-expo native env + `__setProcessTimezone`) so midnight/DST cases are tested in Asia/Kolkata, America/Los_Angeles and America/New_York regardless of the developer machine's timezone.

## 3. Known Platform Gotchas
* **UTC `.toISOString()` Midnight Bug:** Never call `new Date().toISOString().slice(0, 10)` to generate `logged_date`. In timezones ahead of or behind UTC, logging at 11:30 PM or 1:00 AM records the wrong calendar day. Always use `toLocalDateString()`.
* **SQLite Transaction Handle Trap:** Inside `db.withExclusiveTransactionAsync(async (txn) => { ... })`, calling `db.runAsync(...)` instead of `txn.runAsync(...)` can deadlock or bypass the transaction scope. Always invoke queries on `txn`.
* **SQLite Foreign Keys:** `PRAGMA foreign_keys = ON;` must run every time the database connection opens in `src/db/client.ts` so deleting a workout cascades to `workout_sets`.
* **Android Health Connect Duplicate Class Error:** When starting Milestone 2, only install `react-native-health-connect`. Do not install the deprecated `expo-health-connect` wrapper.
* **Jest Sandboxes `process.env`:** Assigning `process.env.TZ` inside a test only changes Jest's sandbox copy and never reaches V8, so dates keep the machine's timezone. Use `__setProcessTimezone()` from `jest/timezoneEnvironment.js` (opt in with a `@jest-environment` docblock).
* **ICU Timezone Aliases:** `Intl...resolvedOptions().timeZone` may return a legacy alias (`Asia/Kolkata` → `Asia/Calcutta`). Assert on offsets/dates, not zone names.
* **Git Bash on Windows:** MSYS strips a `TZ=...` prefix before launching Windows programs, and `npx expo install ... "--" --dev` dropped `--dev` (packages landed in `dependencies`). Run TZ experiments from PowerShell and verify `package.json` after installing dev packages.
* **Jest 30 Required:** jest-expo for SDK 58+ requires Jest 30; always install `jest`, `@types/jest` and `jest-expo` together via `npx expo install`.

## 4. Hardware Performance Log (Measure Before Claiming on CV)
* *Today Dashboard SQLite Aggregation Query:* `[UNMEASURED — Run profiler.ts on physical device before adding to CV]`
* *Weight Chart 7-Day Moving Average Calculation:* `[UNMEASURED — Run profiler.ts on physical device before adding to CV]`
* *HealthKit / Health Connect Foreground Sync:* `[NOT YET TESTED ON PHYSICAL DEVICE — Pending Milestone 2]`

## 5. Changelog
* **2026-10-26 (Task 1.1):** `git init`; scaffolded Expo SDK 58 (React Native 0.88, TypeScript 6) with routes moved to root `app/`; added Jest 30 + `jest-expo` + `@testing-library/react-native` (dev deps), `npm test` / `npm run typecheck` scripts and `"types": ["jest"]`; implemented `src/utils/dateUtils.ts` (`toLocalDateString`, `parseLocalDateString`, `isValidLocalDateString`, `getLocalDayBounds`) with 19 passing tests covering midnight UTC shifts, invalid dates and a 23-hour DST day; added `src/constants/theme.ts` (design.md color tokens, 8pt spacing, 44×44 touch target, tabular nums) and a placeholder root screen. Verified with `tsc --noEmit`, `expo-doctor` and an Android `expo export` bundle.
* **2026-10-26:** Finalized all 6 `.md` specification files: removed future-weight fallback, defined staple food reference servings and custom meal portion schema, standardized local-timezone `YYYY-MM-DD` date handling, updated touch target specs to `44x44` logical units, and ordered Milestone 1 tasks starting with DB, weight/workout logging, and tests.
