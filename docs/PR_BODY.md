## Summary

Merge `codex/inkwash-redesign` into `main` (clean fast-forward; `main` is an ancestor of HEAD).

```text
Immutable maze snapshot
├── European fantasy frontend + maze generation visualization
├── Manual / BFS / A* runs → experiment reports
│   └── Optional AI explanation → local fallback
├── Teaching playback → queue/frontier inspection and reversible steps
└── Design LaTeX report, demos, and screenshot evidence
```

Includes `d73fdfb` fixes for start-reachable coverage, legacy run resubmission, and A* teaching replay.

## Evidence

- **Before:** [Merge review](merge-review-main.md) reported `MERGE_BLOCKED`: disconnected-map coverage could exceed 100% and prevent AI fallback; legacy identical POST retries returned 500; A* relaxation left stale frontier candidates.
  **After:** `d73fdfb` corrects the coverage denominator, normalizes legacy optional fields before comparison, and replaces frontier entries by coordinates. The review addendum records `MERGE_OK` with an open P2.
- **Before:** Review-time checks passed 25 frontend tests and 12 backend tests but missed these regressions.
  **After:** Post-fix verification records **27/27 frontend Vitest tests**, **vue-tsc pass**, and **13/13 backend pytest tests**.
- **Visual evidence:** [Overall page](design-latex/images/00-整体页面.png), [teaching playback](images/06-教学推演.png), [generation process](images/07-生成过程.png), and [run history](images/05-运行历史.png). These are supplied screenshots, not newly rerun browser acceptance.

**Known gap:** P2 parent-pointer visualization is still missing; existing acceptance claims for that display should not be treated as verified. Heuristic naming/duplication notes remain open. Browser acceptance, largest-map SVG performance, documented startup, live AI calls, and LaTeX rebuilding were not reverified in the merge review.

## Merge Danger

**Door:** two-way

Revertible with `git revert` of the introduced commits.

**Blast Radius:** cross-layer

Changes affect frontend UX, optional API fields and legacy-run compatibility, and teaching replay. Fast-forward topology avoids content conflicts but does not replace runtime acceptance checks.
