from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    APP_NAME: str = "Student Registration Portal API"
    ENVIRONMENT: str = "development"

    # PostgreSQL connection string — set this in .env before Phase 2
    DATABASE_URL: str = (
        "postgresql+psycopg://postgres:postgres@localhost:5432/student_registration_portal"
    )

    # JWT — always override this value in .env, never use the default in production
    JWT_SECRET_KEY: str = "change-this-secret-in-development"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Allowed frontend origins for CORS
    # In .env use JSON array format: CORS_ORIGINS=["http://localhost:5173"]
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # Directory where uploaded files are stored (relative to the backend folder)
    UPLOAD_DIR: str = "uploads"

    # Maximum allowed upload size in megabytes
    MAX_UPLOAD_SIZE_MB: int = 10


# Single shared instance — import `settings` everywhere instead of re-instantiating.
settings = Settings()
