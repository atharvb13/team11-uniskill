"""
Simple concurrent load test for UniSkill local backend.

Usage:
  cd uniskill-backend
  ./.venv/bin/python test/load_test_health.py --url http://127.0.0.1:4000/health --requests 500 --concurrency 50
"""

from __future__ import annotations

import argparse
import asyncio
import statistics
import time
from collections import Counter

import httpx


async def _one_request(client: httpx.AsyncClient, url: str, sem: asyncio.Semaphore) -> tuple[int, float]:
    async with sem:
        start = time.perf_counter()
        try:
            res = await client.get(url)
            code = res.status_code
        except Exception:
            code = 0
        elapsed_ms = (time.perf_counter() - start) * 1000
        return code, elapsed_ms


async def run(url: str, requests: int, concurrency: int, timeout: float) -> dict[str, float | int | dict[int, int]]:
    sem = asyncio.Semaphore(concurrency)
    async with httpx.AsyncClient(timeout=timeout) as client:
        started = time.perf_counter()
        results = await asyncio.gather(*[_one_request(client, url, sem) for _ in range(requests)])
        total_s = time.perf_counter() - started

    codes = Counter(code for code, _ in results)
    latencies = [ms for _, ms in results]
    success = sum(1 for code, _ in results if 200 <= code < 400)

    return {
        "requests": requests,
        "concurrency": concurrency,
        "total_time_s": total_s,
        "throughput_rps": requests / total_s if total_s > 0 else 0.0,
        "success_count": success,
        "failure_count": requests - success,
        "success_rate_pct": (success / requests) * 100 if requests else 0.0,
        "p50_ms": statistics.median(latencies) if latencies else 0.0,
        "p95_ms": statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else max(latencies, default=0.0),
        "max_ms": max(latencies, default=0.0),
        "status_codes": dict(sorted(codes.items())),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:4000/health")
    parser.add_argument("--requests", type=int, default=500)
    parser.add_argument("--concurrency", type=int, default=50)
    parser.add_argument("--timeout", type=float, default=8.0)
    args = parser.parse_args()

    summary = asyncio.run(run(args.url, args.requests, args.concurrency, args.timeout))
    print("Load test summary")
    for key, value in summary.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    main()
