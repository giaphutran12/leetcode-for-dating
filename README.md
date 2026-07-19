# RizzCode

RizzCode is LeetCode-style conversation practice for men who want respectful, intentional relationships. Each exercise gives you a realistic social scenario, three turns to build a genuine connection, and concrete feedback on what worked.

The GPT Taste direction won the prototype comparison and now serves as the main experience:

- `/`: the selected editorial RizzCode experience
- `/control`: the original developer-tool control, retained as a design reference
- `/compare`: the original side-by-side design picker

All routes share the same scenario, scoring model, and three-turn interaction.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The selected experience is now the home page.

To verify a production build:

```bash
npm run build
```

## Current scope

The checked-in UI is still a front-end prototype with static scenarios, mock profile
context, and simulated judging. The approved build replaces that fake score with a
required server-side LLM judge powered by Vercel AI SDK v6 and the direct OpenAI
provider. Supabase, TinyFish, authentication, live social-profile access, and voice
transcription remain outside the MVP.

The approved, implementation-grade source of truth lives in
[docs/RIZZCODE_MASTER_PLAN.md](docs/RIZZCODE_MASTER_PLAN.md). The older
[docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md) is retained as prototype history.

## Relationship standard

RizzCode is for men from any background. It coaches attention, honesty, self-control, mutual interest, and a considerate next step. The product does not coach hookups, sexual pressure, manipulation, or treating another person as a target to optimize.
