import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ai-pipeline-forge.preview.emergentagent.com').rstrip('/')

TEST_EMAIL = 'forge_test@example.com'
TEST_PASSWORD = 'forgepass123'
TEST_NAME = 'Forge Test'


@pytest.fixture(scope='session')
def base_url():
    return BASE_URL


@pytest.fixture(scope='session')
def api_client():
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    return s


@pytest.fixture(scope='session')
def auth_token(api_client):
    # Try login first
    r = api_client.post(f"{BASE_URL}/api/auth/login",
                        json={'email': TEST_EMAIL, 'password': TEST_PASSWORD})
    if r.status_code != 200:
        # Register
        r = api_client.post(f"{BASE_URL}/api/auth/register",
                            json={'email': TEST_EMAIL, 'password': TEST_PASSWORD, 'name': TEST_NAME})
        if r.status_code not in (200, 201):
            # try login again - perhaps it exists now
            r = api_client.post(f"{BASE_URL}/api/auth/login",
                                json={'email': TEST_EMAIL, 'password': TEST_PASSWORD})
            if r.status_code != 200:
                pytest.skip(f"Cannot authenticate test user: {r.status_code} {r.text}")
    return r.json()['token']


@pytest.fixture(scope='session')
def auth_headers(auth_token):
    return {'Authorization': f'Bearer {auth_token}', 'Content-Type': 'application/json'}
