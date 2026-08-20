# Fork Snapshots

This directory keeps a tracked copy of fork overlay snapshots that are useful
when rebasing `develop` onto a newer upstream `main`. It is the authoritative
copy: recovery instructions in `openspec/FORK.md` point here, not at the
tool's scratch directory.

Each change directory contains:

- `manifest.json`: the captured new files, upstream patch files, shared
  touchpoints and non-OpenSpec overlaps, plus the base ref they were captured
  against.
- `patch.diff`: the corresponding diff against the captured base.

**`patch.diff` only covers the `Upstream Patch Files` of a change — it does
not include `New Files`.** A snapshot therefore cannot replay a lost new file
on its own; recover those from the path list in `manifest.json` plus git
history (the file's last good blob on the pre-rebase backup branch).

A change whose patch files are all absorbed upstream produces an empty
`patch.diff`; that is expected only for entries marked ⬆️ upstreamed in
`openspec/FORK.md`. An empty diff anywhere else means the snapshot captured
nothing and must be investigated before it is committed — this has happened
before, when a proposal's touchpoint bullets failed to parse.

The local tool writes regenerated snapshots to `tools/fork-snapshots/`, which
is gitignored and holds nothing tracked. Copy a known-good snapshot here when
it should travel with the `develop` branch.
