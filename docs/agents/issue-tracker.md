# Issue tracker GitHub

Issues and specifications for this repository live in GitHub Issues at `cheng-0714/PaperMaze`. Use the GitHub CLI for tracker operations.

## Conventions

- Create an issue with `gh issue create --title "..." --body-file <file>`.
- Read an issue with `gh issue view <number> --comments` and include its labels when relevant.
- List issues with `gh issue list` using explicit state and JSON fields.
- Comment with `gh issue comment <number> --body-file <file>`.
- Close with `gh issue close <number>` after the acceptance criteria are met.
- Infer the repository from the configured `origin` remote.

## Pull requests as a request surface

PRs as a request surface: no.

## Skill operations

- When a skill says to publish a specification or ticket, create a GitHub Issue.
- When a skill says to fetch a ticket, read the referenced GitHub Issue and its comments.
- Use GitHub issue dependencies when available. If unavailable, add a `Blocked by: #<number>` line to the child issue.
- Claim implementation work by assigning the issue to the authenticated user, then close it only after validation succeeds.
