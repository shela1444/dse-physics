# HKDSE Physics Revision Break — Architecture

## Purpose

A small revision-break site for HKDSE Physics students. The homepage presents topic cards; each card links separately to the topic summary and to a ten-question true/false quiz.

The current topics are:

- Kinematics
- Force and Motion

The page is designed so more topics can be added without changing the layout structure.

## Files

### `index.html`

The homepage. It contains:

- the title **“Take 5 minutes break!”**
- a responsive topic grid
- one card per topic
- a Summary link and a Quiz link on each card
- a future-topics note

### `RS_HKDSE_M_Mechanics_TF_Quiz.html`

The shared quiz engine. It contains both topic question sets and renders only the selected topic.

## Topic routing

The quiz reads its topic from the URL:

| Topic | URL |
|---|---|
| Kinematics | `RS_HKDSE_M_Mechanics_TF_Quiz.html?topic=kinematics` |
| Force and Motion | `RS_HKDSE_M_Mechanics_TF_Quiz.html?topic=force` |

The question bank is stored as two separate arrays:

```js
const QUESTION_BANK = {
  kinematics: [ /* 10 questions */ ],
  force: [ /* 10 questions */ ]
};
```

`?topic=kinematics` uses only the Kinematics array. `?topic=force` uses only the Force and Motion array. The combined 20-question quiz is not exposed through the homepage.

If no valid topic is supplied, the quiz defaults to Kinematics so the page still works when opened directly.

## Homepage link contract

Each topic card has two links:

```text
Summary → existing topic revision summary
Quiz    → RS_HKDSE_M_Mechanics_TF_Quiz.html?topic=<topic-id>
```

Current links:

| Topic | Summary | Quiz |
|---|---|---|
| Kinematics | `RS_HKDSE_M_Kinematics.html` | `RS_HKDSE_M_Mechanics_TF_Quiz.html?topic=kinematics` |
| Force and Motion | `RS_HKDSE_M_Force%20and%20Motion.html` | `RS_HKDSE_M_Mechanics_TF_Quiz.html?topic=force` |

## Quiz runtime structure

```text
HTML
├── All topics navigation
├── Topic-specific hero
├── Start screen
├── Quiz screen
│   ├── topic badge
│   ├── ten-question progress bar
│   ├── question card
│   ├── TRUE / FALSE choices
│   ├── instant feedback panel
│   └── next-question action
└── Results screen
    ├── score out of 10
    ├── selected-topic score card
    ├── missed-question review
    ├── All topics link
    └── retry action
```

## State model

All quiz state is kept in memory:

```js
{
  screen: "start",
  index: 0,
  answers: [],
  selected: null,
  answered: false
}
```

No data is persisted between sessions.

## Question contract

Every question has the same shape:

```js
{
  id: "K1",
  topic: "kinematics",
  statement: "…",
  answer: false,
  explanation: "…",
  source: "Kinematics §1"
}
```

Each topic must provide exactly ten questions with a five-true / five-false balance.

## Interaction rules

- Questions appear one at a time.
- TRUE and FALSE choices are locked after an answer is selected.
- Feedback appears immediately with the correct answer and an explanation.
- Students control progression with a Next button.
- Keyboard support: `1`/`T` for TRUE, `2`/`F` for FALSE, `Enter` for Next.
- Results show a score out of 10, the selected-topic breakdown, and missed questions.
- Retry restarts the same topic.
- “All topics” returns to the homepage.

## Adding a future topic

1. Add the topic metadata to `TOPICS`.
2. Add a ten-question array to `QUESTION_BANK`.
3. Add a topic card to `index.html` with a Summary link and a quiz link using the new `?topic=` value.
4. Verify the ten-question and five-true / five-false constraints.

## Validation

- Homepage title is exactly **“Take 5 minutes break!”**
- Both topic quiz URLs render ten questions.
- Each topic has five TRUE and five FALSE answers.
- Both summaries and both quiz links resolve.
- Progress, scoring, results, review, and retry work for both topic modes.
- The combined 20-question quiz is not linked from the homepage.
- Desktop and narrow-screen layouts checked.
- No external dependencies or network requests.
