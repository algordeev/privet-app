# How Duolingo's lesson mechanics work (reverse-engineering notes)

These notes describe how Duolingo's web app (duolingo.com) runs a lesson. They
were recovered with REA from the JavaScript Duolingo publicly serves, and they
explain which mechanics Privet adapts. No Duolingo code or assets were copied;
Privet's implementation is original and only reuses the *ideas* listed here.

## Method

| Step | What was done |
| --- | --- |
| 1 | REA `capture_browser_scenario` loaded `https://www.duolingo.com/` in headless Chrome (no account, no login) and recorded the scripts it loaded. |
| 2 | REA `export_web_scripts` wrote those scripts to disk. The webpack manifest (`manifest-9de2ea75.js`) lists every lazy chunk (`session`, `path`, `pathSections`, `homePage`, …). |
| 3 | The 290 public chunks named in that manifest plus the entry bundles `app-4d4b32e8.js` and `4779-9b5aed3c.js` were downloaded from the public CDN (`d35aaqx5ub95lt.cloudfront.net`). |
| 4 | REA `analyze_javascript_application` parsed the lesson-related chunks statically (8 files, 209 modules, 0 parse failures). The code was never executed. |
| 5 | Specific functions were then read from the minified source at the locations below. |

Evidence IDs (REA session): browser capture `ev_9c5a9aab3f600a6f…`, script export
`ev_e846c4375077bbdb…`, application analysis `ev_8ed020fb06a27a35…`.
Capture date: 2026-10-18. Bundle hashes change on every Duolingo deploy, so the
file names below identify this snapshot only.

Observed means read directly in code. Inferred means a reasonable reading of
minified code whose runtime behaviour was not exercised.

## 1. A lesson is a list of typed challenges (observed)

The bundle includes Duolingo's own debug fixture sessions (`debug0-*.js`). A
session has `type`, `skillId`, `levelIndex`, `levelSessionIndex` and a
`challenges` array. Each challenge has a `type`, `prompt`, `choices` /
`correctIndex` or `correctTokens`, `tts` audio URLs and `metadata`.

40 challenge types appear, including `select`, `translate`, `listenTap`,
`match`, `tapComplete`, `speak`, `judge`, `name`, `dialogue`, `gapFill`,
`characterMatch`, `typeCloze` and `readComprehension`. Privet's `vocabulary`,
`choice`, `sentence` (tap-to-build) and `typed` kinds are small equivalents of
`match`/`select`/`translate`(tap)/`translate`(typed).

## 2. Lesson state machine (observed, `app-4d4b32e8.js` session reducer)

Initial lesson state includes:

```
currentIndex, challengeStates, challengeAttemptCounts,
heartsType: "unlimitedHearts" | "sessionHearts", maxHearts,
currentInLessonStreak, maxInLessonStreak, completedWithHeartsRemaining,
numChallengesAnswered, numChallengesCorrect, numChallengesSkipped,
recycledMistakeIndexToOriginalMistakeIndex, strength, status
```

When an answer is graded:

- **Correct:** `currentInLessonStreak + 1`, and
  `maxInLessonStreak = max(current, max)`.
- **Wrong:** `currentInLessonStreak` resets to 0. If `heartsType` is
  `"sessionHearts"`, `session.heartsLeft - 1`.
