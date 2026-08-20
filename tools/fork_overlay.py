#!/usr/bin/env python3
"""Fork overlay snapshot + verify tooling.

Parses every OpenSpec change proposal (active or archived) for its
``## Fork Touchpoints`` section, then either:

  snapshot
    Writes ``tools/fork-snapshots/<change-id>/{manifest.json,patch.diff}``.
    Run this BEFORE rebasing ``develop`` onto a refreshed ``main`` so that
    if a patch is lost during rebase, the saved diff can replay it.

  verify
    Re-parses proposals and checks against the current HEAD:
      1. every ``New Files`` and ``Upstream Patch Files`` path exists;
      2. every ``Upstream Patch Files`` path still differs from ``main``
         (otherwise the patch has been silently dropped);
      3. every ``Shared Touchpoints`` entry's co-owner change actually
         lists the same path in one of its sections (bidirectional).

Both commands accept ``--base`` (defaults to ``main``).
"""

from __future__ import annotations

import argparse
import dataclasses as dc
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT_ROOT = REPO_ROOT / "tools" / "fork-snapshots"
DEFAULT_BASE = "main"

SUBSECTIONS = (
    "New Files",
    "Upstream Patch Files",
    "Shared Touchpoints",
    "Non-OpenSpec Overlap",
)

BULLET_RE = re.compile(r"^-\s+`([^`]+)`\s*[:：]\s*(.+?)\s*$")
# ``- _None._`` may carry a trailing justification on the same line.
NONE_RE = re.compile(r"^-\s+_None\._(?:\s+.*)?$", re.IGNORECASE)
SHARED_OWNER_RE = re.compile(r"also owned by[^`]*`([^`]+)`")
SUBHEADING_RE = re.compile(r"^###\s+(.+?)\s*$")
ANY_BULLET_RE = re.compile(r"^-\s+\S")


@dc.dataclass
class Entry:
    path: str
    reason: str
    shared_with: str | None = None

    def to_dict(self) -> dict:
        d: dict = {"path": self.path, "reason": self.reason}
        if self.shared_with:
            d["shared_with"] = self.shared_with
        return d


@dc.dataclass
class Manifest:
    change_id: str
    status: str
    proposal_path: str
    captured_at: str
    captured_at_commit: str
    base: str
    base_commit: str
    new_files: list[Entry] = dc.field(default_factory=list)
    upstream_patch_files: list[Entry] = dc.field(default_factory=list)
    shared_touchpoints: list[Entry] = dc.field(default_factory=list)
    non_openspec_overlap: list[Entry] = dc.field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "change_id": self.change_id,
            "status": self.status,
            "proposal_path": self.proposal_path,
            "captured_at": self.captured_at,
            "captured_at_commit": self.captured_at_commit,
            "base": self.base,
            "base_commit": self.base_commit,
            "new_files": [e.to_dict() for e in self.new_files],
            "upstream_patch_files": [e.to_dict() for e in self.upstream_patch_files],
            "shared_touchpoints": [e.to_dict() for e in self.shared_touchpoints],
            "non_openspec_overlap": [e.to_dict() for e in self.non_openspec_overlap],
        }


def run(cmd: list[str], *, check: bool = True) -> str:
    res = subprocess.run(cmd, cwd=REPO_ROOT, check=check, capture_output=True, text=True)
    return res.stdout


def discover_proposals() -> list[tuple[Path, str]]:
    base = REPO_ROOT / "openspec" / "changes"
    out: list[tuple[Path, str]] = []
    for p in sorted(base.glob("*/proposal.md")):
        out.append((p, "active"))
    for p in sorted((base / "archive").glob("*/proposal.md")):
        out.append((p, "archived"))
    return out


def parse_fork_touchpoints(text: str) -> dict[str, list[Entry]]:
    """Return entries keyed by subsection name. Missing section ⇒ empty list."""
    lines = text.splitlines()
    sections: dict[str, list[Entry]] = {s: [] for s in SUBSECTIONS}

    start = next(
        (i for i, ln in enumerate(lines) if ln.strip() == "## Fork Touchpoints"),
        None,
    )
    if start is None:
        return sections

    end = len(lines)
    for i in range(start + 1, len(lines)):
        ln = lines[i]
        if ln.startswith("## ") and not ln.startswith("### "):
            end = i
            break

    current: str | None = None
    for ln in lines[start + 1 : end]:
        m = SUBHEADING_RE.match(ln)
        if m:
            heading = m.group(1).strip()
            current = heading if heading in sections else None
            continue
        if current is None or NONE_RE.match(ln):
            continue
        bm = BULLET_RE.match(ln)
        if not bm:
            continue
        entry = Entry(path=bm.group(1).strip(), reason=bm.group(2).strip())
        if current == "Shared Touchpoints":
            sm = SHARED_OWNER_RE.search(entry.reason)
            if sm:
                entry.shared_with = sm.group(1)
        sections[current].append(entry)

    return sections


