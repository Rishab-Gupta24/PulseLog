# UI/UX Design Specification (`design.md`)

## 1. Core Priority: Functional Clarity Before Visual Polish
* **Milestone 1 & 2 Rule:** Build the entire app using **plain, flat, high-contrast solid colors** first. Get logging, editing, deleting, backup/restore, and the weight chart working smoothly before touching any blur effects or web animations.
* **Milestone 3 Rule:** Only after the core app and test suite are complete, apply restrained Liquid Glass translucency (`dickwu/apple-design-skill`) to the navigation bar/modals and build the optional `/web` showcase.

## 2. Integrating Apple HIG Reference (`dickwu/apple-design-skill`)
To keep spacing, typography, and touch targets aligned with Apple Human Interface Guidelines, add the reference skill repository:

```bash
git submodule add https://github.com/dickwu/apple-design-skill.git .design-rules
```

## 3. How Not to Look "Vibe-Coded" (Anti-Slop Visual Rules)

1. **Plain Solid Colors Only (Zero Gradients):** Never use `linear-gradient` or `radial-gradient` on backgrounds, cards, or buttons. Separate solid surfaces using crisp `1px` (`StyleSheet.hairlineWidth`) borders.
2. **Strict 8pt Spacing Grid:** All padding, margins, and layout gaps must use multiples of `8` logical units (`8, 16, 24, 32, 48`).
3. **Minimum 44×44 Logical Unit Touch Targets:** Every button, portion selector pill, intensity selector, and edit/delete control must have at least a `44×44` logical unit (`pt` on iOS / `dp` on Android) tappable area (`minWidth: 44, minHeight: 44`).
4. **Tabular Numerals Everywhere:** Apply `fontVariant: ['tabular-nums']` to all weight, rep, calorie, macro, and step numbers so digits align vertically and never jitter.
5. **Uncluttered Screens:** Maximum 3 distinct cards visible without scrolling.

## 4. Plain Solid Color Tokens (`src/constants/theme.ts`)

| Token | Dark Mode (Default) | Light Mode | Usage |
| --- | --- | --- | --- |
| `bg.canvas` | `#0A0A0C` | `#F5F5F7` | Main screen background (100% solid). |
| `bg.card` | `#141417` | `#FFFFFF` | Solid cards, workout containers, and list rows. |
| `bg.input` | `#1C1C21` | `#EBEBF0` | Text inputs and unselected portion/intensity pills. |
| `border.hairline` | `#26262C` | `#E2E2E8` | `1px` solid card borders and row dividers. |
| `text.primary` | `#F5F5F7` | `#1D1D1F` | Primary headings, exercise titles, and numbers. |
| `text.secondary` | `#8E8E93` | `#6E6E73` | Units (`kg`, `kcal`, `g`) and secondary labels. |
| `accent.primary` | `#0A84FF` | `#007AFF` | Primary action buttons, selected pills, 7-day average line. |
| `accent.success` | `#30D158` | `#34C759` | Completed set checkmarks and target completion indicators. |
| `accent.estimate` | `#FF9F0A` | `#FF9500` | Badge text for `"Approximate Estimate"` and `"MET approx."` labels. |
| `accent.danger` | `#FF453A` | `#FF3B30` | Delete log and destructive backup-replace confirmation buttons. |

## 5. Key Interaction Patterns & Edge-Case States

* **Optional Targets Display (`Today` & `Nutrition` Tabs):**
  * If a user has set a target (e.g., `daily_protein_g = 140`), display `"95 / 140 g"` with a clean horizontal progress bar.
  * If a user skips or clears a target (`NULL`), display `"95 g logged today"` with **no progress bar** and a subtle `"Set target"` link—never show `0 / 0` or broken NaN bars.
* **Rough MET Preset & Prior-Weight Display (`Workouts` Tab):**
  * Include a 3-option segmented control for rough activity intensity: `Light (~3.5 MET)` | `Moderate (~5.0 MET)` | `Vigorous (~6.0 MET)` alongside `Duration (min)` and `Workout Date (YYYY-MM-DD)`.
  * When a body weight log exists on or before `workout_date`, display the estimate and its assumptions: `"Estimated Burn: ~250 kcal (Rough MET preset: Moderate 5.0 MET @ 75.0 kg • 40 min)"`.
  * When no body weight log exists on or before `workout_date`, display a muted note: `"Log a body weight on or before this date to estimate calorie burn"`.
* **Staple vs. Custom Meal Portion Picker (`Nutrition` Tab):**
  * **Staple Food Mode:** Selecting a staple item (e.g., *Cooked White Rice — ref: 1 Fist ~150g = 195 kcal*) presents its portion pills (`0.5 Fist`, `1 Fist`, `1.5 Fists`, `2 Fists`) and live-updates the `Approximate Estimate` macros.
  * **Custom Meal Mode:** User enters `Meal Name`, `Base Calories` (and optional `Protein`, `Carbs`, `Fat`), then selects `Small (0.75x)` | `Medium (1.0x)` | `Large (1.5x)`.
* **Step Source Badge & Conflict Resolution (`Trends` Tab):**
  * Show a small source badge next to today's step count: `"Manual entry"` or `"Synced from HealthKit / Health Connect"`.
  * If today's entry is `"Manual entry"` and native sync is enabled, show a secondary button `"Replace with Health Sync"` so the user is always in control of overwriting manual data.
* **Destructive Restore Confirmation (`Targets / Settings` Modal):**
  * Tapping **Import Backup JSON** validates the file first, then triggers a native confirmation modal with a red destructive action (`#FF453A`): *"Replace All Existing Data? Restoring this backup will overwrite all current logs on this device."*

## 6. Milestone 3 Polish Specs (Deferred Until Core App Is Complete)

* **Restrained Liquid Glass (Mobile):** Apply `expo-blur` (`intensity={65}`, `tint="dark"`, `backgroundColor: 'rgba(20, 20, 23, 0.72)'`, `1px` top border `rgba(255, 255, 255, 0.12)`) **only** to the floating bottom tab bar and modal sheets—never on scrolling data cards.
* **Portfolio Showcase Website (`/web`):** A static HTML/CSS/JS site using the same `#0A0A0C` solid background and `#0A84FF` accent to display real recordings of the working app, the SQLite architecture diagram, test coverage results, and verified device benchmarks.
