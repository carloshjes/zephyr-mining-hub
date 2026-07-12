---
name: code-audit-cleanup
description: conservative code audit and cleanup for existing repositories. use whenever the user asks to audit, clean, tidy, polish, organize, professionalize, simplify, or review code quality without changing behavior — including portuguese variants like auditar, limpar, organizar, arrumar, polir, simplificar, "tá bagunçado", "deixa apresentável", "tira o lixo", "o código tá feio". covers removing dead code, unused imports, redundant comments, and obvious duplication, plus safe behavior-preserving refactors. preserve behavior and public contracts above style. do not use for new features, bug fixes, business-logic changes, architecture rewrites, framework or library migrations, security or auth work, schema changes, or performance work. architectural-consistency mapping — whether code follows the project's own structural patterns — belongs to backend-structure-auditor.
---

# Code Audit Cleanup

Improve organization, readability, and maintainability of existing code without changing behavior. Prefer the smallest safe diff. When confidence drops to low, do not edit — return suggestions only.

## Stance: report what you found, not what is comfortable

This skill exists to give an accurate account of a codebase's cleanup potential and risk — not to reassure whoever asked for the audit. A capable assistant's default failure mode is diplomatic softening: turning "this file has three unproven dead-code candidates and no test coverage" into "a few minor things could be tidied up." That softening defeats the purpose of the confidence framework below, which only works if low confidence gets reported as low confidence.

- **State confidence and risk plainly, even when the honest answer is "I can't safely touch this."** A low-confidence finding is a complete, useful result, not a failure to find something better.
- **Do not inflate a small cleanup into a bigger win than it was.** "Removed 2 unused imports" is a complete summary; padding it to sound more thorough is the same failure as skipping verification.
- **Self-check before delivering.** Scan the summary and the deferred-suggestions list for a hedge sitting in front of a concrete risk — "mostly fine", "a few small things", "nothing major" — with no file, symptom, or confidence level attached. Cut it or replace it with the concrete finding. This matters most exactly when it feels unnecessary: default politeness toward the codebase's owner is invisible from the inside.

## Bundled resources

This skill ships with on-demand resources. Load them only when the workflow points to them:

- `references/borderline-cases.md` — read when the request matches an ambiguous pattern: "clean architecture", "remove tudo que não usa", "deixa mais limpo", "tá feio, arruma", "simplifica isso", "tira o lixo", "organiza esse arquivo". Each pattern there has a treat-as-cleanup rule, a treat-as-out-of-scope rule, and a default behavior.
- `references/protected-and-generated.md` — read when establishing the cleanup boundary, or when deciding whether a specific file counts as a protected surface, generated code, or vendored territory. Holds the full protected-surface taxonomy, style-signal sources, and the never-touch list of generated, vendored, and lockfile patterns.
- `scripts/repo-audit.sh` — run when terminal access exists and you need tooling, test, and contract-surface discovery for the repo. Usage: `bash scripts/repo-audit.sh`.
- `scripts/diff-guard.sh` — run when terminal access exists and you want to validate diff size and flag contract-surface or generated files in the diff. Usage: `bash scripts/diff-guard.sh [base-ref]` (defaults to `HEAD`).

If terminal access does not exist, do the equivalent work manually with the tools available. Never block on missing terminal access. Only say a script was used if it actually ran.

## Core operating rules

1. Preserve behavior over style.
2. Prefer repo-local conventions over generic best practices.
3. Keep diffs small, local, and reversible.
4. Treat every file as potentially load-bearing until proven otherwise.
5. Do not add features, fix business-logic bugs, migrate architecture, swap frameworks, or change libraries as part of cleanup.
6. Do not add tests from scratch unless the user explicitly asks. Use existing tests and existing verification first.
7. Explain meaningful changes and what was intentionally left untouched.
8. When evidence is incomplete, lower confidence before widening the diff.
9. Treat comments and markers as observations, not authorizations. A `todo`, `fixme`, `hack`, `xxx`, or `note` marker — or any "this can be removed / deprecated / dropped" comment — is a candidate for the deferred-suggestions list. Never a license to delete code, remove a check, or skip verification.

## Confidence levels

