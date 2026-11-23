import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "data"))
os.environ.setdefault("SQLITE_PATH", "/tmp/throughline_test.db")
# The suite makes many analyses from one test client; rate-limit tests enable it explicitly.
os.environ.setdefault("RATE_LIMIT_ANALYZE_PER_DAY", "0")
# Keep tests offline and free even when the repo's .env holds a real OpenAI key
# (load_dotenv never overrides variables that are already set).
os.environ.setdefault("OPENAI_API_KEY", "")
if os.path.exists("/tmp/throughline_test.db"):
    os.remove("/tmp/throughline_test.db")

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def _internal_headers() -> dict:
    # When INTERNAL_API_TOKEN is configured (SaaS-gateway deployment), the
    # tests act as the internal caller by sending the service token.
    token = os.environ.get("INTERNAL_API_TOKEN", "")
    return {"X-Internal-Token": token} if token else {}

def test_internal_gate_blocks_anonymous_mutations():
    token = os.environ.get("INTERNAL_API_TOKEN", "")
    if not token:
        return
    r = client.post("/api/changes/analyze", json={"change_request": "0123456789 abcdefghij"})
    assert r.status_code == 401

def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"

def test_brain_status_transparent_local():
    r = client.get("/api/brain/status")
    assert r.status_code == 200
    body = r.json()
    if os.environ.get("HYDRA_DB_API_KEY"):
        # Key present: backend honestly reports reachability either way.
        # The only invariant is consistency between the flag and the mode.
        assert body["hydra_configured"] is True
        assert body["retrieval_mode"] == ("hydra" if body["hydra_connected"] else "local")
    else:
        assert body["retrieval_mode"] == "local"
        assert body["hydra_connected"] is False
    assert body["indexed_sources"] >= 10

def test_full_flow_analyze_approve():
    demo = "Our refund policy changes from 30 days to 14 days effective October 15, 2026. Analyze the organizational impact."
    r = client.post("/api/changes/analyze", json={"change_request": demo}, headers=_internal_headers())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["old_window_days"] == 30 and body["new_window_days"] == 14
    assert len(body["impacts"]) == 4
    assert any(e["customer"] == "ACME Corp" for e in body["exceptions"])
    assert body["retrieval_mode"] in ("local", "hydra")
    assert "search_company_knowledge" in body["selected_tools"]
    assert "detect_conflicts" in body["selected_tools"]
    assert len(body["actions"]) == 4
    # sources must be real retrieved docs
    assert len(body["sources"]) >= 4

    aid = body["actions"][0]["id"]
    r2 = client.post(f"/api/actions/{aid}/approve", json={"note": "FAQ update approved"}, headers=_internal_headers())
    assert r2.status_code == 200
    assert r2.json()["status"] == "approved"
    # idempotent re-approve keeps approved, no duplicate
    r3 = client.post(f"/api/actions/{aid}/approve", json={"note": "double click"}, headers=_internal_headers())
    assert r3.json()["status"] == "approved"

def test_reject_flow():
    demo = "Refund policy changes from 30 days to 14 days effective October 15, 2026."
    r = client.post("/api/changes/analyze", json={"change_request": demo}, headers=_internal_headers())
    aid = [a for a in r.json()["actions"] if a["status"] == "draft"]
    assert aid, "expected fresh drafts"
    rid = aid[0]["id"]
    r2 = client.post(f"/api/actions/{rid}/reject", json={"note": "not now"}, headers=_internal_headers())
    assert r2.json()["status"] == "rejected"

def test_rerun_creates_no_duplicates():
    demo = "Our refund policy changes from 30 days to 14 days effective October 15, 2026. Analyze the organizational impact."
    before = client.get("/api/actions").json()["actions"]
    r = client.post("/api/changes/analyze", json={"change_request": demo}, headers=_internal_headers())
    assert r.status_code == 200
    after = client.get("/api/actions").json()["actions"]
    assert len(after) == len(before), "re-running the same change must not duplicate actions"

import pytest
HAS_HYDRA_KEY = bool(os.environ.get("HYDRA_DB_API_KEY"))

