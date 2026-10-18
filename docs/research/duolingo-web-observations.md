# Historical research: Duolingo public web client

This is a research record, not product documentation or a current competitive comparison. Earlier work inspected competitor client code. The previous notes recorded downloading public JavaScript bundles, statically analyzing lesson-related modules, and reading minified functions. Removing Privet’s comparison UI does not change that history.

The earlier record described the following method on **2026-10-18**; this review did not rerun or independently reproduce that capture:

1. REA `capture_browser_scenario` opened https://www.duolingo.com/ in headless Chrome without an account or login and recorded loaded scripts.
2. `export_web_scripts` exported scripts. The webpack manifest `manifest-9de2ea75.js` identified lazy chunks.
3. The notes report downloading 290 manifest chunks plus `app-4d4b32e8.js` and `4779-9b5aed3c.js` from the public CDN `d35aaqx5ub95lt.cloudfront.net`.
4. `analyze_javascript_application` reportedly parsed eight lesson-related files / 209 modules without parse failures; selected minified functions were inspected. A later gems analysis recorded 479 modules without parse failures.
5. Lesson analysis was static, not a completed, authenticated learner session. The initial browser capture did load the public application; “static analysis” must not be read as saying no browser scripts executed.

Recorded evidence identifiers were abbreviated: capture `ev_9c5a9aab3f600a6f…`, export `ev_e846c4375077bbdb…`, initial analysis `ev_8ed020fb06a27a35…`, later gems analysis `ev_65ee8ff7…`. These identifiers are provenance notes, not reproducible artifacts included here. Bundle filenames identify that snapshot, not current behavior.

## Observations recorded at the time

| Area | Recorded observation and source location |
| --- | --- |
| Exercises | Debug fixtures listed about 40 challenge types, including selection, typed/tapped translation, listening, matching, speaking, dialogue, cloze and reading. |
| Lesson state | The session reducer in `app-4d4b32e8.js` tracked challenge index/attempts, heart mode, remaining hearts, current/best correct-answer streaks, results and completion/failure state. It distinguished session hearts from unlimited hearts. Wrong answers reset the combo and consumed a session heart; some non-test mistakes were reinserted for later practice. A final-level path referenced three hearts. This does not establish a universal current heart limit. |
| XP | Module 7432 in `179-*.js` and constants in module 97106 described a base lesson reward of 10, a remaining-heart bonus capped at three (four for a beginner branch), a rounded best-combo bonus up to five, an optional double multiplier, a final-level base of 40 and zero reward on failure. Those are historical observations, not a current universal reward formula. |
| Daily streak | `1469-*.js` / module 97106 bucketed XP by local day, used the first positive XP session to extend the day’s streak, and consumed server-supplied streak data. Freeze/repair offers existed. |
| Course path | Module 99644 in the app entry and `path-*.js` tracked locked/active/passed/final levels; finishing a level activated a following level. A session route guard checked locked state. |
| Hearts outside lessons | `4243-*.js` / `4769-*.js` referenced timed heart regeneration, a roughly five-second client poll, gem refills and subscriber unlimited hearts. These observations are not Privet’s behavior. |
| Subscription and ads | The hearts menu referenced premium offers, and `179-*.js` included session-end advertising slides alongside progress/reward slides. |
| Persistence/network | The inspected lesson paths fetched/submitted sessions and refreshed user/course/health/streak/XP data. This was client inspection, not a complete privacy or network audit. |
| Presentation | Notes recorded on-screen character animations and course-dependent transliteration settings. A text search of downloaded chunks reportedly found no Bluetooth/request-device references; absence in that search cannot establish absence from other products/platforms. |
| Gems | The snapshot referenced a 350-gem pre-lesson refill and a 450-gem mid-lesson refill, other server-priced refill variants, a free early-user refill branch, a two-freeze holding limit, final-level purchases, a wager item, chest/quest rewards and practice-based heart recovery. Reward amounts and some eligibility/prices were server-controlled. Reading those branches did not verify that any particular learner received those offers. |

These are bounded observations from one changing client snapshot. Availability, experiments, platform differences and server behavior were not verified. They should not be republished as universal or current competitor claims.

## Privet decisions and the removed comparison

Earlier Privet work used this research when designing session hearts, a combo/XP formula, local streaks, unlimited-hearts demo plans and learning-earned gems. The branch also included a public comparison table/screen. This review removed that table, its navigation and its code/styles, replacing it with descriptions of Privet’s own implemented features. The original comparison’s broad claims and “one fixed price for everything” wording were unsuitable: Privet uses separate 20-gem refill and 30-gem freeze prices.

Current product rules live separately in [Privet learning rewards](../learning-rewards.md). Research notes do not define runtime behavior.

Downloaded third-party bundles, exported scripts and extracted source files are not included in this repository’s proposed changes. This document records the inspection in prose and source-location references, rather than republishing vendor source. It makes no claim that competitor code was never inspected or downloaded, and does not rewrite Git history.
