# CLAUDE.md Templates

Copy, adapt, and commit. These are starting points, not gospel.

## Universal Base (All Projects)

```markdown
## Anti-Bullshit Rules

- No preamble. Start with the answer.
- No disclaimers unless legally/safety required.
- Specific > general. Always.
- If you don't know, say "I don't know" in 3 words, not 30.
- Never say "Great question" or "I'd be happy to help."
- No TODOs. No placeholders. Handle it now or descope it explicitly.

## Workflow

- Always explore before planning. Always plan before coding.
- Write tests FIRST. Watch them fail. Then implement.
- One feature per session. `/clear` between tasks.
- Write decisions to files (PLAN.md, STATUS.md), not conversation.

## Commits

- Meaningful messages. Not "fix stuff" or "update".
- Format: `type(scope): description` (e.g., `feat(auth): add OAuth2 PKCE flow`)
- No commits with failing tests.
```

## Python Project

```markdown
## Tech Stack

- Python 3.12+
- FastAPI / Flask / Django (pick one)
- pytest for testing
- black + ruff for formatting/linting
- Type hints required on all public functions

## Commands

- Test: `pytest -v`
- Lint: `ruff check .`
- Format: `black .`
- Type check: `mypy .`

## Style

- Google docstring format
- Functions under 30 lines
- No bare `except:` clauses
- Use pathlib over os.path
- Prefer dataclasses over dicts for structured data

## Project Structure

@README.md for architecture overview
@pyproject.toml for dependencies
```

## TypeScript/Node Project

```markdown
## Tech Stack

- TypeScript 5+
- Node 20+ / Bun
- Vitest for testing
- ESLint + Prettier for linting/formatting
- Strict mode enabled

## Commands

- Test: `npm test`
- Lint: `npm run lint`
- Build: `npm run build`
- Dev: `npm run dev`

## Style

- 2-space indentation
- Prefer `const` over `let`, never `var`
- Use explicit return types on exported functions
- Prefer `interface` over `type` for object shapes
- Error handling: never swallow errors silently

## Project Structure

@README.md for architecture overview
@package.json for dependencies and scripts
@tsconfig.json for TypeScript configuration
```

## React/Next.js Project

```markdown
## Tech Stack

- Next.js 14+ (App Router)
- React 18+
- TypeScript strict mode
- Tailwind CSS
- Vitest + Testing Library

## Commands

- Dev: `npm run dev`
- Test: `npm test`
- Build: `npm run build`
- Lint: `npm run lint`

## Style

- Functional components only (no class components)
- Custom hooks for shared logic (prefix with `use`)
- Server components by default, 'use client' only when needed
- Collocate: component + test + styles in same directory
- No prop drilling past 2 levels (use context or composition)

## File Naming

- Components: PascalCase.tsx
- Hooks: useFeatureName.ts
- Utils: camelCase.ts
- Tests: ComponentName.test.tsx
```

## Infrastructure/DevOps Project

```markdown
## Tech Stack

- Terraform 1.5+
- AWS / GCP / Azure (pick one)
- Docker + Docker Compose
- GitHub Actions for CI/CD

## Commands

- Plan: `terraform plan`
- Apply: `terraform apply`
- Validate: `terraform validate`
- Format: `terraform fmt -recursive`

## Style

- One resource per file when possible
- Variables in variables.tf, outputs in outputs.tf
- Use modules for repeated patterns
- Tag everything (environment, team, cost-center)
- Never hardcode secrets (use SSM/Vault/env vars)

## IMPORTANT

- NEVER modify production state without plan review
- NEVER commit .tfstate files
- NEVER hardcode AWS credentials or API keys
- Always run `terraform plan` before `terraform apply`
```

## Swift/iOS Project

```markdown
## Tech Stack

- Swift 5.9+
- SwiftUI (preferred) / UIKit (legacy)
- XCTest for testing
- SwiftLint for linting

## Commands

- Build: `xcodebuild -scheme MyApp build`
- Test: `xcodebuild -scheme MyApp test`
- Lint: `swiftlint`

## Style

- MVVM architecture
- Prefer value types (struct/enum) over reference types (class)
- Protocol-oriented design
- No force unwrapping (!) in production code
- Async/await over completion handlers
```

## macOS Enterprise Management (Fleet/MDM)

```markdown
## Tech Stack

- FleetDM + osquery
- Munki for package management
- JAMF Pro for MDM
- Bash/Zsh for scripts
- Python for automation tools

## Commands

- Fleet query: `fleetctl query --query "SELECT * FROM ..."`
- Munki import: `munkiimport /path/to/pkg`
- Lint scripts: `shellcheck *.sh`

## Style

- ShellCheck clean (no warnings)
- Use `set -euo pipefail` in all bash scripts
- Log everything to syslog or structured log file
- Idempotent scripts (safe to run multiple times)
- Test on clean VM before deploying to fleet

## IMPORTANT

- NEVER push untested profiles to production fleet
- Always scope changes to test group first
- Configuration profiles must be signed
- Document every MDM change in changelog
```
