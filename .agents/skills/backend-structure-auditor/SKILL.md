---
name: backend-structure-auditor
description: >-
  Architectural consistency audit for backend code: maps structural errors and
  inconsistencies by comparing the code against the project's own dominant
  patterns — layer separation, error handling, API contracts, validation,
  config access, data access, auth coverage, logging, naming, dependency
  boundaries. Diagnostic mapping, not cleanup: dead code and unused imports
  belong to code-audit-cleanup; lint/style, full security audits, and
  performance work are out of scope. Use whenever the user asks to audit
  backend structure or architecture, check consistency, or vet new or
  AI-generated code against existing project patterns — "audita a estrutura
  desse backend", "isso bate com o padrão do resto do projeto?", "tem deriva
  estrutural aqui?", "confere se as rotas seguem o mesmo padrão", "map
  inconsistencies in this codebase", "does this new endpoint follow our
  conventions?", "architecture drift check", pre-merge structure checks.
---

# Backend Structure Auditor

Map where a backend deviates from the patterns it itself established. The reference point is always the project's own dominant conventions — not an external style guide, not abstract best practice. A codebase where every handler returns error objects is structurally healthier than one where half throw and half return, even if throwing is "more correct" in the abstract.

## Scope boundary

This is a mapping skill: it produces a diagnosis with correction directions; it does not implement the fixes. Adjacent work is deliberately left to other passes, so the audit doesn't blur into them:

- Dead code, unused imports, surface tidying → a behavior-preserving cleanup pass (`code-audit-cleanup`) already owns this. An audit that stops to delete imports has lost its thread.
- Style and syntax → linters do this deterministically and cheaper.
- Security audit → dimension 7 below checks whether auth structure is *uniform*, which is a consistency question. "This route lacks the middleware its 23 siblings have" is in scope; reviewing token expiry policy is not.
- Performance → N+1 appears under data access as a *consistency* observation (avoided in some queries, present in equivalent ones), not as a profiling exercise.

## Two detection mechanisms — label every finding with one

**Error (implicit-invariant violation).** The code breaks a rule the rest of the codebase follows without exception. 23 of 24 routes on a resource apply `requireAuth`; one does not. Detected by comparing against the rule. Usually high confidence and higher severity: an exceptionless pattern is as close as unwritten code gets to a stated intention.

**Inconsistency (dominant-pattern drift).** Two or more ways of doing the same thing coexist with no discernible reason. Half the handlers throw domain errors; half return error objects. Detected by comparing code against the rest of the code — there is no explicit rule, only a distribution.

The label changes what the finding claims: an error says "this is almost certainly a mistake"; an inconsistency says "one of these patterns should win". Two edge cases deserve their own labels instead of being forced into these:

- Near 50/50 split: there is no dominant pattern. Report "no established pattern for X" as its own finding — the fix is a decision, not a convergence.
- A deviation with a visible reason (a comment, a requirement that differs for real) is a deliberate exception, not drift. Check for the reason before flagging; a report padded with false positives buries its true findings.

## Workflow

1. **Identify stack and scope.** Detect language and framework from file extensions, imports, lockfiles. Load the matching stack reference (see Stack references). Confirm what counts as "the backend" — skip vendored, generated, and build-artifact code.
2. **Establish dominant patterns before judging anything.** For each applicable dimension, survey the whole relevant population (all route files, all services, all query sites) and count: which approaches exist, how many instances of each. Counts are the evidence; a finding without them is an impression. Use content search for breadth first (grep-style patterns — each stack reference lists useful ones), then read representative files for depth. On large codebases, sampling is acceptable — disclose it in the report so the counts aren't mistaken for a census.
3. **Classify every divergence** as error or inconsistency (or one of the two edge labels), applying the deliberate-exception check.
4. **Write the report** in the format below, then run the stance self-check before delivering.

## Modes

Pick the mode from the shape of the request. When scope is truly ambiguous (whole monorepo vs. one service), ask one short question instead of guessing — auditing the wrong scope wastes the whole pass.

**full-audit** — no specific dimension or new code named. Sweep the indicated scope across all 10 dimensions. Full report with the scoring table.

**targeted-check** — the request names a dimension ("só confere tratamento de erro", "is auth applied consistently?"). Audit only that dimension, with the same rigor: full population, counts, mechanism labels. Score only that dimension and skip the aggregate interpretation — a total computed from one row would fake precision.

**pre-merge-check** — the request provides new code (often AI-generated) and asks whether it fits the existing project. The highest-leverage mode: it catches drift at the moment it enters instead of months later. Establish the dominant pattern from the *existing* code for each dimension the new code touches, then compare. Two rules specific to this mode:

