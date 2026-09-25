import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.db.session import SessionLocal
from services_runtime.config import runtime_config
from services_runtime.scheduler.poller import poll_and_dispatch_reminders
from services_runtime.escalations.engine import evaluate_and_escalate_overdue_tasks

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

async def run_reminder_scan():
    with SessionLocal() as db:
        try:
            await poll_and_dispatch_reminders(db)
        except Exception as e:
            logger.error(f"Error during reminder scan job: {e}", exc_info=True)

async def run_escalation_scan():
    with SessionLocal() as db:
        try:
            await evaluate_and_escalate_overdue_tasks(db)
        except Exception as e:
            logger.error(f"Error during escalation scan job: {e}", exc_info=True)

def configure_scheduler() -> AsyncIOScheduler:
    interval = runtime_config.POLL_INTERVAL_SECONDS

    scheduler.add_job(
        run_reminder_scan,
        "interval",
        seconds=interval,
        id="carecircle_reminders_poller",
        replace_existing=True,
    )
    scheduler.add_job(
        run_escalation_scan,
        "interval",
        seconds=interval,
        id="carecircle_escalation_poller",
        replace_existing=True,
    )
    logger.info(f"Configured APScheduler with {interval}s interval for reminders & escalations.")
    return scheduler

def start_scheduler():
    if not scheduler.running:
        configure_scheduler()
        scheduler.start()
        logger.info("APScheduler background runner started.")

def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler background runner stopped.")
