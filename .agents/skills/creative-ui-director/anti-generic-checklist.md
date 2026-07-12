# Anti-Generic Checklist

Use this checklist before implementation and after implementation. Referenced from the Anti-generic pass step in `SKILL.md`.

## Quick Scoring

Score each item:
- `0` = no issue
- `1` = mild issue
- `2` = clear issue

Items:
1. generic intro or hero
2. card farm or repeated panels
3. equal-weight hierarchy
4. default-looking CTA treatment
5. decorative styling doing the work of structure
6. weak product specificity

Interpretation (max 12):
- `0–3`: acceptable, keep going
- `4–6`: revise at least 2 layout or hierarchy decisions and name them
- `7+`: return to concept selection — polishing will not save the concept

### Micro-example of a corrective action
Score `5` — flagged on items 2 (card farm) and 4 (default CTA).
- Item 2 corrective: merge the three "feature" cards into a single band with inline typographic hierarchy.
- Item 4 corrective: move the primary CTA next to the product crop instead of floating below the hero, and demote the secondary CTA to a text link.

Name the corrective actions taken, not just the score.

## Symptom Library

### 1. Everything is in cards
Signal:
- the page is mostly repeated rectangles with similar weight
- containers are doing grouping by habit, not because they encode different ownership or actions

Fix:
- remove low-value containers
- turn some groups into lists, bands, split layouts, rails, or typographic sections
- create one dominant region and quieter supporting regions

### 2. The hero could belong to any company
Signal:
- centered headline, subheadline, CTA, and abstract visual treatment with no product-specific proof

Fix:
- shorten the intro
- show the product, proof, workflow, or artifact earlier
- anchor the fold with a bold compositional move, not just decoration

### 3. Color is doing fake work
Signal:
- gradient or accent exists mainly to make the UI feel modern
- hierarchy collapses when color is removed

Fix:
- re-establish emphasis with scale, contrast, spacing, and order
- use color for hierarchy, state, brand, or semantic meaning only

### 4. Every section has the same rhythm
Signal:
- identical vertical spacing, section framing, and density across the page

Fix:
- vary density by purpose
- let one region breathe and another compress
- use asymmetry or contrast only where it improves scan order

### 5. Dashboard panels all shout at once
Signal:
- metrics, charts, filters, tables, and alerts all carry similar weight

Fix:
- choose one primary workspace or decision panel
- demote low-priority content into a rail, tab, drawer, or collapsed region
- sequence overview, action, and detail deliberately

### 6. Buttons feel dropped in
Signal:
- primary, secondary, and tertiary actions look too similar or appear everywhere

Fix:
- assign a clear action hierarchy
- vary prominence through placement, size, weight, spacing, and optional iconography
- remove redundant actions instead of styling around them

### 7. Premium styling is hiding weak layout
Signal:
- blur, glow, glass, noise, or shadow carry more emphasis than composition

Fix:
- strip effects first
- solve hierarchy with layout and typography
- re-add only the effects that support the chosen direction

### 8. Icons standing in for labels
Signal:
- rows of icon-only buttons with no text, forcing users to hover or guess
- navigation that relies on iconography that is not part of a well-known convention (hamburger, search, close)
- decorative icons next to every label, adding visual noise without meaning

Fix:
- label every action unless the icon is truly universal
- treat icons as reinforcement, not replacement
- remove decorative icons that duplicate an adjacent label

### 9. Accent colors competing
Signal:
- three or more saturated accents fighting for attention in the same viewport
- "modern gradient" stacked on top of a separate brand accent
- semantic colors (error, warning, success) used at full saturation alongside the brand accent

Fix:
- one accent family does the work of emphasis; semantic colors are exceptions, not peers
- desaturate or confine secondary accents to state pills, badges, and inline indicators
- remove any accent that is not carrying information

### 10. Gray blur
Signal:
- body, labels, captions, metadata all rendered at similar size, similar weight, similar color
- nothing pulls the eye forward; the screen reads as a uniform wash

Fix:
- widen the typographic scale (at least two clear sizes between body and display)
- vary weight deliberately (400 vs. 600 is more legible than 400 vs. 500)
- reserve the darkest neutral for primary content; demote metadata by lightness, not by size alone

## Screen-Type Heuristics

### Landing pages
- is the product visible before the user scrolls too far?
- is there one conversion path above the fold?
- are proof and product substance visible before feature wallpaper?

### Dashboards and tools
- is there a dominant workspace?
- can the user tell what to look at first in under 3 seconds?
- have low-priority widgets been demoted instead of left at equal weight?

### Settings, forms, and operational flows
- is calm clarity winning over decoration?
- are sections grouped by decision, not by arbitrary boxes?
- is the next action obvious at every step?

### Empty states and onboarding
- does the empty state teach, not apologize?
- is the first action the user should take more prominent than the illustration?
- does onboarding get out of the way once a user has content?

## When to break these rules
Not every screen should optimize for restraint. Intentionally break the anti-generic rules when:

- **Expressive consumer products** (social, creative tools, games, entertainment) — exuberant color, decorative motion, and dense cards can be the point.
- **Brand-led editorial moments** — a launch page or manifesto page can earn oversized hero typography and decorative space precisely because it is a moment, not a tool.
- **Playful onboarding or celebration screens** — gradients, confetti, mascots are appropriate in small, bounded contexts.
- **Data-dense operational tools** — density is a feature; rules about "breathing room" can mislead if applied literally.

The test is always the same: is the rule being broken because the product benefits, or because the designer wanted to? If benefit cannot be named in one sentence, the restraint rule wins.

## Fast Rescue Moves
Use when the screen still feels generic after scoring:

- remove one container layer
- promote one region to clear dominance
- compress or merge one repetitive section
- move product proof earlier
- replace one decorative effect with typographic or compositional contrast
- reduce CTA count above the fold
- replace one icon-only control with a labeled one
- cut one accent color
