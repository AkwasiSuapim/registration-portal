from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import applications, auth, clearances, documents, health, officials, students

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for the Livingstone College Student Registration Portal.",
    version="0.1.0",
)

# Allow the Vite dev server (and any other configured origins) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(applications.router)
app.include_router(students.router)
app.include_router(officials.router)
app.include_router(clearances.router)
app.include_router(documents.router)
