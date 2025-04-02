import os
from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger("news_catcher.worker")

# Set Redis URL from environment variable or use default
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Create Celery app
celery_app = Celery(
    "news_catcher",
    broker=REDIS_URL,
    backend=REDIS_URL
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# Define periodic tasks
celery_app.conf.beat_schedule = {
    # Run scraper every 3 hours
    'scrape-every-3-hours': {
        'task': 'app.worker.scrape_news_task',
        'schedule': crontab(minute=0, hour='*/3'),
    },
    # Run a daily full scrape at midnight
    'daily-full-scrape': {
        'task': 'app.worker.scrape_news_task',
        'schedule': crontab(minute=0, hour=0),
        'kwargs': {'full_scrape': True}
    }
}

@celery_app.task(name="app.worker.scrape_news_task")
def scrape_news_task(full_scrape=False):
    """
    Task to scrape news from all active sources
    
    Args:
        full_scrape: If True, scrape all available content regardless of age
    """
    try:
        # We need to import here to avoid circular imports
        from sqlalchemy.orm import Session
        from .database import SessionLocal
        from .models import ScrapeLog
        from .services.news_scraper import NewsScraper
        from .services.ai_processor import AIProcessor
        from .services.geolocation import Geolocator
        import asyncio
        
        logger.info(f"Starting scheduled news scrape task (full_scrape={full_scrape})")
        
        # Create database session
        db = SessionLocal()
        
        try:
            # Create a new scrape log
            scrape_log = ScrapeLog(status="started")
            db.add(scrape_log)
            db.commit()
            db.refresh(scrape_log)
            
            # Initialize services
            ai_processor = AIProcessor()
            geolocator = Geolocator()
            news_scraper = NewsScraper(ai_processor, geolocator)
            
            # Run the scraper (need to handle async in a sync context)
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(news_scraper.run_scrape(scrape_log.id, db))
            
            logger.info(f"Scheduled news scrape task completed (log_id={scrape_log.id})")
            return f"Scrape completed with log ID: {scrape_log.id}"
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error in scheduled news scrape task: {str(e)}")
        return f"Scrape failed: {str(e)}"

if __name__ == "__main__":
    celery_app.start()
