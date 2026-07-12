# Borderline and Ambiguous Requests

Use this reference when the prompt is emotionally clear but diagnostically vague, or when the requested move might belong to a different skill unless it is reframed as a visual-direction problem. Referenced from `SKILL.md` (Purpose section and the Reference files list).

## 1. "deixa mais bonito" with no criteria
Interpretation:
- treat this as unstructured dissatisfaction, not as a styling request
- assume the real complaint is usually hierarchy, density, specificity, CTA prominence, or layout rhythm

How to proceed:
- if screenshot, code, or URL exists, convert "bonito" into 3 concrete symptoms from the actual screen
- rephrase the ask into operational terms such as: stronger focal area, fewer containers, clearer primary action, earlier proof, calmer density, or more product-specific composition
- propose 2 or 3 directions only after that diagnosis

Do not:
- answer with color swaps, trendy effects, or generic "premium" styling language
- pretend the goal is obvious if there is no screen-level evidence

Use the stop template when:
- there is no actual screen, route, screenshot, code, or product context to inspect

## 2. "adiciona uma animação"
Interpretation:
- first decide whether the user is asking for better feedback and orientation, or just asking motion to compensate for a weak screen

Treat it as valid within this skill when animation improves:
- state change clarity
- spatial continuity between views or panels
- progressive disclosure
- perceived responsiveness and user confidence

Treat it as compensatory decoration when:
- motion is being used to make a generic layout feel expensive
- the screen still has weak hierarchy, no focal area, or obvious card-farm issues

How to proceed:
- identify the exact interaction or transition that needs help
- fix hierarchy first if the structure is weak
- keep motion subordinate to the chosen direction: one motion style, purposeful durations, clear cause and effect
- always respect `prefers-reduced-motion`

Boundary:
- if the task is purely motion-language design with no broader screen-direction problem, this skill is probably not the right tool — exit via the early-exit clause in `SKILL.md`'s Purpose section and handle it as a plain implementation task

## 3. "o site tá genérico, muda" with no code or screenshot
Interpretation:
- this is a composition and specificity complaint, but evidence is thin

How to proceed:
- infer product category, audience, and primary task as explicit assumptions
- if the screen type is obvious enough (for example, SaaS landing page, dashboard, settings page), give conditional directions tied to those assumptions
- if the screen type is not obvious, use the stop template instead of inventing a full redesign

Best smallest evidence to request:
- one screenshot, one URL, or the exact route being discussed

Do not:
- redesign an imaginary home page when the real problem might be a dashboard, settings area, or onboarding step
- give fake variety by proposing three generic landing-page treatments without evidence

## 4. "faz igual ao [produto famoso]"
Interpretation:
- treat the named product as a reference for principles, not as a blueprint to copy

How to proceed:
- extract the specific property the user is really pointing at: editorial pacing, product-first fold, dense workspace, calm trust, expressive warmth, etc.
- translate that property into the user's product, content, and constraints
- say explicitly which compositional qualities are being borrowed

Do not:
- copy brand assets, proprietary illustration styles, trade dress, headlines, or near-identical layouts
- assume the user means the whole brand language when they may only mean one quality, such as density or restraint

Useful reframing:
- "take the workspace-dominant clarity of Linear, but apply it to this analytics product using its own content and design system"

## 5. "tira a cara de ia"
Interpretation:
- diagnose the symptoms; do not argue with the wording
- "AI look" usually means sameness, fake premium effects, generic hero patterns, card farms, and missing product-specific proof

Common symptoms to inspect:
- centered SaaS hero with abstract gradient
- repeated cards with equal weight
- dashboard tiles with no dominant workspace
- decorative glow, blur, glass, or mesh doing the work of hierarchy
- interchangeable copy blocks and icon rows
- weak CTA placement relative to proof or task flow

How to proceed:
- if there is no screenshot, code, or URL at all, follow entry 3: state assumptions when the screen type is obvious, otherwise use the stop template — the symptom list above needs a real screen to inspect
- map each symptom to a structural correction from `anti-generic-checklist.md`
- choose one signature move that makes the product feel specific
- remove one decorative idea before adding any new styling
- explain the change in concrete terms: hierarchy, proof placement, density, rhythm, or task focus

Do not:
- answer with "make it darker," "use serif fonts," or "add grain" as if the problem were only aesthetic taste
- treat "AI look" as a moral category; treat it as a diagnosis of generic composition

## 6. When the user wants "just a vibe refresh"
Interpretation:
- sometimes the request sounds structural but the actual tolerance for change is small

How to proceed:
- stay in `design-system-constrained-upgrade` unless the user clearly invites larger recomposition
- keep the signature move modest: re-anchor the fold, simplify the scan path, or consolidate repetitive panels
- say what stays stable so the scope remains trustworthy
- this is usually a lean-output situation, not full output

Do not:
- silently turn a light refresh into a total redesign
- spend the entire budget on surface treatments when the hierarchy still needs one clear correction
