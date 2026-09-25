from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.families import router as families_router
from app.api.v1.parents import router as parents_router
from app.api.v1.invites import router as invites_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.task_instances import router as task_instances_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.alerts import router as alerts_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(families_router)
api_router.include_router(parents_router)
api_router.include_router(invites_router)
api_router.include_router(tasks_router)
api_router.include_router(task_instances_router)
api_router.include_router(notifications_router)
api_router.include_router(alerts_router)
