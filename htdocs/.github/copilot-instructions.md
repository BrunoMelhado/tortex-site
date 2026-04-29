# Copilot Instructions

> NOTE: This repository currently contains no source files. Consider this a
> placeholder document that can be expanded as the project grows.

## Big-picture architecture

At the moment there are no modules, services, or configuration files to
analyze. When architecture emerges, describe the major components and how
they communicate. For example:

- `src/server/` hosts an Express-based API that talks to the `data/`
database layer via a `DbClient` abstraction.
- `packages/ui/` is a React monorepo package that consumes the REST
endpoints.

Include the *reasoning* behind early design decisions (e.g. microservice
split to isolate billing logic) so that AI agents can suggest changes that
fit the intent.

## Build & test workflow

No build scripts or test runners are defined. When the project defines a
`package.json`, `Makefile`, or similar, document commands such as:

```sh
npm run build      # compile TypeScript, bundle with Webpack
npm test           # run Jest unit tests and generate coverage
```

Also note any non-obvious environment variables or local services required
for development (e.g. a local PostgreSQL instance on port 5432).

## Conventions & patterns

Add notes about project-specific idioms as they appear. Examples include:

- A custom `utils/logger.ts` that all modules import instead of `console`.
- Domain models in `models/` follow `PascalCase` names and expose a
`validate()` method.
- Error handling uses a shared `AppError` class defined in `lib/errors.ts`.

Document anything that differs from standard language idioms or that
Copilot should know to replicate consistently.

## Integration points

List external services, SDKs, or APIs the code talks to (e.g. AWS
DynamoDB, Stripe, Google Maps). Provide details on where credentials are
loaded (environment variables, `config.json`, etc.) and how the integration
is exercised in tests.

## How to expand this document

As files are added to the repo, update this document with concrete
examples and guidance. AI agents will read it before generating or
modifying code, so keeping it current helps them make better suggestions.

> ⚠️ Until the project contains source code, most of this document will be
> placeholders. Please revisit once you have a codebase to describe.