- Judge the new code against the project's patterns, not against best practice. "This project always validates with a schema at the route boundary; this new route checks fields by hand" is the finding — even if the hand-rolled checks are individually fine.
- New code sometimes does something with no precedent in the project (a webhook route needing raw-body parsing when every other route uses JSON; the first background job). No precedent means nothing to violate: report it as a **new-pattern decision** to make explicitly, not as a deviation. Flagging a legitimate first-of-its-kind as drift is the false positive this mode is most prone to.

## Minimum context gate

Consistency is relative; it needs a "rest of the project" to be relative to. Two situations where the honest answer is that the audit can't run yet:

**Pre-merge with only the new code provided.** Don't audit against imagined conventions — stop and ask for the smallest unblock, naming exactly which files would establish the pattern:

> I can check this against the project's established patterns, but I only have the new code — nothing to establish the patterns from.
> Fastest unblock: 2–3 existing files of the same kind (e.g., two current route handlers plus the shared error/middleware setup).

Adapt the ask to the layer the new code belongs to; the shape stays "smallest set of peer files that makes 'dominant' measurable".

**Project too young for dominant patterns.** A handful of files with one instance of each kind has nothing to be consistent *with*. Say so explicitly — "consistency isn't measurable yet; there's no dominant pattern to deviate from" — and offer what is useful at that stage instead: name the convention decision points already visible (error style, validation approach, config access) so patterns get chosen deliberately rather than accreted. Don't force an empty report into the full format.

## Symptom library — the 10 dimensions

Stack-agnostic signals; the stack references restate them with concrete idioms. "Correction direction" defaults to converging on the dominant pattern — but dominant is not automatically right. When the minority pattern is clearly the better engineering choice, say so, recommend converging on the minority, and be explicit that this is the larger migration.

### 1. Layer separation
Signal: business rules living inside route/controller handlers while sibling handlers delegate to services; data access sometimes behind a repository, sometimes inline at the call site.
Check: for each handler, list what it touches directly — DB client? domain rules? — and compare against the shape of its siblings.
Correction direction: move outlier logic into the layer its siblings use; the handler keeps transport concerns (parsing, authz, response shaping).

### 2. Error handling
Signal: throw vs. returned error values vs. err-first callbacks coexisting; error response shape differing between endpoints of the same service.
Check: trace how an error born in the deepest layer reaches the client, per module; count the distinct paths.
Correction direction: one propagation style per service, one wire shape for errors; route the minority style through the dominant path.

### 3. API contract
Signal: response envelope present on some endpoints, absent on others; status codes used differently for the same situation (200-with-error-body vs. 4xx); pagination schemes differing between list endpoints; camelCase and snake_case mixed in one API.
Check: diff the JSON shape and status usage of endpoints that answer the same kind of question.
Correction direction: pick the dominant contract and migrate or version the outliers — external visibility often raises severity here.

### 4. Input validation
Signal: some endpoints validate via schema/middleware, some do ad hoc inline checks, some accept input raw.
Check: for every endpoint accepting a body or rich query params, note the mechanism (schema, manual, none) and where it runs.
Correction direction: validation at the boundary, one mechanism. An unvalidated *mutating* endpoint among validated siblings is usually an error, not an inconsistency — treat it as the priority.

### 5. Configuration and environment
Signal: a centralized config module coexisting with direct env reads scattered through the code; the same variable read with different fallback defaults in different files; a variable referenced but never defined or documented.
Check: search all env access points; group by variable; compare defaults. Cross-check referenced variables against the declared/documented set.
Correction direction: one access path, validated at startup. Divergent defaults for the same variable is an error to resolve immediately — one switch, two behaviors.

### 6. Data access
Signal: ORM and raw SQL mixed without a criterion; N+1 loops at some query sites while equivalent sites batch or join; some multi-write flows in transactions and equivalent flows not; migrations that no longer match the declared model/schema.
Check: inventory query sites by mechanism; compare transaction boundaries of flows with the same write pattern; run the stack's migration-drift check when one exists.
Correction direction: a stated criterion for when raw SQL is allowed; wrap unprotected multi-writes to match their transactional siblings; reconcile migrations before anything builds on the drift.

### 7. Authentication / authorization uniformity
Signal: auth middleware applied per-route on one resource, router-wide on another, missing on isolated routes whose siblings all have it; role checks sometimes in middleware, sometimes inline in handlers.
Check: build the route × middleware table per resource; a gap in an otherwise exceptionless column is an error, and the highest-severity finding this skill produces.
Correction direction: uniform application at the same level per resource. Structural uniformity only — auth *design* review is out of scope here.

### 8. Observability
Signal: structured logger in some modules, bare prints in others; the same class of event logged at different levels; request/correlation IDs present in some paths and absent in others.
Check: inventory logging call sites by mechanism and level; trace whether a request ID survives from entry point to the deepest log line.
Correction direction: one logger, levels used deliberately. The correlation gap matters most on error paths — that's where someone will be grepping at 2 a.m.

