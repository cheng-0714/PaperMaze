# PaperMaze Domain Context

## Glossary

### Maze

A rectangular arrangement of wall cells and passage cells with one configured start and one configured goal. A maze is the shared problem input for manual exploration and automatic search.

### Generated maze

The original maze produced from a supported size, seed, and generator version before a user edits any wall, start, or goal.

### Edited maze

A maze whose wall layout, start, or goal differs from its generated form. An edited maze may be unreachable.

### Maze snapshot

An immutable copy of the complete maze, including its cells, start, goal, generation identity, and whether it was edited. A snapshot preserves the exact problem used by a run.

### Start

The configured passage cell from which every automatic search begins and to which the player returns after a maze edit or reset.

### Goal

The configured passage cell that completes manual exploration or terminates a successful automatic search.

### Player

The current position used during manual exploration. Moving the player does not change the configured start of the maze.

### Run

A completed attempt against one maze snapshot. A run is either a manual run, a BFS run, or an A* run and records its outcome and applicable metrics.

### Manual run

A run completed by moving the player from the start to the goal. An unfinished manual attempt is not a run and is not saved.

### Search run

A BFS or A* run whose result has passed path validation. Search computation finishes before its visualization is played.

### Search trace

The ordered cells processed during a search run. It drives visualization and determines the visited count.

### Path

An ordered sequence of orthogonally adjacent passage cells from the configured start to the goal. A failed search has no path.

### Playback

The visual presentation of an already computed search trace and path. Pausing playback does not pause search computation.

### Run history

The saved collection of completed runs. Each entry retains its maze snapshot so an edited maze can be restored exactly.

### Challenge code

The generator version, supported size, and seed needed to recreate a generated maze. It does not reproduce later user edits.

### Experiment report

A derived view of one maze snapshot and its completed manual, BFS, or A* runs. It summarizes challenge performance, maze structure, and algorithm comparison without replacing the underlying run records.

### Challenge metrics

The measured result of a manual run: legal step count, blocked move count, elapsed time, and comparison with the shortest available search path. An unfinished attempt has no completed challenge metrics.

### Structure analysis

Deterministic measurements derived from a maze snapshot, including passage ratio, dead ends, junctions, and the shortest distance from start to goal. These measurements describe the map and do not claim a universal difficulty score.

### Distance field

A mapping from each reachable passage cell to its shortest number of steps to the goal. Walls and cells unreachable from the goal have no distance value; the field can drive a visual heatmap.

### AI explanation

Optional prose generated from bounded experiment metrics to explain the observed BFS/A* and manual results. It is an interpretation layer, not an authoritative algorithm result or part of the maze snapshot.
