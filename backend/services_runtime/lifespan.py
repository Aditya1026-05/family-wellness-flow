import logging
from services_runtime.scheduler.runner import start_scheduler, stop_scheduler

logger = logging.getLogger(__name__)

def runtime_lifespan_startup():
    logger.info("Services runtime lifespan startup hook called.")
    start_scheduler()

def runtime_lifespan_shutdown():
    logger.info("Services runtime lifespan shutdown hook called.")
    stop_scheduler()
