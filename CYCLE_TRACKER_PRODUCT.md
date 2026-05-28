# Cycle Tracker — Product Logic

## What we track

- **Last period start date** — when the most recent period began
- **Cycle length** — how many days between the start of one period and the start of the next (user sets this, default 28 days)
- **Period length** — how many days the period typically lasts (user sets this, default 5 days)

---

## How we calculate everything

### Current cycle day
Count of days since the last period started.
> Example: Period started May 27 → today is June 3 → Day 8 of cycle

### Phases of the cycle
The cycle is divided into 4 phases. Where each phase falls depends on the user's cycle length.

| Phase | When it occurs | What it means |
|-------|---------------|---------------|
| **Period** | Day 1 to end of period length | Active bleeding |
| **Follicular** | After period ends, until just before ovulation | Body preparing an egg |
| **Ovulatory** | Around ovulation day (±1 day) | Egg is released |
| **Luteal** | After ovulation until next period | Post-ovulation window |

### Ovulation day
Ovulation happens approximately **14 days before the next period**, regardless of cycle length.

> Formula: Cycle length − 14 = ovulation day number in the cycle
>
> Example: 28-day cycle → ovulation on Day 14
> Example: 35-day cycle → ovulation on Day 21

### Fertile window
The window when pregnancy is possible. Sperm can survive up to 5 days, and the egg lives about 1 day after ovulation.

> Fertile window = 5 days before ovulation through 1 day after ovulation (6 days total)
>
> Example: Ovulation on Day 14 → Fertile window is Days 9–15

### Next period date
> Last period start date + cycle length
>
> Example: Period started May 27, cycle is 28 days → next period expected June 24

---

## How period length is determined

1. **On setup** — user tells us their typical period length (1–10 days)
2. **Refined over time** — as the user logs actual period end dates, we calculate the average length from their real history and use that instead

This means predictions get more accurate the more the user logs.

---

## Phase colours (in the app)

| Phase | Colour |
|-------|--------|
| Period | Red |
| Follicular | Purple |
| Ovulatory | Yellow |
| Luteal | Blue |

---

## What the user can log

- **Period started today** — marks a new period beginning
- **Period ended today** — marks when the current period ended (used to refine period length over time)

---

## Limitations & assumptions

- Ovulation timing uses the standard **Luteal Phase Constant** (14 days before next period). This is a population average and will vary person to person.
- Fertile window is an estimate. It does not account for irregular cycles or hormonal conditions.
- All predictions improve as the user logs more cycles over time.
- This tracker is designed for **perimenopause-stage users** where cycles may be irregular. Predictions should be treated as estimates, not medical guidance.
