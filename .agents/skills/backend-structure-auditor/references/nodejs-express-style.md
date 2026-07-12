# Node.js / Express-style backends — stack-specific symptoms

Load this when the audited code is JS/TS server-side: Express, Koa, Fastify, or Nest-flavored codebases (`package.json` at the root; route/middleware idioms). Same 10 dimensions as the core skill, sharpened with the idioms this ecosystem actually drifts on. Mechanisms, modes, and report format come from the core skill — this file only tells you what to look for.

## Quick survey greps

Cheap breadth before depth — each hit list becomes a population to count:

- `process.env.` — config access sites (dimension 5)
- `console.log(` / `console.error(` — logging bypasses (8)
- `res.status(` and `res.json(` inside route files — inline error/response shaping (2, 3)
- `$queryRaw` / `knex.raw` / `.query(` — raw SQL sites (6)
- `router.use(` / `app.use(` — middleware application points (7)
- `require(` vs `import ` — module system mixing (9)
- `new PrismaClient(` / `createConnection(` — DB client instantiation sites (6, 10)

## 1. Layer separation
- Route handlers calling the ORM directly (`await prisma.user.findMany(...)` inside `router.get`) while sibling routes delegate to a service.
- Services receiving `req` or `res` objects — transport leaking into the domain layer. A service that reads `req.headers` can't be reused from a job queue or a test.
- Business rules inside middleware (beyond auth/parsing/logging) when the rest of the project keeps middleware thin.

## 2. Error handling
- The classic three-way split: `throw new AppError(...)` caught by a 4-arg error middleware, vs. inline `res.status(500).json(...)`, vs. `.catch(err => res.json({ error }))`.
- Async handlers with no try/catch and no wrapper in an Express 4 codebase whose siblings use an `asyncHandler` wrapper: a rejected promise never reaches the error middleware — an *error*, not a style choice. (Express 5 forwards rejections natively; check the version before flagging.)
- Err-first callbacks coexisting with promises/async in the same module.
- Error middleware registered before some routers — registration order decides which routes it actually covers.

## 3. API contract
- `{ data, error }` envelope on some controllers, bare arrays/objects on others.
- `200` with `{ success: false }` on some endpoints, proper `4xx` on others, for the same failure class.
- `?page=&limit=` on one list endpoint, `?offset=&count=` on the next.
- camelCase and snake_case keys mixed within the same API surface — often the seam between hand-written and AI-generated endpoints.

## 4. Input validation
- zod/joi/celebrate/express-validator schemas on some routes; manual `if (!req.body.email)` checks on others; raw `req.body` on the rest.
- TS-specific: `req.body as CreateUserInput` — a cast is not validation; flag it where siblings `.parse()`.
- Validation living inside the handler on some routes and mounted as middleware on others: same mechanism, two boundaries.

## 5. Configuration and environment
- Central validated config (`config.ts` + envalid/zod) coexisting with scattered `process.env.X ?? 'default'`.
- The same variable with different fallbacks in two files (`process.env.TIMEOUT ?? '5000'` vs. `?? '30000'`) — an error: one switch, two behaviors.
- `dotenv` loaded in `index.ts` but not in worker/script entrypoints that read the same variables.
- Env vars referenced in code but absent from `.env.example`.

## 6. Data access
- Prisma/TypeORM/Sequelize repositories coexisting with `$queryRaw`/`knex.raw` at call sites, with no stated criterion.
- N+1: `for (const u of users) await prisma.post.findMany({ where: { userId: u.id } })` where sibling code uses `include` or `in`-batching.
- Some multi-write flows wrapped in `prisma.$transaction` / `sequelize.transaction`, equivalent flows elsewhere unwrapped.
- Migration drift: `prisma migrate status` (or the ORM's equivalent) not clean against the checked-in migrations.
- Ad hoc client instantiations where the project otherwise shares one client module — also a dimension-10 bypass.

## 7. Authentication / authorization uniformity
- Build the route × middleware table: one resource applies `requireAuth` router-wide (`router.use`), another per-route, a third covers 23 of 24 routes — the uncovered one is the finding.
- Role checks in middleware on some resources, inline `if (req.user.role !== 'admin')` in handlers on others.
- Auth ordered after body parsing on some routers, before on others — flag only when something elsewhere depends on a specific order; otherwise it's noise.

## 8. Observability
- pino/winston in some modules, `console.log('here', obj)` in request paths in others.
- Request-ID middleware present, but some modules log with the root logger instead of the request-scoped child — the ID exists and still doesn't reach the log line.
- The same failure class logged at `info` in one module and `error` in another.

## 9. Naming and module organization
- `src/services/UserService.ts` next to `src/services/order-service.ts` next to `src/helpers/payments.js` — three conventions for one role.
- Some resources shaped as `routes/x.ts` + `services/x.ts` pairs; another resource defined entirely inline in `app.ts`.
- CommonJS `require` and ESM `import` mixed — convention noise that doubles as a build hazard.

## 10. Dependency boundaries
- A service importing from `routes/` (upward import); two services importing each other — in CJS the cycle often surfaces as a mysteriously `undefined` export at runtime.
- Handlers importing the DB client directly while a repository layer exists — a bypass of a paid-for abstraction.
- A `utils/` grab-bag importing from feature modules: the "shared" layer now depends on its consumers.
