"""Backend tests for Forge AI CI/CD platform"""
import time
import json
import requests
import pytest


# ----------------- Health -----------------
def test_root(base_url, api_client):
    r = api_client.get(f"{base_url}/api/")
    assert r.status_code == 200
    assert r.json().get('status') == 'ok'


# ----------------- Auth -----------------
def test_auth_me_no_token(base_url):
    r = requests.get(f"{base_url}/api/auth/me")
    assert r.status_code == 401


def test_auth_me_valid_token(base_url, auth_headers):
    r = requests.get(f"{base_url}/api/auth/me", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['email'] == 'forge_test@example.com'
    assert 'user_id' in data


def test_signup_new_user(base_url, api_client):
    email = f'signup_{int(time.time())}@example.com'
    r = api_client.post(f"{base_url}/api/auth/register",
                        json={'email': email, 'password': 'test1234', 'name': 'Signup Test'})
    assert r.status_code == 200, r.text
    data = r.json()
    assert 'token' in data
    assert data['user']['email'] == email


def test_login_invalid(base_url, api_client):
    r = api_client.post(f"{base_url}/api/auth/login",
                        json={'email': 'forge_test@example.com', 'password': 'wrongpass'})
    assert r.status_code == 401


# ----------------- Models -----------------
def test_list_models(base_url, api_client):
    r = api_client.get(f"{base_url}/api/models")
    assert r.status_code == 200
    models = r.json()['models']
    assert len(models) == 6
    default_models = [m for m in models if m.get('default')]
    assert len(default_models) == 1
    assert default_models[0]['id'] == 'claude-sonnet-4-5-20250929'


# ----------------- Repos -----------------
@pytest.fixture(scope='module')
def connected_repo(base_url, auth_headers):
    """Connect a real GitHub repo for downstream tests"""
    r = requests.post(f"{base_url}/api/repos/connect",
                      headers=auth_headers,
                      json={'provider': 'github', 'url': 'https://github.com/tiangolo/fastapi'})
    assert r.status_code == 200, r.text
    return r.json()


def test_connect_github_repo(connected_repo):
    assert connected_repo['provider'] == 'github'
    assert connected_repo['name'] == 'fastapi'
    assert connected_repo['mocked'] is False
    assert 'Python' in connected_repo['tech_stack']['languages']


def test_connect_invalid_github_url(base_url, auth_headers):
    r = requests.post(f"{base_url}/api/repos/connect",
                      headers=auth_headers,
                      json={'provider': 'github', 'url': 'not-a-url'})
    assert r.status_code == 400


def test_list_repos_contains_connected(base_url, auth_headers, connected_repo):
    r = requests.get(f"{base_url}/api/repos", headers=auth_headers)
    assert r.status_code == 200
    ids = [x['id'] for x in r.json()]
    assert connected_repo['id'] in ids


def test_oauth_mock_gitlab(base_url, auth_headers):
    r = requests.post(f"{base_url}/api/repos/oauth-mock/gitlab", headers=auth_headers)
    assert r.status_code == 200
    repos = r.json()
    assert len(repos) == 3
    for repo in repos:
        assert repo['provider'] == 'gitlab'
        assert repo['mocked'] is True


# ----------------- Pipelines -----------------
@pytest.fixture(scope='module')
def saved_pipeline(base_url, auth_headers, connected_repo):
    """Save a pipeline (skipping AI gen which is slow). Use minimal YAML."""
    yaml_content = "name: ci\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n"
    r = requests.post(f"{base_url}/api/pipelines",
                      headers=auth_headers,
                      json={
                          'repo_id': connected_repo['id'],
                          'name': 'TEST_pipeline',
                          'target_platform': 'github-actions',
                          'cloud_target': 'aws',
                          'deploy_strategy': 'rolling',
                          'yaml_content': yaml_content,
                          'model': 'claude-sonnet-4-5-20250929',
                          'provider': 'anthropic',
                          'stages': ['checkout', 'install', 'lint', 'test', 'security_scan', 'build', 'deploy', 'rollback'],
                      })
    assert r.status_code == 200, r.text
    return r.json()


def test_save_pipeline(saved_pipeline):
    assert saved_pipeline['id'].startswith('pipe_')
    assert saved_pipeline['target_platform'] == 'github-actions'


def test_get_pipeline(base_url, auth_headers, saved_pipeline):
    r = requests.get(f"{base_url}/api/pipelines/{saved_pipeline['id']}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()['id'] == saved_pipeline['id']


def test_generate_pipeline_sse(base_url, auth_headers, connected_repo):
    """Test SSE streaming endpoint - just verify it streams and content-type"""
    payload = {
        'repo_id': connected_repo['id'],
        'target_platform': 'github-actions',
        'cloud_target': 'aws',
        'deploy_strategy': 'rolling',
        'test_coverage': 80,
        'enable_security': True,
        'enable_monitoring': True,
        'model': 'claude-sonnet-4-5-20250929',
        'provider': 'anthropic',
    }
    with requests.post(f"{base_url}/api/pipelines/generate",
                       headers=auth_headers, json=payload, stream=True, timeout=90) as r:
        assert r.status_code == 200
        assert 'text/event-stream' in r.headers.get('content-type', '')
        got_delta = False
        for line in r.iter_lines(decode_unicode=True):
            if line and line.startswith('data:'):
                payload_str = line[5:].strip()
                try:
                    obj = json.loads(payload_str)
                except Exception:
                    continue
                if 'delta' in obj:
                    got_delta = True
                if obj.get('done') or 'error' in obj:
                    break
        assert got_delta, "No delta events from SSE stream"


# ----------------- Pipeline Runs -----------------
def test_run_pipeline_and_progress(base_url, auth_headers, saved_pipeline):
    r = requests.post(f"{base_url}/api/pipelines/{saved_pipeline['id']}/run", headers=auth_headers)
    assert r.status_code == 200
    run_id = r.json()['run_id']
    assert r.json()['status'] == 'running'

    # Poll for completion (up to 90s since stages have delays)
    final_status = None
    for _ in range(45):
        time.sleep(2)
        rr = requests.get(f"{base_url}/api/runs/{run_id}", headers=auth_headers)
        assert rr.status_code == 200
        run = rr.json()
        if run['status'] in ('success', 'failed'):
            final_status = run['status']
            assert len(run['logs']) > 0
            assert run['finished_at'] is not None
            break
    assert final_status in ('success', 'failed'), f"Run did not finish: status={final_status}"


# ----------------- Deployments -----------------
def test_deployments_and_rollback(base_url, auth_headers, saved_pipeline):
    """Run pipelines until we get a success, then test rollback."""
    success_run = False
    for _ in range(5):
        r = requests.post(f"{base_url}/api/pipelines/{saved_pipeline['id']}/run", headers=auth_headers)
        assert r.status_code == 200
        run_id = r.json()['run_id']
        for _ in range(45):
            time.sleep(2)
            rr = requests.get(f"{base_url}/api/runs/{run_id}", headers=auth_headers)
            run = rr.json()
            if run['status'] in ('success', 'failed'):
                break
        if run['status'] == 'success':
            success_run = True
            break
    if not success_run:
        pytest.skip("Could not get a successful run after 5 attempts")
    # list deployments
    dr = requests.get(f"{base_url}/api/deployments", headers=auth_headers)
    assert dr.status_code == 200
    deps = dr.json()
    live_deps = [d for d in deps if d['status'] == 'live']
    assert len(live_deps) >= 1
    dep_id = live_deps[0]['id']
    # rollback
    rb = requests.post(f"{base_url}/api/deployments/{dep_id}/rollback", headers=auth_headers)
    assert rb.status_code == 200
    # verify
    dr2 = requests.get(f"{base_url}/api/deployments", headers=auth_headers)
    rolled = [d for d in dr2.json() if d['id'] == dep_id][0]
    assert rolled['status'] == 'rolled_back'
    assert rolled['rolled_back'] is True


# ----------------- Security -----------------
def test_security_scan(base_url, auth_headers, connected_repo):
    r = requests.post(f"{base_url}/api/security/scan/{connected_repo['id']}", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data['repo_id'] == connected_repo['id']
    assert data['tool'] == 'snyk+trivy'
    assert len(data['vulnerabilities']) >= 1
    assert 'summary' in data


# ----------------- Dashboard Metrics -----------------
def test_dashboard_metrics(base_url, auth_headers):
    r = requests.get(f"{base_url}/api/metrics/dashboard", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert 'repos' in data
    assert 'pipelines' in data
    assert 'success_rate' in data
    assert 'recent_runs' in data


# ----------------- Audit Logs -----------------
def test_audit_logs(base_url, auth_headers):
    r = requests.get(f"{base_url}/api/audit-logs", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
