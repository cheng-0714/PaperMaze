# PaperMaze Agent Guide

PaperMaze is a course project for generating mazes, exploring them manually, and visualizing BFS and A* pathfinding. Keep the implementation small enough to explain and demonstrate during an in-person acceptance review.

## Working principles

- Build the required end-to-end flow before optional visual polish.
- Keep maze generation, movement rules, search algorithms, playback, rendering, and persistence as separate responsibilities.
- Treat the maze snapshot used for a run as immutable. BFS and A* must allocate independent search state.
- Derive displayed metrics from real run data. Never count animation frames as visited nodes or include playback and network time in algorithm timing.
- Preserve enough data to restore edited maps from history; a seed alone only reproduces the original generated maze.
- Prefer the platform, standard library, and existing dependencies. Add a dependency only when it removes more complexity than it introduces.
- Do not claim planned features or unrun tests as completed.

## Validation expectations

- Use fixed maps for path legality, shortest-path, unreachable-map, collision, and boundary tests.
- Verify the full persistence loop: save, refresh or restart, load, and restore.
- Check the largest supported SVG map on the target browser before changing renderers or adding workers.
- Keep README, design documentation, AI usage records, and demo claims aligned with the implementation.

## Agent skills

### Issue tracker

Specifications and implementation tickets are kept as local Markdown under `.scratch/` and are not published automatically. See `docs/agents/issue-tracker.md`.

### Domain docs

This repository uses a single-context domain documentation layout. See `docs/agents/domain.md`.
