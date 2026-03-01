---
summary: "CLI reference for `keanu reset` (reset local state/config)"
read_when:
  - You want to wipe local state while keeping the CLI installed
  - You want a dry-run of what would be removed
title: "reset"
---

# `keanu reset`

Reset local config/state (keeps the CLI installed).

```bash
keanu reset
keanu reset --dry-run
keanu reset --scope config+creds+sessions --yes --non-interactive
```
