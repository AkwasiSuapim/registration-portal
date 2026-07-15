import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """
    A reusable test client for the FastAPI app.

    Every test that needs to make HTTP requests can ask for this fixture:

        def test_something(client):
            response = client.get("/health")
            ...

    The TestClient works like a real HTTP client but runs requests directly
    against the app in memory — no server needs to be running.
    """
    with TestClient(app) as test_client:
        yield test_client
