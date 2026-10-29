# Privet learning rewards and Plus demo

Privet’s native iPhone app has two bundled beginner Russian lessons. The website keeps its interactive café demo and simulated robot. Optional real iPhone BLE connects to the user-tested ESP32 OLED/servo electronics prototype; the illustrated enclosure remains a concept. Hearts, XP and gems do not require hardware, accounts or a backend.

## Hearts and XP

Each lesson attempt starts with three hearts. An incorrect check uses one heart and resets its combo. A zero-heart attempt pauses; the learner can restart for free, spend **20 gems** to refill and continue, or activate the local Plus demo. Retrying a mistake does not restore a first-attempt result. Both lessons remain accessible.

A completed lesson earns 10 base XP, up to three remaining-heart bonus XP, and one bonus XP for each answer in the best first-try combo (up to the number of steps). Failed attempts earn no completion XP. Replays can earn XP and count as finishes; only one practice day is recorded per local calendar day.

## Gems and freezes

| Action | Amount |
| --- | ---: |
| First completion of each lesson per local day | +5 gems |
| That first completion gets every step right on the first try | +5 additional gems |
| Reach a positive practice-streak multiple of seven, once on that local day | +10 gems |
| Heart refill on the out-of-hearts screen | **20 gems** |
| Buy a streak freeze, holding at most two | **30 gems** |

A later perfect replay does not retroactively earn a missed perfect bonus. Replays do not repeat a lesson’s daily completion/perfect award. The daily award breakdown is cumulative; the latest attempt’s breakdown is recorded separately, including zero new gems on an ordinary same-day replay. Old saved data without an attempt breakdown does not fabricate one. Breakdowns already erased by older buggy replays cannot be reconstructed reliably from a spent balance; migration preserves those records without repaying gems or inventing history.

A freeze automatically covers a missed local calendar day only when held freezes can protect the gap. Covered days preserve the chain without adding practice days or incrementing its practice-day count. Freeze consumption, purchases and completion rewards use the same authoritative stats tracker; a later finish cannot restore a consumed freeze. No global timed heart regeneration, gem purchases, ads, account sync or payment services are implemented.

## Privet Plus is local only

Monthly/yearly selections are demo labels with example prices, not real subscriptions or billing periods. Activation gives unlimited hearts locally and can revive a zero-heart attempt. Cancel Plus removes unlimited hearts; following incorrect checks consume hearts again. Activation/cancellation persist only on this device. There is **no payment processing, purchase receipt validation or App Store subscription integration**. Plus does not increase gem awards or change gem prices.

## Storage and implementation

`nativeStats.ts` owns rewards, migrations and the authoritative tracker; `useNativeStats.ts` publishes its snapshots to React/localStorage and checks missed days on lifecycle/midnight updates. Statistics versions 1 and 2 migrate to version 3 without invented XP, gems or freezes. Existing version-3 records accept an absent latest-attempt reward. Legacy completion migration remains supported.

`subscription.ts` / `useSubscription.ts` own the demo selection; `engine.ts` / `useLesson.ts` own lesson hearts, grading and progress. These features do not alter the BLE packet protocol, background connection lifecycle, pronunciation controller or answer-reveal safeguards.
