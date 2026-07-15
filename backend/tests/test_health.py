EXPECTED_BODY = {
    "status": "ok",
    "service": "Student Registration Portal API",
}


def test_health_returns_200(client):
    response = client.get("/health")
    assert response.status_code == 200


def test_health_returns_correct_body(client):
    response = client.get("/health")
    assert response.json() == EXPECTED_BODY


def test_api_health_returns_200(client):
    response = client.get("/api/health")
    assert response.status_code == 200


def test_api_health_returns_correct_body(client):
    response = client.get("/api/health")
    assert response.json() == EXPECTED_BODY
