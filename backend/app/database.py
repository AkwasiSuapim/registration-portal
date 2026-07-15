from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings


# Base is the parent class that all SQLAlchemy models inherit from.
# When a model inherits from Base, SQLAlchemy registers its table
# in Base.metadata, which Alembic uses to generate migrations.
class Base(DeclarativeBase):
    pass


# The engine is the connection to the database.
# SQLAlchemy uses the DATABASE_URL from settings to know which database to talk to.
engine = create_engine(settings.DATABASE_URL)

# SessionLocal is a factory that creates new database sessions.
# Each request gets its own session (see get_db below).
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    FastAPI dependency that opens a database session for a request
    and automatically closes it when the request is done.

    Usage in a route:
        from sqlalchemy.orm import Session
        from fastapi import Depends
        from app.database import get_db

        def my_route(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
