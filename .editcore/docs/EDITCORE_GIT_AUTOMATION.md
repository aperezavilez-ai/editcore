# EDITCORE Git Automation

## EDITCORE GIT MANAGER

- Rama automática: `editcore/work-YYYYMMDD-<taskId>`
- Punto de restauración: stash + marker en `.editcore/git/restore-points/`
- Commits descriptivos (opcional, `autonomous.autoCommit`)
- PR via `gh pr create` si GitHub CLI disponible

## Reglas

- Nunca push --force (Security Guard)
- Confirmación para commits y PRs
- Rama de evolución antes de cambios en main/master

