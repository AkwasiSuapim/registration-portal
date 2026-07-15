from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Load application settings so we can read DATABASE_URL from .env
from app.core.config import settings

# Import Base — this is where SQLAlchemy keeps the list of all tables
from app.database import Base

# Import all models so their tables are registered in Base.metadata.
# Without this import, Alembic would see an empty schema and generate
# a migration that does nothing.
import app.models  # noqa: F401

# Alembic config object — provides access to alembic.ini values
config = context.config

# Override the database URL with the value from our .env file.
# This way we never have to put credentials into alembic.ini.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Set up Python logging from alembic.ini if a config file exists
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Tell Alembic which tables to compare against when generating migrations
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations without a live database connection.
    Alembic writes the SQL to stdout or a file instead of executing it.
    Useful for reviewing what will be run before touching the database.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations with a live database connection.
    This is the normal mode when you run: alembic upgrade head
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