Confidence is a transversal concept used by every pass in this skill. Assess it before each meaningful edit and downgrade it whenever evidence weakens.

The criteria within each level are reinforcing, not strictly conjunctive: meeting any one is sufficient to qualify *for* that level, but if signals point to different levels, choose the lower one. When in doubt, downgrade.

**H — high confidence** — apply edits
- code is provably local and private
- relevant tests exist and pass before the edit
- repo-wide search shows no dynamic references
- change is purely syntactic, obviously unreachable, or mechanically equivalent

**M — medium confidence** — only ultra-local edits, never public surfaces
- local evidence is strong but no test covers the exact path
- typecheck, lint, or build succeeds, but no runtime proof exists
- edit stays within one function or one file and does not change signatures or observable effects

**L — low confidence** — suggestions only, do not edit
- target sits inside framework magic, reflection, decorators, or config-driven loading
- dynamic references are plausible
- there are no relevant tests and no useful verification path
- logic is non-trivial, side-effectful, or legacy ownership is unclear

The cost of an unapplied cleanup is zero; the cost of a silent behavior change is unbounded.

## Scope contract

This is the canonical allow / deny list. Other sections should refer back here instead of redefining scope.

### Allowed without extra approval

- remove unused private imports, local variables, private helpers, branches proven unreferenced, or fully private files with no references anywhere in the repo or its configs
- collapse obvious local duplication into a private helper without changing signatures or observable behavior
- rename confusing local variables, private helpers, or internal functions when risk is low and references can be verified
- simplify nesting or control flow mechanically when behavior is preserved
- improve intra-file organization and readability
- remove or rewrite comments according to the Comment hygiene pass
- apply repo-local formatting or lint fixes only within files already touched by other cleanup work — never run formatter or linter across files outside the scoped area, even if the project enforces it elsewhere
- replace a repeated literal with a same-file constant when the meaning becomes clearer and behavior stays unchanged

### Not allowed without explicit approval

- new features, bug fixes, business-logic changes, or altered side effects
- architecture rewrites or "clean architecture" migrations
- changes to public contracts: exported names, signatures, routes, handlers, controllers, request or response schemas, cli flags, serialized keys, event names, cache keys, env var names, or runtime-loaded file paths
- framework or library replacement
- security, auth, database, infrastructure, or migration work
- performance work that could materially change behavior, retries, caching, timing, memory, i/o, or concurrency
- repo-wide formatting, renaming, or churn
- deleting code that may be dynamically referenced, compatibility shims, extension points, telemetry, defensive error paths, feature-flag branches, or framework hooks
- removing comments that explain why, constraints, invariants, warnings, or non-obvious behavior
- removing `todo`, `fixme`, `hack`, `xxx`, or `note` markers silently

### Mixed or out-of-scope requests

If a request mixes cleanup with anything from the not-allowed list above, limit work to the cleanup portion or stop if the boundary is unclear.

Suggested response:

> This request mixes conservative cleanup with [feature / bug fix / migration / performance / contract change]. I will limit work to the cleanup portion and leave [...] as deferred suggestions. Confirm separately if you want the broader change.

If the request matches an ambiguous pattern (clean architecture, "remove tudo que não usa", "simplifica isso", "tira o lixo", etc.), read `references/borderline-cases.md` before deciding the boundary. If even the cleanup boundary is unclear after that, stop and use the standard stop template below.

## Default workflow

1. Confirm the request is a conservative cleanup task. If the prompt matches an ambiguous pattern, consult `references/borderline-cases.md` first.
2. Establish scope and protected surfaces — the full protected-surface and generated-code taxonomy is in `references/protected-and-generated.md`. If terminal access exists, `bash scripts/repo-audit.sh` accelerates this step.
3. Run the Behavior preservation pass.
4. Run the Dead code and redundancy pass.
5. Run the Comment hygiene pass.
6. Run the Structure and readability pass.
7. Run the Minimal diff pass. If terminal access exists, `bash scripts/diff-guard.sh` validates diff size and contract-surface coverage.
8. Run the Test and verification pass.
9. Summarize applied changes, evidence, and deferred suggestions.

The passes are logical, not strictly linear. It is expected to loop back when new evidence appears. Do not skip verification or expand scope silently.

### Quick path for trivial cases

