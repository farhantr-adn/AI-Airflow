"""Tests for BYOK (Bring-Your-Own-Key) API keys and output_format feature on /api/pipelines/generate."""
import json
import time
import requests
import pytest


# ----------------- Root smoke (post-refactor) -----------------
def test_root_returns_forge_api(base_url, api_client):
    r = api_client.get(f"{base_url}/api/")
    assert r.status_code == 200
    body = r.json()
    assert body.get("name") == "Forge API"
    assert body.get("status") == "ok"


# ----------------- Auth smoke -----------------
def test_login_returns_jwt(base_url, api_client):
    r = api_client.post(f"{base_url}/api/auth/login",
                        json={"email": "forge_test@example.com", "password": "forgepass123"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 10
    assert data["user"]["email"] == "forge_test@example.com"


def test_auth_me_with_bearer(base_url, auth_headers):
    r = requests.get(f"{base_url}/api/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["email"] == "forge_test@example.com"


# ----------------- API key CRUD -----------------
@pytest.fixture(scope="module")
def created_groq_key(base_url, auth_headers):
    payload = {
        "label": "TEST_groq_llama3",
        "mode": "openai-compat",
        "api_key": "gsk_TEST_abcdefghijklmnop",
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "llama-3.1-70b-versatile",
    }
    r = requests.post(f"{base_url}/api/api-keys", headers=auth_headers, json=payload)
    assert r.status_code == 200, r.text
    key = r.json()
    # MUST NOT leak encrypted blob
    assert "api_key_encrypted" not in key
    assert "api_key_masked" in key
    masked = key["api_key_masked"]
    # mask uses bullet '•' or asterisk; should NEVER equal raw key
    assert masked != payload["api_key"], "masked value equals raw key"
    assert any(c in masked for c in ("•", "*", "·", "●")), f"no mask chars in {masked!r}"
    assert key["base_url"] == "https://api.groq.com/openai/v1"
    assert key["default_model"] == "llama-3.1-70b-versatile"
    assert key["mode"] == "openai-compat"
    assert "id" in key and key["id"].startswith("key_")
    yield key
    # cleanup
    requests.delete(f"{base_url}/api/api-keys/{key['id']}", headers=auth_headers)


def test_create_groq_key(created_groq_key):
    assert created_groq_key["id"].startswith("key_")


def test_list_api_keys_masked(base_url, auth_headers, created_groq_key):
    r = requests.get(f"{base_url}/api/api-keys", headers=auth_headers)
    assert r.status_code == 200
    keys = r.json()
    ids = [k["id"] for k in keys]
    assert created_groq_key["id"] in ids
    for k in keys:
        # never expose encrypted blob or raw key
        assert "api_key_encrypted" not in k
        assert "api_key" not in k
        assert "api_key_masked" in k


def test_create_key_invalid_mode_returns_400(base_url, auth_headers):
    r = requests.post(f"{base_url}/api/api-keys", headers=auth_headers, json={
        "label": "TEST_invalid_mode",
        "mode": "bogus-mode",
        "api_key": "deadbeefdeadbeef",
    })
    assert r.status_code == 400, r.text


def test_create_compat_key_missing_base_url_returns_400(base_url, auth_headers):
    r = requests.post(f"{base_url}/api/api-keys", headers=auth_headers, json={
        "label": "TEST_no_base",
        "mode": "openai-compat",
        "api_key": "abcdefghabcdefgh",
    })
    assert r.status_code == 400, r.text


def test_delete_api_key(base_url, auth_headers):
    # create then delete a separate key
    r = requests.post(f"{base_url}/api/api-keys", headers=auth_headers, json={
        "label": "TEST_to_delete",
        "mode": "openai",
        "api_key": "sk-TESTdeleteabcd1234",
    })
    assert r.status_code == 200, r.text
    kid = r.json()["id"]
    d = requests.delete(f"{base_url}/api/api-keys/{kid}", headers=auth_headers)
    assert d.status_code == 200
    # verify removed
    r2 = requests.get(f"{base_url}/api/api-keys", headers=auth_headers)
    ids = [k["id"] for k in r2.json()]
    assert kid not in ids


# ----------------- Connected repo (reuse one) -----------------
@pytest.fixture(scope="module")
def repo_for_gen(base_url, auth_headers):
    # Get an existing repo or connect one
    r = requests.get(f"{base_url}/api/repos", headers=auth_headers)
    assert r.status_code == 200
    repos = r.json()
    if repos:
        return repos[0]
    rc = requests.post(f"{base_url}/api/repos/connect", headers=auth_headers,
                       json={"provider": "github", "url": "https://github.com/tiangolo/fastapi"})
    assert rc.status_code == 200, rc.text
    return rc.json()


# ----------------- Helper -----------------
def _consume_sse(resp, max_seconds=60, stop_on_text=None):
    """Consume SSE stream, returns (meta, events_list, content_buffer, error)."""
    meta = None
    events = []
    content = []
    error = None
    deadline = time.time() + max_seconds
    for line in resp.iter_lines(decode_unicode=True):
        if time.time() > deadline:
            break
        if not line or not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        try:
            obj = json.loads(payload)
        except Exception:
            continue
        events.append(obj)
        if "meta" in obj:
            meta = obj["meta"]
        if "delta" in obj:
            content.append(obj["delta"])
            if stop_on_text and stop_on_text in "".join(content):
                break
        if "error" in obj:
            error = obj["error"]
            break
        if obj.get("done"):
            break
    return meta, events, "".join(content), error


# ----------------- output_format = scripts -----------------
def test_generate_pipeline_scripts(base_url, auth_headers, repo_for_gen):
    payload = {
        "repo_id": repo_for_gen["id"],
        "target_platform": "github-actions",
        "cloud_target": "aws",
        "deploy_strategy": "rolling",
        "output_format": "scripts",
        "model": "claude-sonnet-4-5-20250929",
        "provider": "anthropic",
    }
    with requests.post(f"{base_url}/api/pipelines/generate", headers=auth_headers,
                       json=payload, stream=True, timeout=120) as r:
        assert r.status_code == 200
        assert "text/event-stream" in r.headers.get("content-type", "")
        meta, events, content, error = _consume_sse(r, max_seconds=110,
                                                    stop_on_text="#!/usr/bin/env bash")
    assert error is None, f"SSE error: {error}"
    assert meta is not None, "no meta event"
    # confirm scripts markers present
    assert "=== FILE:" in content, f"missing FILE marker. sample: {content[:400]}"
    assert "#!/usr/bin/env bash" in content or "Makefile" in content, content[:400]


# ----------------- output_format = terraform -----------------
def test_generate_pipeline_terraform(base_url, auth_headers, repo_for_gen):
    payload = {
        "repo_id": repo_for_gen["id"],
        "target_platform": "github-actions",
        "cloud_target": "aws",
        "deploy_strategy": "rolling",
        "output_format": "terraform",
        "model": "claude-sonnet-4-5-20250929",
        "provider": "anthropic",
    }
    with requests.post(f"{base_url}/api/pipelines/generate", headers=auth_headers,
                       json=payload, stream=True, timeout=120) as r:
        assert r.status_code == 200
        meta, events, content, error = _consume_sse(r, max_seconds=110,
                                                    stop_on_text='resource "aws_')
    assert error is None, f"SSE error: {error}"
    assert meta is not None
    assert ('resource "aws_' in content) or ('resource \"aws_' in content), content[:400]


# ----------------- output_format = cloudformation -----------------
def test_generate_pipeline_cloudformation(base_url, auth_headers, repo_for_gen):
    payload = {
        "repo_id": repo_for_gen["id"],
        "target_platform": "github-actions",
        "cloud_target": "aws",
        "deploy_strategy": "rolling",
        "output_format": "cloudformation",
        "model": "claude-sonnet-4-5-20250929",
        "provider": "anthropic",
    }
    with requests.post(f"{base_url}/api/pipelines/generate", headers=auth_headers,
                       json=payload, stream=True, timeout=120) as r:
        assert r.status_code == 200
        meta, events, content, error = _consume_sse(r, max_seconds=110,
                                                    stop_on_text="AWSTemplateFormatVersion")
    assert error is None, f"SSE error: {error}"
    assert meta is not None
    assert ("AWSTemplateFormatVersion" in content) or ("Type: AWS::" in content), content[:400]


# ----------------- output_format = yaml (default) -----------------
def test_generate_pipeline_yaml_default(base_url, auth_headers, repo_for_gen):
    payload = {
        "repo_id": repo_for_gen["id"],
        "target_platform": "github-actions",
        "cloud_target": "aws",
        "deploy_strategy": "rolling",
        "output_format": "yaml",
        "model": "claude-sonnet-4-5-20250929",
        "provider": "anthropic",
    }
    with requests.post(f"{base_url}/api/pipelines/generate", headers=auth_headers,
                       json=payload, stream=True, timeout=120) as r:
        assert r.status_code == 200
        meta, events, content, error = _consume_sse(r, max_seconds=90,
                                                    stop_on_text="jobs:")
    assert error is None, f"SSE error: {error}"
    assert meta is not None
    assert meta.get("mode") == "emergent"
    # GitHub Actions YAML should contain 'jobs:' or 'on:' key
    assert ("jobs:" in content) or ("on:" in content) or ("name:" in content), content[:400]


# ----------------- BYOK path with fake openai-compat key -----------------
def test_generate_with_byok_fake_key_returns_meta_then_upstream_error(
        base_url, auth_headers, repo_for_gen, created_groq_key):
    payload = {
        "repo_id": repo_for_gen["id"],
        "target_platform": "github-actions",
        "cloud_target": "aws",
        "deploy_strategy": "rolling",
        "output_format": "scripts",
        "model": "claude-sonnet-4-5-20250929",
        "provider": "anthropic",
        "api_key_id": created_groq_key["id"],
        "custom_model": "llama-3.1-70b-versatile",
    }
    with requests.post(f"{base_url}/api/pipelines/generate", headers=auth_headers,
                       json=payload, stream=True, timeout=60) as r:
        assert r.status_code == 200
        meta, events, content, error = _consume_sse(r, max_seconds=45)
    assert meta is not None, f"no meta event. events: {events[:5]}"
    assert meta.get("mode") == "openai-compat", f"meta={meta}"
    assert meta.get("base_url") == "https://api.groq.com/openai/v1"
    # We expect an upstream auth error since the key is fake
    assert error is not None, f"expected upstream auth error, got content: {content[:400]}"
    # 401 or invalid_api_key or authentication in error string
    err_lc = error.lower()
    assert ("401" in err_lc) or ("auth" in err_lc) or ("api key" in err_lc) or ("invalid" in err_lc), error


# ----------------- BYOK with non-existent api_key_id -> 404 -----------------
def test_generate_with_unknown_api_key_id_404(base_url, auth_headers, repo_for_gen):
    payload = {
        "repo_id": repo_for_gen["id"],
        "target_platform": "github-actions",
        "cloud_target": "aws",
        "deploy_strategy": "rolling",
        "output_format": "yaml",
        "api_key_id": "key_does_not_exist_xyz",
        "custom_model": "gpt-4o-mini",
    }
    r = requests.post(f"{base_url}/api/pipelines/generate", headers=auth_headers,
                      json=payload, timeout=30)
    assert r.status_code == 404, r.text
    assert "API key not found" in r.text or "not found" in r.text.lower()