- **Wrong, outside tests:** the challenge is copied and inserted at the end of
  its section, so it comes back later (Duolingo's "recycled mistakes"). Unit
  and section tests skip this.
- The grading UI moves through states such as `Blaming` (showing feedback),
  with separate correct and incorrect animations.

The lesson header renders a heart counter, `left: session.heartsLeft,
total: maxHearts`, gold on the final (legendary) level and red otherwise.
`isFinalLevel` lessons track `final_level_subtract_heart` with
`3 - heartsLeft`, so session-hearts levels start with **3 hearts**.

## 3. XP formula (observed, module 7432 in `179-*.js` and constants in module 97106)

```
lessonXp = (BASE + heartsBonus + comboBonus) * boost

BASE        = 10        // Lesson, LexemePractice, SpacedRepetition, UnitPractice
heartsBonus = min(max(0, heartsLeft), beginner ? 4 : 3)
comboBonus  = n > 0 && 0 < maxInLessonStreak <= n ? ceil(5 * maxInLessonStreak / n) : 0
boost       = hasBoost ? 2 : 1          // XP boost multiplier
legendary   = 40 base
failed      → xpGain: 0
```

where `n` is `session.challenges.length`. On the session-end screen the combo
bonus appears only when `completedWithHeartsRemaining` is true.

## 4. Streak = a day with XP (observed, `1469-*.js`, module 97106)

- `v(timezone, xpGains)` buckets XP events into the last 7 local days (a
  7-element array, today last). `_` returns today's XP.
- `streakExtended = awardedXp > 0 && todayXpBeforeThisSession === 0`: the
  first XP-earning session of a local day extends the streak.
- The server returns `streakData{currentStreak,longestStreak,previousStreak}`.
- Streak freezes (`shop.misc.streak_freeze`) and streak repair offers exist as
  shop items and slides.

## 5. Path progression (observed, `app-4d4b32e8.js` module 99644, `path-*.js`)

- The course path is `units[].levels[]`. Each level has `state` ∈
  `locked | active | passed | legendary` plus `finishedSessions` /
  `totalSessions`, and some levels are typed `unit_test`, `chest`, `alphabet_gate`, ….
- Finishing a level session on an `active` level sets it to `passed`. The next
  `locked` level (or the first level of the next unit) becomes `active`.
- A route guard (`session-*.js`) refuses to open a level whose state is `locked`.

## 6. Hearts outside a lesson (observed, `4243-*.js` / `4769-*.js`)

Global hearts (`hearts`, `maxHearts`) regenerate over time. The client polls
about every 5 s and shows `nextHeartRefillTimestampMs`. A refill can be bought
with gems when `hearts < maxHearts && gems >= price`. Subscribers get unlimited hearts.

## 6a. Subscription (Super) (observed, `app-4d4b32e8.js`)

The lesson reducer accepts `heartsType: "unlimitedHearts"` as well as
`"sessionHearts"`; wrong answers decrement hearts only in session-hearts mode.
The hearts menu can show a premium offer tracked as `premium_ad_show` with
`iap_context: "hearts_dropdown"`. Subscription access provides unlimited hearts.

## 7. Session-end slides (observed, `179-*.js`)

Slides are queued after a lesson: `sessionComplete`, `streakExtended`,
`dailyQuestComplete`, `checkpointComplete`, `mistakesInboxEmpty`,
`finalLevelFailed`, and so on.

## What Privet adopts

| Duolingo mechanic | Privet adaptation |
| --- | --- |
| Session hearts (3) | Each lesson attempt starts with 3 hearts. Every incorrect check costs one, and at 0 the lesson attempt fails and can be restarted. No global timer or purchase. |
| Super subscription / unlimited hearts | Privet Plus is a simulated local subscription. Plus lessons keep all 3 hearts after mistakes; the subscription is stored on this device and no payment is processed. |
| In-lesson combo | Consecutive correct answers on the first try. A mistake resets it. |
| XP formula | `10 + min(heartsLeft, 3) + ceil(5 × bestCombo / steps)`. A failed attempt earns 0. |
| XP streak / 7-day view | Daily XP is recorded locally next to the existing finish-based streak. The profile shows today, the 7-day XP and total XP. |
| Path `passed` / `active` | Lesson cards show Passed, or Up next for the first unpassed lesson. Both lessons stay open; Privet deliberately does not lock lessons. |

Not adopted: global hearts refill, gems, boosts, leagues, streak freezes,
recycled-mistake requeueing, and server sync.

## Evidence for the "Privet vs Duolingo" table

The in-app comparison (`src/comparison.ts`) only states facts that can be checked:

| Row | Duolingo evidence | Privet evidence |
| --- | --- | --- |
| Learning buddy | Characters are on-screen Lottie animations (`lottie_light_canvas` chunk). A search of all 292 downloaded chunks found no `bluetooth` / `requestDevice` code. | ESP32 OLED + servo firmware in `firmware/`, BLE protocol in `docs/companion-ble.md`. |
| Running out of hearts | Section 6: global hearts regenerate on a timer (`nextHeartRefillTimestampMs`) or are bought with gems. | Section "What Privet adopts": per-lesson hearts with a restart button. |
| Ads | The session-end slide list in `179-*.js` pushes `{type:"nativeAd"}`; the hearts menu tracks `premium_ad_show`. | The app has no ad code. |
| Account & data | `179-*.js` submits each session to the server and reloads `userInfoPartial(...)` (courses, health, streakData, xpGains). | Progress and stats are kept in `localStorage` only (`session.ts`, `nativeStats.ts`). |
| Internet | Sessions are fetched and submitted over the network (`sessionPrefetchedTimestamp`, `session_end_attempt`). | Lessons are bundled in `src/lessons.ts` / `src/lesson.ts`. The native build has no `server.url`. |
| Pronunciation help | The lesson header shows a transliteration-settings button only for some courses (`transliterations-settings`). | Every `Word` has `pronunciation` and `stressed` fields (`src/lesson.ts`). |
| Gems | `health_refill` costs 350; `health_refill_reactive` costs 450 in the mid-lesson out-of-hearts drawer (`4243-*.js` / `4769-*.js`). | Local learning-only currency with fixed gem prices (`src/nativeStats.ts`). |

The table also says where Duolingo is ahead (exercise variety, course count, social features), so the comparison stays fair.

## Duolingo gems: observed mechanics

The same public web bundle snapshot was analysed with REA `analyze_javascript_application` on `app-4d4b32e8.js`, `4243-*.js`, `4769-*.js`, and `179-*.js`: 479 modules, 0 parse failures (analysis evidence `ev_65ee8ff7…`). These are observations from the client code; server-controlled values remain unknown.

The currency is gems, internally `currencyType:"XGM"` (formerly “lingots”), with the balance in `user.gemsConfig.gems`.

| Mechanic | Observed evidence |
| --- | --- |
| Heart refill before a lesson | `{id:"health_refill",price:350}` in the app bundle. |
| Refill after running out mid-lesson | `{id:"health_refill_reactive",price:450}`: the price rises at the moment the learner is stuck. |
| Other refill prices | `health_refill_partial_1..4`, `health_refill_discounted`, and `health_segment` are server-set. |
| New-user refill | `sessionCount<3` gives a zero-price refill for the first three sessions. |
| Streak freeze | `shop.misc.streak_freeze`; at most two can be held (`L>=2`). It is offered when the streak is at least 3 and the gem balance meets a threshold; pricing is server-set. |
| Legendary/final level | `final_level_purchase_drawer_show {price}` records a gem-priced purchase. |
| Gem wager | A `"gem_wager"` item exists; its web surface says “not supported”. |
| Earning | Lesson-end chest `chestLingotsReward {currency:"GEMS",amount}`; level-up chests (`currencyReward`); daily/friends quests (`dailyQuestReward` → `pendingRewards`). Ads can boost the lesson chest. |
| Practice refill | Hearts can also be restored through `health_refill_method:"practice"`. |

Reward amounts are not present in the client code and are set by the server. The client also exposes several pressure patterns: a 350-to-450 gem price increase when stuck, hearts that refill on a timer, Super ads in the same hearts/gems drawers (`premium_ad_show`, `iap_context:"hearts_dropdown"`), gem wagers, and server-hidden reward amounts with ad boosts.

## Privet gem rules

Privet uses **earn by learning, fixed prices**. The rules are shown in the app:

| Rule | Amount |
| --- | ---: |
| Finish a lesson, once per lesson per local day | +5 gems |
| Get every step right on the first try | +5 gems |
| Reach each positive streak multiple of 7 days | +10 gems |
| Refill hearts on the Out of hearts screen | 20 gems, every time |
| Buy a streak freeze, holding at most two | 30 gems |

Gems cannot be bought with money; there are no ads, bets, hidden rewards, or changing prices. Plus users earn exactly the same gems as everyone else and receive no gem advantage. Replays can still count as lesson finishes and XP, but cannot farm the daily lesson gem award. A perfect reward uses the saved first-try results, so unlimited hearts do not create an advantage. A freeze covers one missed local calendar day, preserves the streak chain, and does not increment the practiced-day streak count.
