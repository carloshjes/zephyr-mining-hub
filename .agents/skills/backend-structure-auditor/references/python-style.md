# Python server-side backends — stack-specific symptoms

Load this when the audited code is Python server-side: Django/DRF, Flask, or FastAPI (`pyproject.toml` / `requirements.txt`; app/view/router idioms). Same 10 dimensions as the core skill, sharpened with the idioms this ecosystem actually drifts on. Mechanisms, modes, and report format come from the core skill — this file only tells you what to look for.

## Quick survey greps

Cheap breadth before depth — each hit list becomes a population to count:

- `os.environ` / `os.getenv` — config access outside settings (dimension 5)
- `print(` — logging bypasses in request paths (8)
- `cursor.execute(` / `.objects.raw(` / `text(` — raw SQL sites (6)
- `except Exception` — swallow-style handling, to compare against modules that raise (2)
- `@transaction.atomic` / `session.begin(` — transaction boundaries (6)
- `permission_classes` / `Depends(` / `@login_required` — auth application points (7)
- `HTTPException` / `JsonResponse` / `Response(` — error/response shaping (2, 3)

## 1. Layer separation
- Django: the same kind of business rule living in views in one app, in model methods in another, in a `services.py` in a third.
- DRF serializers doing business logic in `validate()`/`create()` in some apps while sibling apps keep serializers as pure shape.
- FastAPI: path operation functions doing ORM work inline while sibling routers delegate to service modules.
- Flask: one blueprint with thin view functions calling services; another with 200-line view functions.

## 2. Error handling
- DRF: raising `APIException` subclasses (handled centrally) vs. manually returning `Response({'error': ...}, status=400)` vs. raw `JsonResponse` — three shapes on the wire.
- FastAPI: `raise HTTPException(...)` vs. returning error dicts with `status_code=200`; custom exception handlers registered for some domain exceptions but not their siblings.
- `except Exception: logger.warning(...); return None` in some modules while others propagate — the swallow pattern turns errors into silent `None`s downstream, so a mixed swallow/raise codebase has two failure semantics.

## 3. API contract
- DRF pagination classes on some viewsets; unpaginated `ListAPIView` on others of similar cardinality.
- Default DRF error shape on most endpoints, custom error body on the few with custom handlers — clients must parse two formats.
- snake_case JSON on most endpoints, camelCase (via djangorestframework-camel-case or manual renaming) on newer ones.

## 4. Input validation
- DRF: serializer validation on some views; `request.data.get(...)` with manual checks on others; raw `request.data[...]` on the rest.
- FastAPI: Pydantic models on some endpoints; `payload: dict = Body(...)` on others — a `dict` parameter is a validation opt-out.
- Flask: marshmallow/pydantic schemas on some routes; direct `request.json['x']` access elsewhere.

## 5. Configuration and environment
- Central `settings.py` / pydantic `BaseSettings` coexisting with scattered `os.getenv('X', default)` — and the same variable with different defaults in different modules (an error: one switch, two behaviors).
- `os.getenv` at module import time in some files, lazy access in others — import-time reads freeze config before test fixtures or entrypoint setup can act.
- Variables referenced in code but missing from `.env.example` / settings documentation.

## 6. Data access
- Django ORM in most of an app, `cursor.execute()` in scattered spots with no stated criterion.
- N+1: loops touching `obj.related_set.all()` where sibling queries use `select_related`/`prefetch_related`.
- `transaction.atomic` on some multi-write flows, missing on equivalent ones.
- Migration drift: `makemigrations --check` dirty — models moved on without migrations.
- SQLAlchemy: session lifecycle via context manager in some modules, manually opened (and leaked) sessions in others; Core and ORM mixed without a criterion.

## 7. Authentication / authorization uniformity
- DRF: `permission_classes` set on 7 of 8 views of a resource — the eighth falls back to the global default; whether that's an error depends on `DEFAULT_PERMISSION_CLASSES`, so read settings before labeling.
- FastAPI: `Depends(get_current_user)` on every route of a router except one — the route × dependency table makes the gap visible.
- Flask: `@login_required` applied unevenly across views of the same blueprint.
- Global default plus per-view overrides pointing in both directions (some stricter, some looser) — no dominant pattern; report it as a decision to make.

## 8. Observability
- `logging.getLogger(__name__)` in some modules, `print()` in request paths in others.
- Correlation: request ID bound in web middleware, but Celery tasks and management commands log without any equivalent context — the async paths go dark.
- The same failure class at `warning` in one app and `error` in another.

## 9. Naming and module organization
- Parallel Django apps solving the same shape differently: `services.py` here, `utils.py` there, fat `models.py` in the third.
- A `views.py` monolith in one app; a `views/` package in its sibling of similar size.
- File naming drift: `userHelpers.py` (camelCase file) inside a snake_case codebase.

## 10. Dependency boundaries
- Cross-app imports reaching into another app's internals (`from orders.views import build_receipt`) instead of going through a public service seam.
- Circular imports "solved" by import-inside-function — each one marks a cycle that's still there; flag the cycle, not just the workaround.
- FastAPI: routers importing from `main.py` (upward import); Django: models importing from views.