def collect_touchpoint_parse_findings(text: str) -> list[str]:
    """Structural findings for a proposal's ``## Fork Touchpoints`` section.

    ``verify``'s per-path checks are silently vacuous when the section is
    absent, or when a bullet inside it does not match ``BULLET_RE``: the change
    still gets counted as "verified" while covering nothing at all. Both
    failure modes have already shipped once in this repo (a full-width colon
    reduced the keepalive change to zero touchpoints and its archived snapshot
    to an empty shell), so surface them instead of counting an empty pass.
    """
    lines = text.splitlines()
    start = next(
        (i for i, ln in enumerate(lines) if ln.strip() == "## Fork Touchpoints"),
        None,
    )
    if start is None:
        return ["missing `## Fork Touchpoints` section — verify covers nothing"]

    end = len(lines)
    for i in range(start + 1, len(lines)):
        ln = lines[i]
        if ln.startswith("## ") and not ln.startswith("### "):
            end = i
            break

    findings: list[str] = []
    current: str | None = None
    for lineno, ln in enumerate(lines[start + 1 : end], start=start + 2):
        m = SUBHEADING_RE.match(ln)
        if m:
            heading = m.group(1).strip()
            current = heading if heading in SUBSECTIONS else None
            continue
        if current is None or NONE_RE.match(ln) or not ANY_BULLET_RE.match(ln):
            continue
        if BULLET_RE.match(ln):
            continue
        findings.append(
            f"unparsed bullet under `{current}` (line {lineno}), "
            f"silently dropped: {ln.strip()}"
        )
    return findings


def build_manifest(proposal_path: Path, status: str, base: str) -> Manifest:
    sections = parse_fork_touchpoints(proposal_path.read_text(encoding="utf-8"))
    return Manifest(
        change_id=proposal_path.parent.name,
        status=status,
        proposal_path=proposal_path.relative_to(REPO_ROOT).as_posix(),
        captured_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        captured_at_commit=run(["git", "rev-parse", "HEAD"]).strip(),
        base=base,
        base_commit=run(["git", "rev-parse", base]).strip(),
        new_files=sections["New Files"],
        upstream_patch_files=sections["Upstream Patch Files"],
        shared_touchpoints=sections["Shared Touchpoints"],
        non_openspec_overlap=sections["Non-OpenSpec Overlap"],
    )


def assert_base_exists(base: str) -> None:
    res = subprocess.run(
        ["git", "rev-parse", "--verify", base],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    if res.returncode != 0:
        sys.exit(f"error: base ref '{base}' not found (stderr: {res.stderr.strip()})")


def cmd_snapshot(args: argparse.Namespace) -> int:
    assert_base_exists(args.base)
    SNAPSHOT_ROOT.mkdir(parents=True, exist_ok=True)
    written: list[str] = []
    for proposal_path, status in discover_proposals():
        m = build_manifest(proposal_path, status, args.base)
        out_dir = SNAPSHOT_ROOT / m.change_id
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "manifest.json").write_text(
            json.dumps(m.to_dict(), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        patch_paths = [e.path for e in m.upstream_patch_files]
        diff = (
            run(["git", "diff", f"{args.base}..HEAD", "--"] + patch_paths)
            if patch_paths
            else ""
        )
        (out_dir / "patch.diff").write_text(diff, encoding="utf-8")
        written.append(m.change_id)

    rel = SNAPSHOT_ROOT.relative_to(REPO_ROOT)
    print(f"Wrote {len(written)} snapshot(s) under {rel}/:")
    for cid in written:
        print(f"  - {cid}")
    return 0


def cmd_verify(args: argparse.Namespace) -> int:
    assert_base_exists(args.base)
    manifests = [
        build_manifest(p, s, args.base) for p, s in discover_proposals()
    ]
    by_id = {m.change_id: m for m in manifests}

    errors: list[str] = []
    warnings: list[str] = []

    for m in manifests:
        header = f"[{m.status:<8}] {m.change_id}"

        proposal_text = (REPO_ROOT / m.proposal_path).read_text(encoding="utf-8")
        for finding in collect_touchpoint_parse_findings(proposal_text):
            warnings.append(f"{header}: {finding}")

        for e in m.new_files:
            if not (REPO_ROOT / e.path).exists():
                errors.append(f"{header}: new file missing in HEAD: {e.path}")

        for e in m.upstream_patch_files:
            if not (REPO_ROOT / e.path).exists():
                errors.append(f"{header}: patched file missing in HEAD: {e.path}")
                continue
            diff = run(
                ["git", "diff", f"{args.base}..HEAD", "--", e.path],
                check=False,
            )
            if not diff.strip():
                errors.append(
                    f"{header}: upstream patch lost (no diff vs {args.base}): {e.path}"
                )

        for e in m.shared_touchpoints:
            other = e.shared_with
            if not other:
                warnings.append(
                    f"{header}: shared touchpoint missing `also owned by ...` marker: {e.path}"
                )
                continue
            other_m = by_id.get(other)
            if other_m is None:
                errors.append(
                    f"{header}: shared touchpoint refers to unknown change `{other}`: {e.path}"
                )
                continue
            all_other_paths = (
                {x.path for x in other_m.new_files}
                | {x.path for x in other_m.upstream_patch_files}
                | {x.path for x in other_m.shared_touchpoints}
            )
            if e.path not in all_other_paths:
                errors.append(
                    f"{header}: shared with `{other}` but `{other}` does not list {e.path}"
                )

    for line in warnings:
        print(f"WARN  {line}")
    for line in errors:
        print(f"ERROR {line}")
    if not errors and not warnings:
        print(f"OK: {len(manifests)} change(s) verified, no findings.")
    elif not errors:
        print(f"OK with warnings: {len(manifests)} change(s) verified.")
    return 1 if errors else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("snapshot", help="emit per-change manifests and diffs")
    sp.add_argument("--base", default=DEFAULT_BASE)
    sp.set_defaults(func=cmd_snapshot)

    vp = sub.add_parser("verify", help="check overlay integrity vs HEAD")
    vp.add_argument("--base", default=DEFAULT_BASE)
    vp.set_defaults(func=cmd_verify)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
