"""
Validate that Python enums stay in sync with shared/constants/statuses.ts.
If this test fails, update the TypeScript file at packages/shared/constants/statuses.ts.
"""
import json
import os
import re

from app.models.report import Priority, ReportStatus
from app.models.user import UserRole


def _parse_ts_enum(ts_source: str, enum_name: str) -> set[str]:
    """Extract string values from a TypeScript enum block."""
    pattern = rf'enum {enum_name} \{{([^}}]+)\}}'
    match = re.search(pattern, ts_source, re.DOTALL)
    assert match, f"Enum '{enum_name}' not found in statuses.ts"
    body = match.group(1)
    return {v.strip().strip('"') for v in re.findall(r'=\s*"([^"]+)"', body)}


def _load_ts_enums() -> str:
    # In Docker: shared is mounted at /shared. Locally: relative to backend package.
    candidates = [
        "/shared/constants/statuses.ts",
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "shared", "constants", "statuses.ts"),
    ]
    for path in candidates:
        if os.path.exists(path):
            with open(path) as f:
                return f.read()
    raise FileNotFoundError(
        "statuses.ts not found. In Docker, mount packages/shared to /shared. "
        f"Tried: {candidates}"
    )


def test_report_status_parity() -> None:
    ts = _load_ts_enums()
    ts_values = _parse_ts_enum(ts, "ReportStatus")
    py_values = {s.value for s in ReportStatus}
    assert py_values == ts_values, (
        f"ReportStatus mismatch.\n  Python only: {py_values - ts_values}\n  TS only: {ts_values - py_values}"
    )


def test_priority_parity() -> None:
    ts = _load_ts_enums()
    ts_values = _parse_ts_enum(ts, "Priority")
    py_values = {p.value for p in Priority}
    assert py_values == ts_values, (
        f"Priority mismatch.\n  Python only: {py_values - ts_values}\n  TS only: {ts_values - py_values}"
    )


def test_user_role_parity() -> None:
    ts = _load_ts_enums()
    ts_values = _parse_ts_enum(ts, "UserRole")
    py_values = {r.value for r in UserRole}
    assert py_values == ts_values, (
        f"UserRole mismatch.\n  Python only: {py_values - ts_values}\n  TS only: {ts_values - py_values}"
    )
