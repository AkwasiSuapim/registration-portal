from app.core.config import settings


def test_app_name_is_set():
    assert settings.APP_NAME
    assert isinstance(settings.APP_NAME, str)


def test_database_url_is_set():
    # Confirm the setting exists and looks like a database URL.
    # We do not log or assert the full value to avoid leaking credentials.
    assert settings.DATABASE_URL
    assert "postgresql" in settings.DATABASE_URL


def test_jwt_secret_is_set():
    assert settings.JWT_SECRET_KEY
    assert isinstance(settings.JWT_SECRET_KEY, str)


def test_jwt_algorithm_is_set():
    assert settings.JWT_ALGORITHM
    assert settings.JWT_ALGORITHM == "HS256"


def test_cors_origins_is_a_list():
    assert isinstance(settings.CORS_ORIGINS, list)
    assert len(settings.CORS_ORIGINS) > 0


def test_upload_dir_is_set():
    assert settings.UPLOAD_DIR
    assert isinstance(settings.UPLOAD_DIR, str)