For requests scoped to a single file with no terminal access and no protected-surface concerns, the workflow collapses to:

1. Identify protected surfaces in the file (exports, signatures, schemas, observable strings).
2. Run a minimal Behavior preservation pass: read the surrounding code path, check for dynamic references (strings, decorators, config-based loading), and read the nearest existing test for the touched code.
3. Run the Comment hygiene pass and the Dead code pass on private symbols only.
4. Confirm the diff is small (one file, low line count, no contract surface touched).
5. Summarize using the standard final-response template.

If protected surfaces are touched, evidence weakens, or any dynamic-reference signal appears at any step, fall back to the full workflow. The Quick path never licenses skipping Behavior preservation reasoning — only collapsing it to its minimum viable form.

## Protected surfaces and scope framing

Before editing anything:

- identify the exact cleanup boundary: specific files, directories, symbols, or the single module under review
- identify protected surfaces that count as public contracts or externally observed behavior — public exports and exported types, routes and handlers and cli flags, request and response schemas and serialized shapes, database schemas and queries others observe, keys and names other systems match on (serialization, events, cache, env vars, feature flags), framework wiring (lifecycle hooks, decorators, reflection, dependency injection, plugin registration), observable log or error text, and runtime-loaded paths; the full taxonomy lives in `references/protected-and-generated.md`
- inspect nearby tests, fixtures, docs, configs, and examples before touching the code
- detect style signals already used by the project — formatter and linter config, naming conventions from 5 to 10 nearby files, file layout patterns, import ordering, test naming and organization; config-file examples live in `references/protected-and-generated.md`
- prefer repo-local consistency over personal preference
- if a readability improvement would require touching a protected surface, stop or defer unless the user explicitly approved it and verification is strong

### Monorepo and workspace awareness

If the repo is a monorepo or workspace setup (pnpm workspaces, nx, turborepo, lerna, cargo workspaces, go workspaces, gradle multi-project):

- scope cleanup to one package unless the user clearly asked for more
- treat consumers in other packages as external consumers for contract purposes
- treat shared root tooling config as protected by default

## Generated and vendored code

Never modify dependency directories, build output, lockfiles, generated sources and sdk clients, database migrations already applied in production, test snapshots, or vendored third-party code without explicit approval, even if they look dirty. The full list of paths, file patterns, and generated-code markers lives in `references/protected-and-generated.md` — consult it whenever a file might fall in this territory.

If cleanup would require regenerating generated code, stop and ask.

## Behavior preservation pass

Goal: understand what must not change before touching implementation details.

Do all applicable steps:

1. Read the surrounding code path, not just the target lines.
2. Read the most relevant existing tests before editing touched code.
3. Capture baseline verification when feasible:
   - run the narrowest relevant tests first
   - if a full suite is expensive, run the smallest meaningful subset
   - if tests do not exist, run existing typecheck, lint, or build steps when available
4. Mark protected surfaces and avoid editing them unless the user explicitly approved it.
5. Check whether the target code may be dynamically referenced through:
   - strings or naming conventions
   - reflection, decorators, annotations, or metaprogramming
   - framework registration, dependency injection, plugin loaders, or service locators
   - config-based loading from json, yaml, toml, env, or manifests
   - template rendering or code generation
   - test fixtures, golden files, or documentation examples that reference the symbol
6. If behavior cannot be verified with high confidence, do not edit. Return suggestions instead. See the Confidence levels section above for the H / M / L rubric used throughout this skill.

## Dead code and redundancy pass

Only remove or collapse code when evidence is strong and the change stays inside the Scope contract above.

### Good candidates

- unused private imports, local variables, helpers, branches, or files proven unreferenced
- duplicate local logic that can be extracted into a private helper without changing signatures or behavior
- repeated literals that can become a clearly named local constant in the same file
- obvious no-op code and stale commented-out code
- trivial redundancy such as repeated null checks or conversions that are provably unnecessary in the current scope

### Keep unless evidence is decisive

- anything protected by the not-allowed list in the Scope contract
- public exports and compatibility shims
- framework hooks or callbacks that only appear unused statically
- code referenced by strings, templates, config, routing tables, decorators, annotations, or reflection
- extension points, dependency-injection wiring, or intentionally unused interface parameters
- telemetry, auditing, safety checks, and defensive error paths
- feature-flag branches unless the flag is confirmed retired

