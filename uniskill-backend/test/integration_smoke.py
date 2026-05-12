"""
Lightweight frontend-backend integration smoke checks against a running API.

Usage:
  cd uniskill-backend
  ./.venv/bin/python test/integration_smoke.py --base-url http://127.0.0.1:4000
"""

from __future__ import annotations

import argparse
import os

import httpx


def _check(name: str, condition: bool) -> None:
    print(f"[{'PASS' if condition else 'FAIL'}] {name}")
    if not condition:
        raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:4000")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    token = os.environ.get("TEST_BEARER_TOKEN", "").strip()

    with httpx.Client(timeout=8.0) as client:
        health = client.get(f"{base}/health")
        _check("GET /health returns 200", health.status_code == 200 and health.json().get("status") == "ok")

        no_auth_skills = client.get(f"{base}/api/skills/me")
        _check("GET /api/skills/me without token is unauthorized", no_auth_skills.status_code in {401, 403})

        if token:
            auth_headers = {"Authorization": f"Bearer {token}"}
            me = client.get(f"{base}/api/profile/me", headers=auth_headers)
            _check("GET /api/profile/me with token is reachable", me.status_code in {200, 404})
            recs = client.get(f"{base}/api/profile/recommendations", headers=auth_headers)
            _check("GET /api/profile/recommendations with token is reachable", recs.status_code == 200)

    print("Integration smoke checks finished.")


if __name__ == "__main__":
    main()
