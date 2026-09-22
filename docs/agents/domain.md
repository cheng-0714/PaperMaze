# Domain Docs

PaperMaze uses a single-context domain documentation layout.

## Before exploring or changing behavior

- Read `CONTEXT.md` at the repository root when it exists.
- Read relevant decisions in `docs/adr/` when the requested work touches them.
- If these files do not exist yet, continue without treating their absence as a blocker. Domain-modeling work creates them when terminology or decisions are settled.

## Expected layout

```text
/
├── CONTEXT.md
├── docs/adr/
└── frontend/ and backend/
```

## Vocabulary and decisions

- Use terms as defined in `CONTEXT.md` in issues, specifications, tests, and code.
- If a needed concept is absent, decide whether it is unnecessary wording or a real domain gap before adding it.
- Surface conflicts with an existing ADR explicitly instead of silently overriding the decision.
