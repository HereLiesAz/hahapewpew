#!/usr/bin/env python3
"""Serve the actual game and S2.2 QA assets on loopback only.

The production Cloudflare Worker never serves workbench files. This tool
maps / to public/index.html, normal asset URLs to public/, and only the
isolated workbench/shift and tests/visual trees to their repository paths.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
WORKBENCH = ROOT / "workbench" / "shift"
VISUAL_TESTS = ROOT / "tests" / "visual"


class ShiftQAHandler(SimpleHTTPRequestHandler):
    """Read-only static file handler constrained to the QA directory allowlist."""

    def translate_path(self, path):
        requested = unquote(urlsplit(path).path)
        if requested == "/":
            return str(PUBLIC / "index.html")
        if requested.startswith("/workbench/shift/"):
            root = WORKBENCH
            relative = requested.removeprefix("/workbench/shift/")
        elif requested.startswith("/tests/visual/"):
            root = VISUAL_TESTS
            relative = requested.removeprefix("/tests/visual/")
        elif requested.startswith("/public/"):
            root = PUBLIC
            relative = requested.removeprefix("/public/")
        else:
            root = PUBLIC
            relative = requested.lstrip("/")
        resolved = (root / relative).resolve()
        if not resolved.is_relative_to(root.resolve()):
            return str(PUBLIC / "__invalid_shift_qa_path__")
        return str(resolved)

    def list_directory(self, path):
        self.send_error(403, "Directory listing disabled")
        return None


if __name__ == "__main__":
    address = ("127.0.0.1", 8765)
    print(f"S2.2 QA: http://{address[0]}:{address[1]}/?shiftQA=front", flush=True)
    with ThreadingHTTPServer(address, ShiftQAHandler) as server:
        server.serve_forever()
