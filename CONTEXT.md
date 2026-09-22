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
