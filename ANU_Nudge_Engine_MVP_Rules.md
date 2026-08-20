# ANU Nudge Engine - MVP Rules

This is the clean MVP rule source. It intentionally replaces the older mixed rule document.

## Daily Structure

ANU sends up to three nudges per day:

1. Morning
2. Afternoon
3. Evening/Night

Each slot sends at most one card. Each card counts as one nudge.

## Morning

Morning card contains exactly:

1. Sleep
2. Energy
3. Mood

### Sleep

Question:

> Good morning. Before your day begins, tell me how your sleep was last night.

Options:

- I slept well
- I woke up 1-2 times
- I had disturbed sleep
- I barely slept
- I woke up sweaty or uncomfortable

### Energy

Question:

> How is your energy this morning?

Options:

- Fresh and active
- Slightly low
- Very tired
- Heavy body feeling
- Mentally tired, even after sleeping

### Mood

Question:

> What is your emotional state right now?

Options:

- Calm
- Irritated
- Sad
- Anxious
- Emotionally numb
- I don't know

## Afternoon

Afternoon card contains exactly:

1. Stress
2. One rotating L2

The rotating L2 must be exactly one of:

- Brain fog
- Cravings
- Food rhythm

### Stress

Question:

> On a simple level, how stressful has today felt so far?

Options:

- Low stress
- Manageable
- Stressful
- Very stressful
- I feel overwhelmed

### Brain Fog

Question:

> How has your focus been today?

Options:

- Clear and focused
- Slightly distracted
- Forgetful
- Brain fog
- Unable to concentrate

### Cravings

Question:

> Have you noticed any cravings today?

Options:

- No cravings
- Sweet cravings
- Salty cravings
- Tea/coffee cravings
- Fried/snack cravings
- I felt hungry even after eating

### Food Rhythm

Question:

> How was your eating pattern today?

Options:

- Balanced
- Skipped meals
- Ate late
- Overate
- Had cravings
- Not sure

### Afternoon L2 Rotation Rule

For MVP, use a simple rotation:

1. Brain fog
2. Cravings
3. Food rhythm

Then repeat.

Do not add Hydration to the afternoon rotation.

## Evening/Night

Evening/Night card contains exactly:

1. Hot flashes
2. Hydration
3. Plan adherence
4. Evening mood

Do not include Period/Cycle in the MVP Evening/Night card.

### Hot Flashes

Question:

> How many hot flashes or sudden heat episodes did you notice today?

Options:

- None
- 1-2
- 3-5
- More than 5
- Not sure

### Hydration

Question:

> How much water did you drink today?

Options:

- Less than 2 glasses
- 2-4 glasses
- 5-6 glasses
- More than 6 glasses
- I forgot to track

### Plan Adherence

Question:

> Were you able to follow today's care suggestion?

Options:

- Yes, fully
- Partly
- I forgot
- I couldn't manage today
- I did not feel like doing it

MVP rule:

- Use today's care suggestion as the reference.
- Do not gate this tracker on care-plan assignment in MVP.

### Evening Mood

Question:

> Did your mood change suddenly today?

Options:

- No, mood was stable
- Mild mood changes
- I felt irritated suddenly
- I cried or felt emotional
- I felt anxious suddenly
- I had multiple mood shifts

## MVP Dispatch Rules

1. Maximum three nudges per day.
2. Morning sends the Morning card.
3. Afternoon sends the Afternoon card.
4. Evening/Night sends the Evening/Night card.
5. If a slot card was already completed manually that day, do not send that slot's nudge again.
6. Nudge count resets at midnight.

## Out Of MVP

Do not implement these in MVP:

- Period/Cycle
- Hydration in afternoon
- Evening L2 append
- Weekend-specific logic
- L3 pattern nudges
- Complex personalization
- Care-plan gating for Plan adherence
- Dietician gating for Cravings or Food rhythm
