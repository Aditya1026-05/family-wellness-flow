import asyncio
import argparse
import logging
import signal
import sys
import uuid

from app.db.session import SessionLocal
from services_runtime.scheduler.runner import start_scheduler, stop_scheduler
from services_runtime.scheduler.poller import poll_and_dispatch_reminders
from services_runtime.escalations.engine import evaluate_and_escalate_overdue_tasks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("services_runtime.worker")

async def run_standalone_daemon():
    logger.info("Initializing CareCircle Services Runtime Daemon...")
    start_scheduler()

    stop_event = asyncio.Event()

    def handle_signal(sig, frame):
        logger.info(f"Received exit signal {sig}. Initiating graceful shutdown...")
        stop_event.set()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    logger.info("Services Runtime Daemon running. Press Ctrl+C to terminate.")
    await stop_event.wait()

    logger.info("Stopping scheduler jobs...")
    stop_scheduler()
    logger.info("Services Runtime Daemon stopped cleanly.")

async def execute_cli_commands(args):
    with SessionLocal() as db:
        if args.test_reminder:
            try:
                inst_id = uuid.UUID(args.test_reminder)
                logger.info(f"Triggering test reminder for task instance {inst_id}...")
                dispatched = await poll_and_dispatch_reminders(db, force_instance_id=inst_id)
                logger.info(f"Dispatched instances: {dispatched}")
            except Exception as e:
                logger.error(f"Test reminder failed: {e}", exc_info=True)
            return

        if args.test_escalation:
            try:
                inst_id = uuid.UUID(args.test_escalation)
                logger.info(f"Triggering test escalation for task instance {inst_id}...")
                escalated = await evaluate_and_escalate_overdue_tasks(db, force_instance_id=inst_id)
                logger.info(f"Escalated instances: {escalated}")
            except Exception as e:
                logger.error(f"Test escalation failed: {e}", exc_info=True)
            return

        if args.once:
            logger.info("Running single iteration of reminder and escalation checks...")
            r = await poll_and_dispatch_reminders(db)
            e = await evaluate_and_escalate_overdue_tasks(db)
            logger.info(f"Single run complete: {len(r)} reminders, {len(e)} escalations.")
            return

        await run_standalone_daemon()

def main():
    parser = argparse.ArgumentParser(description="CareCircle Background Services Runtime Worker")
    parser.add_argument("--test-reminder", type=str, help="UUID of task instance to force reminder dispatch for")
    parser.add_argument("--test-escalation", type=str, help="UUID of task instance to force escalation evaluation for")
    parser.add_argument("--once", action="store_true", help="Run one scan iteration and exit")
    args = parser.parse_args()

    asyncio.run(execute_cli_commands(args))

if __name__ == "__main__":
    main()
