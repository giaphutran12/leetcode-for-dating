# RizzCode Brand System

Version 1.0 · July 2026

This is the source of truth for RizzCode identity and product presentation.
Future product work should consume the package in `src/design-system` instead
of recreating colors, spacing, typography, logos, or common components.

The system copies no visual language from TinyFish or any other company.
RizzCode is its own brand. The adopted practice is to make brand decisions
explicit, reusable, and enforceable so humans and coding agents can ship
consistent work quickly.

## Brand idea

**Position:** conversation practice for dating and grounded social fluency.

**Promise:** build real conversational skill through realistic reps, adaptive
reactions, and specific feedback.

**Brand sentence:** Rizz is not a trick you deploy. It is a social skill you can
calibrate through good reps.

**Operating principles:**

1. Practice over performance.
2. Specific feedback over vague confidence advice.
3. Personality with respect.
4. Progress without manipulation.
5. Editorial clarity over app-store noise.

## Identity

The canonical identity is the **Rizz Meter** from the selected Generated image
3 direction.

The meter is the visual metaphor for calibration. The lime marker moves through
the word `RIZZ` and the R mark to show that social fluency is trainable,
observable, and never permanently fixed.

### Logo hierarchy

| Asset | Use | Do not use |
| --- | --- | --- |
| Primary lockup | Navigation, auth, product chrome, press | As decorative hero art |
| R mark | Favicons, avatars, compact controls | Next to a second competing icon |
| Meter wordmark | Heroes, launch moments, large campaign layouts | Below 160 px wide |
| Inverse lockup | Oxblood or ink surfaces | On parchment or photography |
| Brand board | Reference and review only | As a production UI image |

Source and generated files are documented in
[`docs/brand/README.md`](brand/README.md).

### Clear space

Leave at least one lime-dot diameter on every side of the mark or lockup. Never
let text, rules, or container edges enter that space.

### Minimum sizes

- R mark: 24 px digital.
- Primary lockup: 132 px wide digital.
- Meter wordmark: 160 px wide digital.
- Descriptor `CONVERSATION PRACTICE`: remove it before making it unreadable.
  Never fake legibility by sharpening or stretching the asset.

### Prohibited logo treatment

- Do not rebuild the logo with live text.
- Do not rotate, skew, outline, add shadows, or recolor individual letters.
- Do not put the standard lockup on dark surfaces. Use the inverse asset.
- Do not use the old `RC` text pill.
- Do not add hearts, lips, flames, roses, pickup-artist symbols, or AI sparkles.
- Do not turn the meter into a Wi-Fi icon, finance chart, or generic loading
  spinner.

### Supporting motifs

The two other finalist directions remain useful, but they are not master logos.

- **Rank chevron:** use only for levels, ranks, XP, and achievement states.
- **Patch Notes cursor +1:** use only for release notes, improvement campaigns,
  social posts, and “what changed” moments.

This creates a flexible brand family without making three marks compete.

## Color

All application code uses semantic CSS tokens from
`src/design-system/tokens.css`. Hex values belong only in that token source.

| Token | Value | Role |
| --- | --- | --- |
| Parchment | `#F2E8D5` | Main canvas |
| Cream | `#FFF8ED` | Raised surfaces and inputs |
| Ink | `#171612` | Primary text and actions |
| Ink Soft | `#302E28` | Secondary dark surfaces |
| Oxblood | `#6D1F2A` | Identity, emphasis, boundaries |
| Oxblood Bright | `#9C3843` | Focus and active feedback |
| Lime | `#C5F35F` | Earned progress and positive momentum |

### Color rules

- Parchment is the default background. Pure white is not.
- Ink carries body text and primary CTAs.
- Oxblood communicates RizzCode identity, deliberate emphasis, and boundaries.
- Lime is scarce. Use it for progress, earned states, and the meter marker.
- Never use lime as large body text on parchment.
- Error and success colors must use the semantic tokens, not improvised green
  or red.

## Typography

### Families

- **Satoshi:** product UI, display type, navigation, body copy, buttons.
- **Playfair Display:** moments of intent, emotional emphasis, editorial turns.
- **DM Mono:** rare metadata, model labels, debug-adjacent product copy.

