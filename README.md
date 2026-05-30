# Continuo Skills Catalog

Official catalog source for the Continuo Skills Manager Plugin.

This repository publishes `catalog.json` for the plugin catalog URL:

`https://raw.githubusercontent.com/philip1974/continuo-skills-catalog/main/catalog.json`

## Purpose

The catalog lists skill entries that the Continuo Skills Manager can display,
preview, and install.

Each entry points at a Git repository, an exact commit SHA, an optional subpath,
and a canonical hash over `SKILL.md` content.

## Add A Skill

1. Fork this repository.
2. Add one `CatalogEntry` to `catalog.json`.
3. Use a real immutable commit SHA.
4. Make sure the target subpath contains `SKILL.md`.
5. Run `pnpm tsx tools/catalog-hash.ts --write`.
6. Inspect the resulting `hash` value.
7. Submit a pull request.

## Seed Phase

v0.1 starts in `seedPhase`.

The initial entries are placeholders for bring-up only.
Community pull requests will replace them with real entries that include real
SHAs and computed hashes.

## Related

Plugin repository:

`https://github.com/philip1974/continuo-skills-manager-plugin`

Status: TBD until the plugin repository is published.
