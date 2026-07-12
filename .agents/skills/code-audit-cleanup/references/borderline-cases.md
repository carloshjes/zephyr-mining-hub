# Borderline cases

Use this reference when the request sounds like cleanup but may actually authorize a rewrite, risky deletion, or vague aesthetics-only churn. Each pattern has a treat-as-cleanup rule, a treat-as-out-of-scope rule, and a default behavior. When the user prompt clearly matches one of these patterns, read this file before deciding the diff boundary.

## 1) "refatora isso pra clean architecture"

**Treat as cleanup only when:** the user really means a conservative readability pass inside the current module boundaries: private helper extraction, reduced nesting, clearer local naming, or moving logic inside the same file without changing public contracts.

**Treat as rewrite when:** it implies new layers, moving responsibilities between modules, introducing repositories or use-cases, changing dependency direction, changing constructors or dependency-injection seams, or reorganizing the project around a new architecture pattern.

**Default behavior:** do the conservative cleanup now. If the architecture migration is still desirable, list it as a deferred suggestion rather than sneaking it into the cleanup diff.

**Stop trigger:** if "clean architecture" is the only real goal and you cannot satisfy the request without moving modules or changing public seams, stop and ask the smallest question needed to choose between cleanup and redesign.

## 2) "remove tudo que não está sendo usado"

**Treat as safe cleanup only when:** the target is private or local and the evidence is strong: compiler or linter unused warnings, repo-wide search, nearby tests, and no sign of reflection or config-driven loading.

**Treat as risky when:** the code might be discovered dynamically through framework registration, dependency injection, plugin loaders, string lookups, templates, config files, test fixtures, or feature flags. Static "unused" is not enough in those cases.

**Default behavior:** remove only what is both private and strongly evidenced as unreferenced. Everything else becomes a candidate list with the evidence gap stated explicitly.

**Stop trigger:** if dynamic loading is plausible and you cannot prove safety, do not delete. Use the stop template or leave suggestions only.

## 3) "deixa esse arquivo mais limpo"

**Default boundary:** one file plus directly adjacent tests. No public-signature changes. No moving code across modules. No repo-wide formatting.

**Treat as safe cleanup when:** the file can be improved through local naming, comment cleanup, dead private code removal, small private extractions, and mechanical readability edits.

**Treat as ambiguous when:** the file is itself a protected surface (`index.*`, route, controller, schema, config, serializer, public type barrel, migration) or when "more clean" would require splitting modules or changing interfaces.

**Default behavior:** interpret "mais limpo" as a conservative single-file cleanup unless evidence forces a stop.

**Smallest boundary question if needed:** "Posso limitar a limpeza a este arquivo, sem mudar assinaturas nem mover código entre módulos?"

## 4) "o código tá feio, arruma"

**Style issues that are in scope:** local naming, comment clutter, duplicated local logic, unnecessary nesting, inconsistent spacing within the touched scope, and small readability refactors.

**Substance that is out of scope unless explicitly approved:** bug fixes, contract changes, architecture changes, new abstractions across modules, retry or caching policy changes, validation changes, or performance tuning.

**Default behavior:** assume the user is complaining about readability, not authorizing behavior changes. Fix style and readability only after the Behavior preservation pass says it is safe.

**Rule of thumb:** "feio" does not authorize "clever." Prefer obvious local cleanup over fashionable rewrites.

## 5) "simplifica isso"

**Treat as cleanup only when:** the simplification is mechanical and preserves behavior: clearer guards, fewer temporary variables, extracted private helper, or removal of provably redundant checks.

**Do not treat as cleanup when:** "simplify" would remove fallback behavior, validation, telemetry, retries, feature flags, or defensive branches that may exist for a reason.

**Default behavior:** simplify syntax and control flow, not guarantees or safeguards.

## 6) "tira o lixo" / "organiza esse arquivo"

**Treat as cleanup only when:** "lixo" means unused imports, obvious dead private code, commented-out code, stale banners, or noisy comments that restate the code.

**Do not treat as cleanup when:** the request would erase `todo` / `fixme` / `hack` / `xxx` / `note` markers, compatibility shims, operational warnings, or code that only appears unused because the framework loads it indirectly.

**Default behavior:** organize for readability first; delete only with evidence.