### Hierarchy

- Display headings are large, tight, and sentence case.
- Editorial emphasis is one phrase, not a whole paragraph.
- Labels are uppercase, compact, bold, and tracked.
- Body copy stays conversational with generous line height.
- Avoid title case for ordinary UI actions.

### Writing examples

Use:

- `Start practice`
- `Follow the thread`
- `Three reps down.`
- `Build the reps. Keep the receipts.`

Avoid:

- `Unlock Your Ultimate Charisma`
- `Seduction Mastery`
- `AI-Powered Romantic Optimization`
- Vague SaaS language such as `Leverage insights to maximize outcomes`

## Spacing and layout

The system uses a four-point spacing grid. Components use only the
`--rc-space-*` tokens.

- 4–12 px: icon, label, and micro-control spacing.
- 16–24 px: component interiors.
- 32–48 px: card and section relationships.
- 64–120 px: major page rhythm.

Product layouts favor strong editorial alignment, visible rules, and deliberate
negative space. Avoid dense dashboard grids unless the information truly needs
comparison.

## Shape, borders, and elevation

RizzCode is editorial, not bubbly.

- Default controls use square or 2 px corners.
- Small utility surfaces may use 6–10 px corners.
- Pills are reserved for status and progress.
- Borders are usually 1 px ink or a semantic translucent rule.
- Shadows are rare and reserved for floating or layered interaction.
- Do not introduce glass cards, neon gradients, or soft SaaS blobs.

## Motion

Motion should feel responsive and earned.

- Fast feedback: 140 ms.
- Activity hover feedback: 70 ms.
- Standard transitions: 220 ms.
- Large reveals: 420 ms.
- Use the standard easing token.
- Prefer short vertical movement and meter progression.
- Respect `prefers-reduced-motion`.
- Avoid perpetual motion, decorative spinning, bounce loops, and confetti by
  default.

When building a spinner, prize wheel, or lucky draw, use the same tokens and
motion grammar. The wheel can be playful without inventing a new palette,
typography stack, shadow system, or control language.

## Iconography and imagery

- Use Phosphor icons already installed in the repository.
- Default to regular or duotone weight.
- Use fill only for earned or active state.
- Icons support labels; they do not replace unclear language.
- Photography should feel candid, grounded, and socially believable.
- Avoid manosphere clichés, luxury flex imagery, staged romance, and generic AI
  illustrations.

## Component contract

Import from the package boundary:

```tsx
import {
  BrandBadge,
  BrandButton,
  BrandLink,
  BrandLogo,
  BrandSurface,
  RizzMeter,
} from "@/design-system";
```

Use semantic intents instead of styling one-off variants:

```tsx
<BrandButton intent="primary">Start practice</BrandButton>
<BrandButton intent="lime">Claim XP</BrandButton>
<BrandBadge tone="brand">In person</BrandBadge>
<RizzMeter value={72} label="Conversation calibration at 72 percent" />
```

New shared patterns belong inside `src/design-system`. Product-specific
composition belongs in feature components.

## Agent build contract

Before changing a user-facing RizzCode surface:

1. Read this document.
2. Inspect `/brand-system` and the nearest existing product flow.
3. Import tokens and components from `@/design-system`.
4. Use Phosphor for standard icons.
5. Reuse an existing recipe before adding a variant.
6. Run `npm run check:brand`.
7. Run the normal type, test, build, and visual checks.

Do not add a raw hex value, new font, new spacing scale, new radius family, or
new logo treatment inside a feature. If a real new need exists, extend the
design system first and document why.

## Definition of on-brand

A surface is on-brand when:

- the canonical identity is used correctly;
- all colors, type, spacing, radius, border, and motion decisions resolve to
  the shared tokens;
- components come from the package or extend an existing recipe;
- copy sounds direct, grounded, playful, and respectful;
- progress feels earned rather than manipulative;
- keyboard, focus, contrast, and reduced-motion behavior still work;
- `npm run check:brand` passes.

The living component inventory is available locally at `/brand-system`.
