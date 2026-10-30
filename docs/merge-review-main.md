# Review: `main...HEAD`

## Scope and method

- Fixed point: `main` = `af38b0680a59ce31d5da0ce5a36e04370c527f67`.
- Reviewed HEAD: `codex/inkwash-redesign` = `a6122e388be303985abfe76008f309667f17979d`.
- Committed diff: `git diff main...HEAD` (not the working-tree diff).
- Commits: `93d324f` — maze experiment reports and AI fallback; `073d50f` — European fantasy frontend, generator and teaching playback; `a6122e3` — design report, demos and acceptance materials.
- Two independent, parallel reviewers examined Standards and Spec. The parent verified their functional findings against source and ran the checks below. Findings remain separate by axis; repeated issues are intentional, not additional distinct defects.
- Standards: `AGENTS.md`, `CONTEXT.md`, `docs/agents/domain.md`, `docs/agents/issue-tracker.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, and the code-review skill's heuristic smell baseline. Repository rules override heuristics; tooling-enforced style issues are excluded.
- Specifications: `README.md`, `docs/开发设计文档.md`, `docs/design-latex/README.md`, `docs/design-latex/SOURCE_design.md`, `docs/design-latex/ACCEPTANCE_CHECKLIST.md`, and `docs/ACCEPTANCE_CHECKLIST.md`. The duplicated delivery documents carry the same relevant requirements.
- P1 = high-priority correctness/regression issue; P2 = normal-priority gap or maintenance concern. Heuristic concerns are not hard violations or independent merge blockers.

## Standards

### Documented-standard violations

1. **P1 — Coverage is measured against the wrong connected component.** `frontend/src/core/analysis.ts:23–26,49–51` counts passages reachable from the **goal**; `frontend/src/App.vue:365,481` divides **start-origin** search visits by that count. Isolating the goal produces percentages above 100% and invalid AI request metrics. This conflicts with `AGENTS.md:10` (derive displayed metrics from real run data) and the map/run distinction in `CONTEXT.md`. Verified example: three visited start-component cells divided by one goal-component cell gives 300%. **Fix:** compute the start-reachable denominator separately; retain goal distances for the heatmap. Add a disconnected-map regression rather than merely clamping the displayed percentage.

2. **P2 — Documentation claims a parent-pointer display that is absent.** `README.md:14` and both acceptance checklists at line 23 claim displayed parent pointers, with the checklists marking the feature verified. `frontend/src/App.vue:440–446` and `frontend/src/MazeBoard.vue:50–65` show queues, current nodes and paths, but do not render the computed `parents` maps. Also, `docs/ARCHITECTURE.md:3` still restricts the backend to validation/persistence despite the AI endpoint at `backend/main.py:131–159`. This breaches `AGENTS.md:13,20` (honest completion claims and aligned documentation). **Fix:** implement and verify the promised display; reconcile the architecture description.

### Heuristic concerns, not hard violations

3. **P2 — Possible Mysterious Name / inconsistent units.** BFS replay adds `"state.visited = [...state.visited, event.to]"` on **discovery** (`frontend/src/core/search.ts:131–145`), while A* adds visited entries on **selection** (`:231–234`). Both drive “已探石室” (`frontend/src/App.vue:444`). Distinguish discovered versus processed cells or label the counters explicitly. Ordinary saved search metrics are not implicated.

4. **P2 — Possible Duplicated Code.** Added `"const random32"` and `"function generateDfs"` (`frontend/src/core/generator.ts:71–76,219–270`) duplicate the RNG/DFS shape in `frontend/src/core/maze.ts:23–70`. Consider one deterministic carving implementation with optional event recording, preserving compatibility tests; do not introduce a framework solely to remove duplication.

**Standards summary: 4 findings (2 documented violations, 2 heuristic concerns); worst: incorrect coverage and consequent AI-request rejection. Axis result: FAIL.**

## Spec

1. **P1 — Main-era records break idempotent resubmission after upgrade.** Requirement: “相同 ID 和内容的重复提交返回已有记录” (`docs/开发设计文档.md:94`; also `docs/design-latex/SOURCE_design.md:94`). New collision fields at `backend/main.py:54–56` do not exist in old stored JSON, but `:160–165` indexes every current model field directly. A database row actually created by the `main` application retries with 200 on main and **500 / `KeyError('collisionCount')`** on HEAD. Ordinary GET remains 200; this is an API compatibility regression, not evidence of database deletion. **Fix:** normalize stored legacy data through compatible defaults, including nested generator identity, before comparing. Test genuine pre-upgrade records for both identical retry and conflicting-content rejection.

2. **P1 — Unsolvable maps can prevent even local AI fallback.** Requirements: “未配置时自动使用本地规则解释” and “支持无解迷宫” (`README.md:16–17`). Goal-component coverage (`frontend/src/core/analysis.ts:49–51`; `frontend/src/App.vue:365,481`) can exceed 1. `backend/main.py:106–107` then rejects the request with **422**, before fallback runs. Verified without an API key using an isolated goal and a three-cell start component. **Fix:** correct the coverage denominator and exercise the frontend-derived summary through the endpoint on a disconnected map.

3. **P1 — A* teaching displays stale candidates after relaxation.** Requirement: “观察队列和父指针如何变化” (`docs/开发设计文档.md:84`; mirrored source design). `frontend/src/core/search.ts:221–224,237–242` removes a frontier entry by coordinates **and the new g**, so it cannot remove the old, larger-g candidate. The existing cyclic-map fixture produces two entries for `(4,4)` at cursor 143: `g=8,f=18` and `g=6,f=16`. The panel at `frontend/src/App.vue:445` displays both. **Fix:** replace by coordinates on relaxation and test uniqueness/correct state across forward and backward replay. Ordinary A* path computation is separate and passes its regression test.

4. **P2 — Required parent-pointer visualization is missing.** Requirement: “显示…父指针” (`README.md:14`; mirrored delivery README). Replay computes parents, but neither the teaching panel nor board renders them (`frontend/src/App.vue:441–446`; `frontend/src/MazeBoard.vue:50–65`). **Fix:** expose parent edges or a parent table, with a reversible-step acceptance check.

Narrative scenes, generator experiments and reports are supported by the supplied specs; no substantiated unrequested scope creep was found.

**Spec summary: 4 findings (3 P1, 1 P2); worst: legacy-record idempotent retry changes from 200 to 500. Axis result: FAIL.**

## Verification performed for this review

### Automated checks

| Check | Observed result |
|---|---|
| `npm run test` in `frontend/` | PASS: 6 files, 25 tests |
| `npm run typecheck` in `frontend/` | PASS |
| `npm run build` in `frontend/` | PASS: production Vite build |
| `.venv\Scripts\python.exe -m pytest backend/tests -q` | PASS: 12 tests; one Starlette/AnyIO deprecation warning |
| README's `pnpm test`, `pnpm typecheck`, `pnpm build` | All stopped before script execution: `packages field missing or empty` in this environment. The equivalent existing package scripts passed through npm; documented pnpm startup is not claimed verified. |

Passing existing tests does not cover the counterexamples below. No source fixes or test-suite changes were applied as part of the review.

### Targeted reproductions

1. **Legacy database compatibility:** loaded `main:backend/main.py` into an isolated Python module, created a temporary SQLite database through that version's FastAPI app, and POSTed a valid two-cell manual run without the new collision/generator fields. Main returned **201** on creation and **200** on identical retry. Reopened the same database through HEAD: GET returned **200**; identical POST returned **500**. With server exceptions enabled, the exception was `KeyError('collisionCount')`. Only temporary databases were used, never the user's `papermaze.sqlite3`.
2. **Disconnected coverage:** executed the actual TypeScript modules by transpiling them in memory. Fixture: 11×11 walls except passages `(1,1)`, `(1,2)`, `(1,3)`, `(9,9)`; start `(1,1)`, goal `(9,9)`. BFS returned `found=false`, three visits; analysis returned one `reachablePassages`; the UI formula yielded `3`, or **300%**. POSTing this derived summary without a DeepSeek key returned **422** at `body.bfsCoverage`. A valid control summary with coverage 1 returned **200**, source `local`.
3. **A* replay:** used the existing 11×11 cyclic fixture from `frontend/src/core/search.test.ts:87–102`. Built its teaching trace and replayed through the first `relax` event, cursor **143**. Frontier contained both `(4,4,g=8,h=10,f=18)` and `(4,4,g=6,h=10,f=16)`. This directly exercises the production replay function, not a reimplementation.

Review scratch evidence is local/ignored: `.scratch/merge-review-main.diff`, `.scratch/merge-review-main-paths.txt`, `.scratch/merge-review-probe.py`. They are not required shipping artifacts. The fixtures and observed results above document the essential evidence independently of those local paths.

### Boundaries and positive evidence

- Both independent reviewers and parent source inspection found independent search state, full edited snapshots, and computation separated from playback. Existing tests cover seeded generation, movement/edit rules, shortest paths, unreachable maps, persistence, and generator identity.
- PM1 DFS reproduction remains implemented; PM2 adds generator identity. The ordinary A* shorter-pending-route correction has a passing fixed regression test.
- This review did **not** repeat interactive browser acceptance, responsive/reduced-motion checks, largest-map SVG performance, or a fresh-install `start.ps1` run. Historical checked boxes and screenshots are supplied evidence, not newly rerun checks.
- No live/paid DeepSeek call was made. No PDF/LaTeX rebuild or visual document audit was performed.

## Merge readiness

### Git topology and conflicts

- `git merge-base main HEAD` equals main: `af38b0680a59ce31d5da0ce5a36e04370c527f67`.
- `git merge-base --is-ancestor main HEAD` exited **0**.
- `git rev-list --left-right --count main...HEAD` returned **0 / 3**: no main-only commits, three HEAD-only commits.
- `git ls-files -u` returned no unmerged index entries. The tracked working tree was clean before this report was written.
- Therefore, **the reviewed committed range is a clean fast-forward candidate onto this local main**; no three-way content conflict is required. No merge, checkout, commit, push, or destructive cleanup was performed. Remote branch state was not fetched or asserted.
- Pre-existing untracked LaTeX logs, auxiliary files and backup artifacts were preserved. They are not committed-range conflicts. Check local untracked-file collisions before an eventual checkout/merge, and commit this requested report separately if it should ship.

### Feature compatibility versus `af38b06`

The backend storage implementation is unchanged, and the real pre-upgrade GET probe still restores the old record. There is no demonstrated deletion of existing history or loss of map matrices. Nevertheless, **legacy idempotent POST is a confirmed breaking regression**. New disconnected-map reporting and A* teaching also fail their advertised behavior. Git conflict freedom does not make these semantic regressions safe to merge.

### Verdict: **MERGE_BLOCKED**

Reasons: legacy-record retries return HTTP 500; valid disconnected maps produce invalid coverage and defeat AI fallback; A* teaching replay retains obsolete candidates; promised parent-pointer visualization/acceptance claims remain inconsistent with implementation. Correct these issues and add focused regression checks before approval. The heuristic naming/duplication notes alone do not block merging. Recheck the documented startup path and applicable browser acceptance before release; successful unit tests and fast-forward topology do not replace those checks.

## Post-review remediation (d73fdfb)

P1 blockers from the review above were fixed on `codex/inkwash-redesign` before merge:

1. **Coverage denominator** — `analyzeMaze` now counts start-reachable passages; goal BFS remains in `distanceField`. Regression: disconnected-map coverage ≤ 100%.
2. **Legacy idempotent POST** — `_normalize_stored_run` fills missing optional fields / `maze.generatorId` before compare. Regression: pre-upgrade SQLite row retries with 200.
3. **A* teaching relax** — `replayAstarTeaching` removes frontier entries by coordinates only. Regression: cyclic-map frontier unique after first relax.

Re-verification after fix: frontend `npm test` 27/27 pass; `vue-tsc` pass; backend `pytest` 13/13 pass.

Remaining non-blocking: parent-pointer UI still not rendered (P2); heuristic naming/duplication notes unchanged.

**Updated verdict: MERGE_OK (fast-forward), with open P2 parent-pointer visualization.**
