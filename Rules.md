# Engineering & Design Rulebook (`Rules.md`)

Every AI coding assistant (Cursor, GitHub Copilot, Claude Code) must follow these rules before creating or editing files.

## 1. Strict Requirements (MUST DO)
1. **Strict TypeScript:** Define explicit TypeScript interfaces for every SQLite table row, service payload, and component prop. Using `any` is prohibited.
2. **Expo SDK & Package Compatibility:** Use the current stable Expo SDK and always install compatible packages with `npx expo install <package>` rather than pinning arbitrary npm versions.
3. **Unified Local Date Formatting:** Always use `toLocalDateString()` (`src/utils/dateUtils.ts`) for `YYYY-MM-DD` dates (`workout_date`, `logged_date`, and "Today" queries). Never use `.toISOString().slice(0, 10)` for local calendar dates.
4. **Database Integrity & Exclusive Transactions:**
   * Always run `PRAGMA journal_mode = WAL;` and `PRAGMA foreign_keys = ON;` when opening the SQLite connection in `src/db/client.ts`.
   * For multi-statement restores or batch mutations, use `await db.withExclusiveTransactionAsync(async (txn) => { ... })` and run all queries inside the callback on the `txn` object (`await txn.runAsync(...)`), never on the outer `db` instance.
5. **Full CRUD Support:** Every logging module (Workouts/Sets, Staple & Custom Meals, Weight, and Manual Steps) must support **Creating, Editing, and Deleting** entries.
6. **Optional User Targets:** Never block app usage behind a mandatory target-setup wall. Allow users to skip target setup or leave individual targets as `NULL`. Render goal progress bars only for non-null targets.
7. **Honest MET & Nutrition Estimate Labeling:**
   * Treat workout MET presets (`Light 3.5`, `Moderate 5.0`, `Vigorous 6.0`) as rough approximations. Always display `"Estimated (MET approx.)"` alongside the preset and body weight used.
   * Look up body weight strictly on or before `workout_date` (`logged_date <= workout_date`). Never fall back to a future weight log; if no prior/same-day weight exists, store `NULL` and prompt the user to log a weight.
   * Every meal nutrition total must display an `"Approximate Estimate"` badge.
8. **Step Conflict & Deduplication Safety:** Use OS-level aggregated daily step queries (`HKStatisticsOptionCumulativeSum` / Health Connect `aggregateRecord`) over local midnight-to-midnight boundaries. Never silently overwrite a `source = 'manual'` step entry during automatic foreground sync.
9. **Backup Validation & Destructive Warning:** Validate the entire backup JSON in memory before starting a database transaction, and require explicit user confirmation that restoring **replaces all existing local data**.
10. **Cross-Platform Touch Targets:** Every interactive control must have a minimum hit area of `44x44` logical units (`pt` on iOS / `dp` on Android).
11. **Automated Behavioral Tests:** Maintain passing Jest tests (`npx jest`) for local date utilities, 7-day moving average, workout CRUD & strict prior-weight MET math, staple/custom meal portion math, backup validation/restore, and step conflict/fallback logic.
12. **Measure Before Claiming:** Wrap main dashboard and chart queries with `src/db/profiler.ts` (`performance.now()`). Never write specific millisecond latency numbers in documentation or README files until measured on a real device and logged in `memory.md`.

## 2. Prohibited Practices (NEVER DO)
1. **NO "Vibe-Coded" Gradient Slop:** Never use multi-color gradients (`linear-gradient`), glowing neon borders, or futuristic AI marketing copy. Use plain solid background colors (`#0A0A0C` dark canvas, `#141417` solid cards) and factual labels.
2. **NO Future-Weight Fallbacks or Auto-Mutating Targets:** Never use a future weight log to estimate a past workout's calorie burn, and never write background formulas that automatically alter a user's calorie, macro, or step targets.
3. **NO Deprecated Health Libraries:** Never install `expo-health-connect` alongside `react-native-health-connect` (causes duplicate class build failures on Android) or `react-native-google-fit` (deprecated API).
4. **NO Native Imports in Milestone 1:** Do not import `@kingstinct/react-native-healthkit` or `react-native-health-connect` directly into UI components during Milestone 1 so the app remains 100% testable in standard Expo Go.

## 3. Approved vs. Prohibited Libraries

| Purpose | Approved Library (Install via `npx expo install`) | Prohibited Library (Do Not Use) | Reason |
| :--- | :--- | :--- | :--- |
| **Framework & Routing** | Current stable `expo`, `expo-router` | Manual React Navigation boilerplate | Clean file-based routing & modal support. |
| **Local Database** | `expo-sqlite` | `AsyncStorage` (for logs), `realm` | Supports WAL mode & `withExclusiveTransactionAsync`. |
| **Local Backup / Restore**| `expo-file-system`, `expo-sharing`, `expo-document-picker` | Custom cloud sync servers in v1 | Full local JSON export/import with zero server cost. |
| **Testing** | `jest`, `jest-expo`, `@testing-library/react-native` | Untested service logic | Verifies math, CRUD, restore, and step conflict rules. |
| **Charts** | `react-native-gifted-charts` or `victory-native` | Heavy web-only `chart.js` WebViews | Native SVG/Skia rendering for raw + 7-day moving average lines. |
| **Android Health (M2)** | `react-native-health-connect` | `expo-health-connect`, `react-native-google-fit` | Includes official Expo config plugin directly. |
| **iOS Health (M2)** | `@kingstinct/react-native-healthkit` | Unmaintained RN HealthKit bridges | Modern TypeScript types + Expo config plugin. |
| **Glass Polish (M3)** | `expo-blur` | Heavy custom shader libraries | Clean cross-platform blur for tab bar & modals in Milestone 3. |