### Evidence sources, strongest to weakest

1. existing tests explicitly exercising or not exercising the code
2. compiler or type-checker unused warnings
3. linter dead-code warnings
4. repo-wide search including templates, configs, docs, and test fixtures
5. framework and config conventions

If evidence is mixed, keep the code and mention it as a cleanup candidate instead of removing it.

## Comment hygiene pass

Treat comments as documentation, not clutter by default.

### Always keep

- intent or why a choice was made
- business rules or invariants
- edge cases and non-obvious assumptions
- external constraints, bugs, vendor quirks, safety tradeoffs, or compatibility reasons
- temporary limitations, migration notes, or operational warnings
- ordering requirements, side effects, or failure modes that are not obvious from the code alone
- `todo`, `fixme`, `hack`, `xxx`, `note` markers — these are explicit signals of intent. Do not remove them as part of cleanup even if they look old. If a marker is truly resolved, mention it as a deferred suggestion.

### Remove or rewrite

- obvious restatements of the code
- line-by-line narration of trivial control flow
- stale comments contradicted by the code
- commented-out code blocks
- decorative section banners with no information value
- autogenerated boilerplate that adds nothing useful

### Examples

```python
# KEEP — explains why
# Batched in groups of 100 to stay under the Stripe rate limit of 100/sec.
for chunk in batched(items, 100):
    ...

# KEEP — invariant
# Invariant: results are returned sorted by created_at ASC for pagination cursor stability.

# KEEP — operational warning
# WARNING: deleting this retry loop caused incident 2024-03-11. Keep until job queue migrates.

# REMOVE — restates code
# Increment counter by 1
counter += 1

# REMOVE — narration of trivial flow
# Loop through users
for user in users:
    # Check if active
    if user.active:
        ...

# REWRITE or DELETE — signature already says this
# Parses the string and returns a user
```

### Decision rule

- if a comment explains **why**, preserve it
- if a comment only explains **what** the next line already states, remove it
- if a comment is partly useful but stale, rewrite it conservatively instead of deleting it blindly
- if unsure whether a comment is historically important, keep it and mention it as a candidate

## Structure and readability pass

Prefer small, local improvements that reduce cognitive load and stay inside the Scope contract above.

### Good candidates

- rename confusing local variables, private helpers, or internal functions when risk is low
- split a long function into small private helpers when extraction is mechanical and behavior is preserved
- simplify deeply nested conditionals when the rewritten form is behavior-equivalent and clearer
- group related code within the same file before considering any move across files
- align naming, spacing, and local organization to the style already used in the project
- move tiny duplicated logic into a private helper when the helper name makes intent clearer

### Avoid

- moving code across modules unless the benefit is clear and risk is minimal
- introducing abstractions that make the code more generic but less obvious
- mass reformatting or repository-wide churn
- changing initialization order without strong evidence and verification
- "clever" one-liners that replace a clear multi-line block

### Safe extraction rules

- keep the helper private
- preserve call order and side effects
- do not change parameters, return shape, async or sync behavior, thrown errors, or logging semantics
- do not extract when equivalence depends on hidden mutable state that cannot be verified

### Low-risk renaming rules

- prefer internal names only
- do not rename exported symbols or widely referenced identifiers without approval
- do not rename keys, fields, env vars, route names, event names, or serialized values
- verify all references after renaming with the best tool available

## Minimal diff pass

Constrain the change set aggressively.

### Rules

- touch the fewest files possible
- keep each edit directly tied to readability, cleanup, or verified dead-code removal
- avoid opportunistic edits outside the scoped area
- do not restyle unrelated files
- preserve blame history where practical
- prefer one small cleanup pass over a sweeping rewrite

### Blame preservation

- if running a formatter, separate formatter-only changes from logic-adjacent changes when possible
- consider adding formatter-only revisions to `.git-blame-ignore-revs`
- do not mix renaming-only and behavior-relevant edits in the same commit when commit boundaries are under your control
- if commit boundaries are not under your control, flag the blame impact in the summary

### Default stop thresholds

