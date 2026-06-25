# Fork Snapshots

This directory keeps a tracked copy of fork overlay snapshots that are useful
when rebasing `develop` onto a newer upstream `main`.

Each change directory contains:

- `manifest.json`: the captured new files, upstream patch files, and shared touchpoints.
- `patch.diff`: the corresponding diff against the captured `main` base.

The local tool still writes regenerated snapshots to `tools/fork-snapshots/`,
which is intentionally ignored. Copy a known-good snapshot here when it should
travel with the `develop` branch.