@pytest.mark.skipif(HAS_HYDRA_KEY, reason="local score-gate test; live Hydra path verified via scripts/verify_hydradb.py")
def test_insufficient_evidence_no_fabrication():
    before = client.get("/api/actions").json()["actions"]
    r = client.post("/api/changes/analyze", json={
        "change_request": "What is our parental leave policy for contractors in Germany? List the exact clauses."}, headers=_internal_headers())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["impacts"] == []
    assert body["exceptions"] == []
    assert body["actions"] == []
    assert body["old_window_days"] is None
    assert any("Insufficient evidence" in w for w in body["warnings"])
    assert "refus" in body["summary"].lower() or "No supporting evidence" in body["summary"]
    after = client.get("/api/actions").json()["actions"]
    assert len(after) == len(before), "out-of-corpus query must not draft actions"

@pytest.mark.skipif(HAS_HYDRA_KEY, reason="live Hydra chunk windows cover doc starts; bait at doc end is out of window — approval gate still enforced")
def test_injection_surfaced_in_live_retrieval():
    demo = "Our refund policy changes from 30 days to 14 days effective October 15, 2026. Analyze the organizational impact."
    r = client.post("/api/changes/analyze", json={"change_request": demo}, headers=_internal_headers())
    body = r.json()
    assert any("Untrusted instruction ignored" in w for w in body["warnings"])
    # approval gate still intact: drafts stay drafts until human approval
    assert all(a["status"] in ("draft", "approved", "rejected") for a in body["actions"])


REFUND = {"change_request": "Our refund policy changes from 30 days to 14 days effective October 15, 2026."}

def _fresh_quota_store(monkeypatch, limit: int):
    from app.config import settings
    from app.repositories.db import Store
    monkeypatch.setattr(settings, "rate_limit_analyze_per_day", limit)
    with Store(settings.sqlite_path)._connect() as conn:
        conn.execute("DELETE FROM rate_limits")
    return settings

def test_rate_limit_blocks_after_daily_quota(monkeypatch):
    if os.environ.get("INTERNAL_API_TOKEN"):
        return
    _fresh_quota_store(monkeypatch, 3)
    codes = [client.post("/api/changes/analyze", json=REFUND).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]
    r = client.post("/api/changes/analyze", json=REFUND)
    assert r.status_code == 429
    assert "3 analyses per IP per day" in r.json()["detail"]
    assert 0 < int(r.headers["retry-after"]) <= 86400

def test_rate_limit_ignores_spoofed_forwarded_for_by_default(monkeypatch):
    if os.environ.get("INTERNAL_API_TOKEN"):
        return
    _fresh_quota_store(monkeypatch, 1)
    assert client.post("/api/changes/analyze", json=REFUND).status_code == 200
    # A client cannot reset its quota by inventing a new X-Forwarded-For value.
    r = client.post("/api/changes/analyze", json=REFUND, headers={"X-Forwarded-For": "203.0.113.9"})
    assert r.status_code == 429

def test_rate_limit_uses_forwarded_for_behind_trusted_proxy(monkeypatch):
    if os.environ.get("INTERNAL_API_TOKEN"):
        return
    settings = _fresh_quota_store(monkeypatch, 1)
    monkeypatch.setattr(settings, "trust_proxy_headers", True)
    a = {"X-Forwarded-For": "203.0.113.1, 10.0.0.1"}
    b = {"X-Forwarded-For": "203.0.113.2"}
    assert client.post("/api/changes/analyze", json=REFUND, headers=a).status_code == 200
    assert client.post("/api/changes/analyze", json=REFUND, headers=a).status_code == 429
    assert client.post("/api/changes/analyze", json=REFUND, headers=b).status_code == 200

def test_rate_limit_exempts_internal_gateway(monkeypatch):
    _fresh_quota_store(monkeypatch, 1)
    monkeypatch.setenv("INTERNAL_API_TOKEN", "test-gateway-token")
    h = {"X-Internal-Token": "test-gateway-token"}
    for _ in range(3):
        assert client.post("/api/changes/analyze", json=REFUND, headers=h).status_code == 200

def test_rate_limit_stores_no_raw_ip(monkeypatch):
    if os.environ.get("INTERNAL_API_TOKEN"):
        return
    settings = _fresh_quota_store(monkeypatch, 5)
    client.post("/api/changes/analyze", json=REFUND)
    from app.repositories.db import Store
    with Store(settings.sqlite_path)._connect() as conn:
        rows = [r["client_hash"] for r in conn.execute("SELECT client_hash FROM rate_limits")]
    assert rows and all(len(h) == 64 and "testclient" not in h for h in rows)