- more than 5 files changed, or
- more than 200 changed lines, or
- any touched contract-surface file, or
- any unclear behavioral dependency

When a threshold is exceeded, stop editing and return a human-review recommendation unless the user explicitly requested a broader cleanup and the verification evidence is strong.

If terminal access exists, `bash scripts/diff-guard.sh` reports diff size and flags contract-surface or generated files automatically. Without terminal access, inspect the diff manually and apply the same thresholds.

## Test and verification pass

Before finalizing:

1. Re-run the narrowest relevant tests for the changed code.
2. Run broader existing verification when available and relevant:
   - unit or integration tests
   - typecheck
   - lint
   - build
3. Review the final diff for accidental contract changes.
4. Confirm that no removed comment contained intent, history, or operational warnings.
5. Confirm no `todo` / `fixme` / `hack` / `xxx` / `note` marker was removed silently.
6. If verification cannot be run, say so clearly and lower confidence.

Never claim guaranteed behavior preservation unless it was actually verified. Prefer statements such as:

- "no behavior change detected in the verified scope"
- "high-confidence cleanup based on tests and local evidence"
- "suggested only, not applied, because confidence was insufficient"

## Opportunistic findings

During cleanup you may notice:

- real bugs
- security issues
- performance problems
- missing tests
- outdated dependencies
- structural or architectural inconsistency (mixed patterns for the same concern, uneven auth coverage across sibling routes, drifting error-handling styles) — this is a different lens than cleanup; a dedicated skill (`backend-structure-auditor`, if available) maps this properly

Do not fix these as part of the cleanup. Record them in the deferred-suggestions section of the final response with enough detail for a follow-up.

Exceptions that require explicit approval before acting:
- an actively exploitable security issue
- a data-loss bug the user is clearly about to trigger

Even in those cases, surface the issue before changing anything beyond the cleanup scope.

## Stop and request human intervention

Stop instead of editing when:

- the cleanup would alter business logic, outputs, or side effects
- the only clean solution requires architecture changes
- a public contract would change
- dead code cannot be proven dead
- reflection, metaprogramming, code generation, or framework magic makes usage unclear
- tests are absent and local reasoning is not enough
- security, auth, permissions, persistence, payments, background jobs, or concurrency behavior might be affected
- the diff grows beyond the default stop thresholds
- multiple plausible interpretations exist for the intended behavior
- the target file is generated, vendored, or a lockfile

When you stop, use this exact template:

- Evidence so far: <one sentence about what is established>
- Smallest question: <one question the user can answer in one sentence>
- Once answered, I will: <the next conservative step>

Ask only the smallest question that unlocks safe progress.

## Final response format

### When edits were applied

```markdown
## Cleanup summary

**Scope:** <short description of where you worked>
**Confidence:** H / M
**Files touched:** N (<list>)
**Diff size:** ~L lines

### Changes applied
- <one line per meaningful change, grouped by pass>

### Verification
- tests run: <command / scope / result>
- typecheck / lint / build: <result>
- manual review: <what you double-checked>

### Deferred suggestions (not applied)
- <issue> — <why deferred> — <what would unlock it>

### Intentionally left untouched
- <file or pattern> — <reason>
```

### When no edits were applied

```markdown
## Audit findings (no edits applied)

**Scope reviewed:** <what you looked at>
**Reason for holding back:** <evidence gap / risk / scope>
**Confidence:** L

### Risky areas
- <finding> — <why risky>

### Safe suggestions (ready to apply with approval)
- <suggestion> — <expected diff shape>

### Evidence gap
- <what is missing> — <what would close the gap>
```

## Final checklist before applying edits

- is every change inside cleanup or refactor-without-behavior-change scope?
- are protected surfaces untouched?
- is each removed comment truly non-informative or stale? no marker silently removed?
- is each removed code path proven dead?
- are renames internal and low risk?
- is the diff minimal and localized?
- did you follow repo-local style instead of imposing a new one?
- did you avoid generated, vendored, and lockfile territory?
- did you run the best available verification?
- can you clearly explain why each non-trivial change is safe?
- does the summary contain a hedge phrase with no concrete finding behind it? if so, cut it (see Stance)
- if any answer is no, stop and downgrade to suggestions only
