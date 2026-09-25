from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.api import api_router
from app.db.session import SessionLocal
from app.db.seed import seed_initial_data

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed initial demo data if database is fresh
    try:
        with SessionLocal() as db:
            seed_initial_data(db)
    except Exception as e:
        print(f"Startup seed notice: {e}")

    # Start the background reminder & escalation poller scheduler
    try:
        from services_runtime.scheduler.runner import start_scheduler, stop_scheduler
        start_scheduler()
    except Exception as e:
        print(f"Startup scheduler notice: {e}")

    yield

    try:
        from services_runtime.scheduler.runner import stop_scheduler
        stop_scheduler()
    except Exception:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="CareCircle Backend API for Family Care Coordination",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Setup CORS to allow localhost and local network Wi-Fi devices (phones/tablets)
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "app": settings.PROJECT_NAME}
