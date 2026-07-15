from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "Student Registration Portal API",
    }


# Same response available under the /api prefix for frontend convenience.
@router.get("/api/health")
def api_health_check():
    return {
        "status": "ok",
        "service": "Student Registration Portal API",
    }
