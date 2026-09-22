# Issue tracker Local Markdown

Specifications and tickets for this repository stay local under `.scratch/`. Do not create GitHub Issues or pull requests, and do not push commits unless the user explicitly requests it after review.

## Conventions

- One effort per directory: `.scratch/<feature-slug>/`.
- The specification is `.scratch/<feature-slug>/spec.md`.
- Tickets are separate files under `.scratch/<feature-slug>/issues/`, numbered in dependency order.
- Each ticket records its status and blockers near the top.
- A ticket is unblocked when all listed blocker tickets are complete.

## Skill operations

- Publishing a specification means writing its local Markdown file.
- Publishing tickets means writing one local Markdown file per ticket.
- Fetching a ticket means reading its referenced local file.
- Local workflow files are intentionally ignored by Git.
