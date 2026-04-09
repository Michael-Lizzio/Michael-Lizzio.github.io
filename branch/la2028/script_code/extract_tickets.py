#!/usr/bin/env python3
"""
Extract LA28 Olympic ticket rows from screenshots using OpenAI vision + structured JSON.

Uses the Responses API with multimodal input (text + image) and strict json_schema output.
Default model is a recent multimodal model (override with OPENAI_MODEL). This reads images;
it does not use image generation models.

Usage:
  cd branch/la2028/script_code
  python -m venv .venv && source .venv/bin/activate  # or Windows: .venv\\Scripts\\activate
  pip install -r requirements.txt
  cp ../.env.example ../.env   # add OPENAI_API_KEY

  python extract_tickets.py --images-dir ../images --out ../tickets/extracted_tickets.json
  python extract_tickets.py --single ../images/foo.png --dry-run
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import mimetypes
import sys
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

try:
    from openai import OpenAI
except ImportError as e:
    raise SystemExit("Install dependencies: pip install -r requirements.txt") from e

from schema import SCHEMA_NAME, TICKET_PAGE_SCHEMA

LOGGER = logging.getLogger("extract_tickets")

# Prompt tuned for LA28 "Olympic Games Tickets" list UI
SYSTEM_INSTRUCTIONS = """You extract structured data from screenshots of the official LA28 Olympic Games Tickets listing page.
Each visible card/row usually has: a code + sport title line, a description line, a line with date | time | venue | zone, and a starting price.
Copy text faithfully. If a field is missing or unreadable, use empty string for strings and null for price_amount when unknown.
Include every ticket row fully visible in the image; do not invent rows beyond what is shown."""


def _guess_mime(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    if mime and mime.startswith("image/"):
        return mime
    return "image/png"


def _image_to_data_url(path: Path) -> str:
    raw = path.read_bytes()
    b64 = base64.b64encode(raw).decode("ascii")
    return f"data:{_guess_mime(path)};base64,{b64}"


def _extract_json_from_response(resp: Any) -> dict[str, Any]:
    """Read structured JSON from Responses API output."""
    text = getattr(resp, "output_text", None)
    if text:
        return json.loads(text)
    # Some SDK versions expose output items
    out = getattr(resp, "output", None)
    if out:
        for item in out:
            content = getattr(item, "content", None) or []
            for block in content:
                if getattr(block, "type", None) in ("output_text", "text"):
                    t = getattr(block, "text", None)
                    if t:
                        return json.loads(t)
    if hasattr(resp, "model_dump"):
        LOGGER.debug("Unexpected response shape: %s", json.dumps(resp.model_dump(), default=str)[:2000])
    raise RuntimeError("Could not read JSON from API response; check SDK version and response shape.")


def extract_page(
    client: OpenAI,
    model: str,
    image_path: Path,
    *,
    max_retries: int = 5,
    base_delay_s: float = 1.5,
) -> dict[str, Any]:
    data_url = _image_to_data_url(image_path)
    user_text = (
        f"Source file name: {image_path.name}\n"
        "Extract all ticket rows from this screenshot into the required JSON schema."
    )

    last_err: Exception | None = None
    for attempt in range(max_retries):
        try:
            response = client.responses.create(
                model=model,
                input=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": SYSTEM_INSTRUCTIONS + "\n\n" + user_text},
                            {"type": "input_image", "image_url": data_url},
                        ],
                    }
                ],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": SCHEMA_NAME,
                        "strict": True,
                        "schema": TICKET_PAGE_SCHEMA,
                    }
                },
            )
            return _extract_json_from_response(response)
        except Exception as e:
            last_err = e
            wait = base_delay_s * (2**attempt)
            LOGGER.warning("Attempt %s/%s failed for %s: %s — retry in %.1fs", attempt + 1, max_retries, image_path.name, e, wait)
            time.sleep(wait)

    assert last_err is not None
    raise last_err


def _dedupe_key(row: dict[str, Any]) -> tuple[Any, ...]:
    return (
        row.get("event_code", ""),
        row.get("date", ""),
        row.get("time_local", ""),
        row.get("venue", ""),
        row.get("title", ""),
        row.get("price_display", ""),
    )


def _build_payload(
    *,
    model: str,
    paths: list[Path],
    by_source: dict[str, list[dict[str, Any]]],
    all_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    seen: set[tuple[Any, ...]] = set()
    unique: list[dict[str, Any]] = []
    for row in all_rows:
        k = _dedupe_key(row)
        if k in seen:
            continue
        seen.add(k)
        unique.append(row)
    return {
        "meta": {
            "model": model,
            "planned_image_count": len(paths),
            "processed_image_count": len(by_source),
            "ticket_row_count": len(unique),
            "raw_row_count_before_dedupe": len(all_rows),
        },
        "by_image": by_source,
        "tickets": unique,
    }


def run(
    images_dir: Path,
    out_path: Path,
    *,
    model: str,
    dry_run: bool,
    single: Path | None,
) -> None:
    la28_root = Path(__file__).resolve().parents[1]
    load_dotenv(la28_root / ".env")
    load_dotenv()
    api_key = __import__("os").environ.get("OPENAI_API_KEY")
    if not dry_run and not api_key:
        raise SystemExit("Set OPENAI_API_KEY in the environment or branch/la2028/.env")

    patterns = ("*.png", "*.jpg", "*.jpeg", "*.webp", "*.gif")
    if single:
        paths = [single] if single.exists() else []
    else:
        paths = []
        for pat in patterns:
            paths.extend(sorted(images_dir.glob(pat)))

    paths = [p for p in paths if p.is_file()]
    if not paths:
        raise SystemExit(f"No images found under {images_dir}")

    LOGGER.info("Processing %s image(s) with model %s", len(paths), model)

    if dry_run:
        for p in paths:
            LOGGER.info("Would process: %s", p)
        return

    client = OpenAI(api_key=api_key)
    all_rows: list[dict[str, Any]] = []
    by_source: dict[str, list[dict[str, Any]]] = {}
    partial_path = out_path.with_suffix(out_path.suffix + ".partial")

    for i, path in enumerate(paths, start=1):
        LOGGER.info("[%s/%s] %s", i, len(paths), path.name)
        page = extract_page(client, model, path)
        tickets = page.get("tickets") or []
        stamped: list[dict[str, Any]] = []
        for row in tickets:
            item = dict(row)
            item["source_image"] = path.name
            stamped.append(item)
        all_rows.extend(stamped)
        by_source[path.name] = stamped

        payload = _build_payload(model=model, paths=paths, by_source=dict(by_source), all_rows=list(all_rows))
        out_path.parent.mkdir(parents=True, exist_ok=True)
        partial_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    final_payload = _build_payload(model=model, paths=paths, by_source=by_source, all_rows=all_rows)
    out_path.write_text(json.dumps(final_payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    try:
        partial_path.unlink(missing_ok=True)
    except OSError:
        pass
    LOGGER.info("Wrote %s (%s tickets)", out_path, final_payload["meta"]["ticket_row_count"])


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    default_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Extract LA28 ticket data from screenshots via OpenAI vision.")
    parser.add_argument("--images-dir", type=Path, default=default_root / "images")
    parser.add_argument("--out", type=Path, default=default_root / "tickets" / "extracted_tickets.json")
    parser.add_argument(
        "--model",
        type=str,
        default=__import__("os").environ.get("OPENAI_MODEL", "gpt-4o"),
        help="Multimodal model id (vision). Examples: gpt-4o, gpt-4.1, gpt-5.2 if available on your account.",
    )
    parser.add_argument("--single", type=Path, default=None, help="Process one file only.")
    parser.add_argument("--dry-run", action="store_true", help="List images; do not call the API.")
    args = parser.parse_args()

    try:
        run(args.images_dir, args.out, model=args.model, dry_run=args.dry_run, single=args.single)
    except KeyboardInterrupt:
        LOGGER.error("Interrupted")
        sys.exit(130)


if __name__ == "__main__":
    main()
