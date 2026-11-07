# HKDSE Physics Revision Break — Architecture

## Purpose

A small revision-break site for HKDSE Physics students. The Concept Check homepage presents topic cards; each card links separately to a topic summary and a ten-question true/false quiz.

The current topics are:

- Kinematics
- Force and Motion

The site is deployed beneath the `concept-check/` path so additional sections can be added to the repository later.

## Deployment layout

```text
dse-physics/
├── .nojekyll
├── ARCHITECTURE.md
├── index.html                    # redirects to concept-check/
└── concept-check/
    ├── index.html                # "Take 5 minutes break!" homepage
    ├── RS_HKDSE_M_Mechanics_TF_Quiz.html
    ├── RS_HKDSE_M_Kinematics.html
    └── RS_HKDSE_M_Force and Motion.html
```

`.nojekyll` remains at the repository root so GitHub Pages serves the files without Jekyll processing.

The root `index.html` is a redirect entry point. The actual homepage lives in `concept-check/`.

## Live URLs

| Page | URL |
|---|---|
| Root redirect | `https://shela1444.github.io/dse-physics/` |
| Concept Check homepage | `https://shela1444.github.io/dse-physics/concept-check/` |
| Kinematics quiz | `https://shela1444.github.io/dse-physics/concept-check/RS_HKDSE_M_Mechanics_TF_Quiz.html?topic=kinematics` |
| Force and Motion quiz | `https://shela1444.github.io/dse-physics/concept-check/RS_HKDSE_M_Mechanics_TF_Quiz.html?topic=force` |
| Kinematics summary | `https://shela1444.github.io/dse-physics/concept-check/RS_HKDSE_M_Kinematics.html` |
| Force and Motion summary | `https://shela1444.github.io/dse-physics/concept-check/RS_HKDSE_M_Force%20and%20Motion.html` |

## Concept Check homepage

### `concept-check/index.html`

The homepage contains:

- the title **“Take 5 minutes break!”**
- a responsive topic grid
- one card per topic
- a Summary link and a Quiz link on each card
- a future-topics note

### Topic routing

The quiz reads its topic from the URL:

| Topic | Quiz URL suffix |
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

Because both the homepage and the linked files live in `concept-check/`, all links remain relative and continue to work after deployment.

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
3. Add a topic card to `concept-check/index.html` with a Summary link and a quiz link using the new `?topic=` value.
4. Verify the ten-question and five-true / five-false constraints.

## Adding another site section

Create a sibling directory at the repository root and add its own `index.html`. Update the root redirect or replace it with a hub page when multiple sections are ready.

## Validation

- Root URL redirects to `concept-check/`.
- Concept Check homepage title is exactly **“Take 5 minutes break!”**
- Both topic quiz URLs render ten questions.
- Each topic has five TRUE and five FALSE answers.
- Both summaries and both quiz links resolve under `/concept-check/`.
- Progress, scoring, results, review, and retry work for both topic modes.
- The combined 20-question quiz is not linked from the homepage.
- Desktop and narrow-screen layouts checked.
- No external dependencies or network requests.