### 9. Naming and module organization
Signal: parallel concepts organized differently — `UserService` here, `order_helpers` there, for equivalent roles; one resource's files in a dedicated folder while its sibling's live inline in the entrypoint.
Check: line up modules that play the same role across features; compare file naming, folder placement, internal shape.
Correction direction: mirror the dominant feature's layout. Usually low severity alone, but it compounds every other dimension — drift hides where structure is unpredictable.

### 10. Dependency boundaries
Signal: imports crossing layers in the wrong direction (a service importing from the route layer); circular dependencies; call sites bypassing an abstraction that exists (importing the DB client directly where a repository layer is established).
Check: map imports between layers; anything pointing upward or forming a cycle is a finding. A bypass also counts against the dimension whose abstraction was bypassed.
Correction direction: invert or extract; for bypasses, route through the existing abstraction — it's already paid for.

## Stack references

The dimensions above apply to any backend and carry the audit on their own. Once the stack is identified, load the matching file for concrete idioms and survey patterns *before* auditing — it sharpens what to grep for and what drift looks like in that ecosystem:

- JS/TS server-side (Express, Koa, Fastify, Nest; `package.json` present) → `references/nodejs-express-style.md`
- Python server-side (Django, Flask, FastAPI; `pyproject.toml` / `requirements.txt`) → `references/python-style.md`

No matching file → audit with the core dimensions alone. The references are pattern-proof for their stacks, not exhaustive coverage; new stacks get their own file as the need appears.

## Report format

A report, not a loose list of complaints.

**Summary** — 1–2 sentences of overall structural health, unsoftened, naming the worst problem. "Error handling has no dominant pattern (3 styles across 8 files) and one route is missing the auth middleware all 23 siblings apply" — not "generally well organized with some improvement opportunities".

**Findings, grouped by dimension.** Each finding carries:

- **Mechanism**: error or inconsistency (or "no established pattern" / "new-pattern decision").
- **Where**: concrete files/endpoints with counts — "14 of 16 handlers do X; `a.ts` and `b.ts` do Y".
- **Dominant vs. deviating**: what most of the code does; what the outlier does instead.
- **Severity**: `[High]` — likely to produce wrong behavior or an externally visible contract break (missing auth, unvalidated mutation, divergent defaults for one env var). `[Medium]` — drift that will mislead maintenance or force rework (competing error styles, mixed data-access patterns). `[Low]` — internal convention noise (file naming, folder layout). Judge by blast radius, not by how easy the fix is.
- **Correction direction**: one or two sentences pointing at the fix. Mapping, not implementation — no full diffs unless asked.

**Quick scoring** — one row per dimension: 0 = uniform, 1 = minor drift (isolated deviations; the pattern still clearly dominates), 2 = clear split or invariant violation. Dimensions with no surface in this codebase (no DB → no data access) are N/A, not 0 — an unearned zero inflates the health score.

Interpretation over the applicable dimensions (bands assume all 10 apply; scale judgment proportionally when fewer do):

- 0–3 · consistent — deviations are exceptions; converging them is cheap now.
- 4–8 · drift accumulating — dominant patterns still dominate, but each new feature is a coin flip on which convention it copies. Converge before adding features that multiply the split.
- 9+ · several areas have no dominant pattern left — codifying conventions is now a prerequisite, not a nicety; consistency work without a decision on the target pattern will thrash.

## Stance: name the drift, don't soften it

This skill exists to map structural reality, not to reassure the code's owner. The default failure mode of a capable assistant is diplomatic vagueness — melting "three error-handling styles coexist across these 8 files" into "the code is reasonably organized, a few things could be tightened". That melt destroys the audit's entire value: a finding that doesn't name the split can't be acted on.

- **Lead with the diagnosis, even when unflattering.** The summary states the worst problem by name and count. Positive claims are earned the same way — "error handling is uniform: all 19 handlers throw domain errors caught by one middleware" is a real finding; "error handling looks fine" is not.
- **Counts and file names, not impressions.** Every finding cites its population ("N of M"). If the population wasn't surveyed, the finding isn't ready to report.
- **Critical is not alarmist.** A deliberate, reasoned exception is not drift; a near-50/50 split is not "an error"; a first-of-its-kind pattern is not a violation. Findings inflated for effect are as useless as findings softened for comfort — both misreport the structure.
- **Self-check before delivering.** Re-scan the summary and each finding for a hedge sitting in front of a structural claim — "mostly consistent", "razoavelmente organizado", "just needs a few tweaks", an opening compliment — and delete it unless a concrete count backs it. Run this check especially when it feels unnecessary: default politeness is invisible from the inside.
