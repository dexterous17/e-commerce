#!/usr/bin/env python3
"""
After `playwright test --project=demo-videos`, transcode each test's
`test-results/<run>/video.webm` into `docs/demo-videos/<stable-name>.mp4`.

Playwright always records WebM; this script is the only publish step to docs/.
Requires: ffmpeg on PATH.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

FRONTEND_DIR = Path(__file__).resolve().parent.parent
RESULTS_DIR = FRONTEND_DIR / "test-results"
REPO_ROOT = FRONTEND_DIR.parent
OUT_DIR = REPO_ROOT / "docs" / "demo-videos"
ASSETS_DIR = REPO_ROOT / "assets"

# [folder substring match (case insensitive), output filename]
MAP: list[tuple[str, str]] = [
    ("01-storefront", "01-storefront-tour.mp4"),
    ("02-register", "02-register-session.mp4"),
    ("03-checkout", "03-checkout-flow.mp4"),
    ("04-search", "04-search-catalog.mp4"),
    ("05-sign-in", "05-sign-in-session.mp4"),
    ("06-profile", "06-profile-orders.mp4"),
]


def find_run_videos() -> list[tuple[str, Path]]:
    out: list[tuple[str, Path]] = []
    if not RESULTS_DIR.is_dir():
        return out
    for entry in RESULTS_DIR.iterdir():
        if not entry.is_dir():
            continue
        video = entry / "video.webm"
        if video.is_file():
            out.append((entry.name, video))
    return out


def write_readme_assets(mp4: Path) -> tuple[Path, Path]:
    """Copy MP4 + PNG thumbnail into assets/ for README [![Watch the demo]](thumb)](video)."""
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    stem = mp4.stem
    asset_mp4 = ASSETS_DIR / f"{stem}.mp4"
    thumbnail = ASSETS_DIR / f"{stem}-thumbnail.png"
    shutil.copy2(mp4, asset_mp4)
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-y",
            "-ss",
            "1",
            "-i",
            str(mp4),
            "-frames:v",
            "1",
            "-update",
            "1",
            str(thumbnail),
        ],
        check=True,
    )
    return asset_mp4, thumbnail


def transcode_webm_to_mp4(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-y",
            "-i",
            str(src),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-an",
            str(dest),
        ],
        check=True,
    )


def main() -> int:
    if shutil.which("ffmpeg") is None:
        print(
            "sync-demo-mp4: ffmpeg not found. Install ffmpeg (e.g. brew install ffmpeg).",
            file=sys.stderr,
        )
        return 1

    entries = find_run_videos()
    best: dict[str, tuple[Path, float]] = {}

    for dirname, video_path in entries:
        match = next(
            (out_name for key, out_name in MAP if key.lower() in dirname.lower()),
            None,
        )
        if match is None:
            continue
        mtime = video_path.stat().st_mtime
        prev = best.get(match)
        if prev is None or mtime > prev[1]:
            best[match] = (video_path, mtime)

    if not best:
        print(
            "sync-demo-mp4: no video.webm found under frontend/test-results. "
            "Run demo-videos project first.",
            file=sys.stderr,
        )
        return 1

    for out_name, (video_path, _) in sorted(best.items()):
        dest = OUT_DIR / out_name
        rel_src = video_path.relative_to(FRONTEND_DIR)
        print(f"sync-demo-mp4: {rel_src} -> ../docs/demo-videos/{out_name}")
        transcode_webm_to_mp4(video_path, dest)
        asset_mp4, thumbnail = write_readme_assets(dest)
        print(f"sync-demo-mp4: assets/{asset_mp4.name}, assets/{thumbnail.name}")

    print(f"sync-demo-mp4: wrote {len(best)} file(s) to docs/demo-videos/ and assets/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
