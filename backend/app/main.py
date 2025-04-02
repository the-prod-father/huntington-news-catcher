from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime
import pandas as pd
import io
import os
import logging
from sqlalchemy.orm import Session

from .database import get_db, engine, Base
from .models import NewsItem, DataSource, ScrapeLog
from .schemas import (
    NewsItemCreate, NewsItemResponse, DataSourceCreate, 
    DataSourceResponse, ScrapeLogResponse, LocationSearch
)
from .services.news_scraper import NewsScraper
from .services.ai_processor import AIProcessor
from .services.geolocation import Geolocator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("news_catcher")

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="News Catcher API",
    description="API for the News Catcher application",
    version="1.0.0"
)

# Add CORS middleware to allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "http://localhost:3000", "http://127.0.0.1:3000", "http://frontend:3000"],  # Include explicit origins 
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=86400,  # Cache preflight requests for 24 hours
)

# Initialize services
ai_processor = AIProcessor()
geolocator = Geolocator()
news_scraper = NewsScraper(ai_processor, geolocator)

# Comprehensive health check endpoint
@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        # Test database connection
        db_status = "connected"
        db_version = "unknown"
        try:
            # Try to get the database version
            result = db.execute("SELECT version();").scalar()
            if result:
                db_version = result.split(",")[0]
        except Exception as e:
            db_status = f"error: {str(e)}"
        
        # Get service availability status
        services = {
            "database": db_status,
            "geolocation": "available" if geolocator is not None else "unavailable",
            "ai_processor": "available" if ai_processor is not None else "unavailable",
        }
        
        # Return comprehensive health information
        return {
            "status": "healthy",
            "version": "1.0.0",
            "timestamp": datetime.now().isoformat(),
            "services": services,
            "db_version": db_version,
            "environment": os.environ.get("ENVIRONMENT", "development")
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }

# News items endpoints
@app.get("/news", response_model=List[NewsItemResponse])
def get_news_items(
    category: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: Optional[float] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """Get news items with optional filtering"""
    query = db.query(NewsItem)
    
    if category:
        query = query.filter(NewsItem.category == category)
    
    if start_date:
        query = query.filter(NewsItem.date_time >= start_date)
        
    if end_date:
        query = query.filter(NewsItem.date_time <= end_date)
    
    # If lat, lng, and radius are provided, filter by distance
    if lat is not None and lng is not None and radius is not None:
        # Using PostGIS ST_DWithin for efficient distance queries
        point = f"SRID=4326;POINT({lng} {lat})"
        query = query.filter(
            NewsItem.geom.ST_DWithin(point, radius / 111320)  # Convert to degrees (approx)
        )
    
    return query.all()

@app.post("/news", response_model=NewsItemResponse)
def create_news_item(item: NewsItemCreate, db: Session = Depends(get_db)):
    """Create a new news item"""
    db_item = NewsItem(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.get("/news/search", response_model=List[NewsItemResponse])
def search_location(
    location: str,
    category: Optional[str] = None,
    radius: Optional[float] = 10.0,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """Search for news items near a location using query parameters"""
    logger.info(f"Searching for news near location: {location}")
    
    # Get coordinates for the location
    coordinates = geolocator.geocode(location)
    if not coordinates:
        logger.warning(f"Location not found: {location}")
        raise HTTPException(status_code=404, detail="Location not found")
    
    lat, lng = coordinates
    logger.info(f"Geocoded location {location} to coordinates: {lat}, {lng}")
    
    # Query database for items within radius
    results = get_news_items(
        category=category,
        lat=lat,
        lng=lng,
        radius=radius,  # Default 10km radius
        start_date=start_date,
        end_date=end_date,
        db=db
    )
    
    logger.info(f"Found {len(results)} news items near {location}")
    return results

@app.post("/news/search", response_model=List[NewsItemResponse])
def search_location_post(query: LocationSearch, db: Session = Depends(get_db)):
    """Search for news items near a location using POST body"""
    return search_location(
        location=query.location,
        category=query.category,
        radius=query.radius,
        start_date=query.start_date,
        end_date=query.end_date,
        db=db
    )

# Data source endpoints
@app.get("/sources", response_model=List[DataSourceResponse])
def get_data_sources(
    category: Optional[str] = None, 
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    """Get all data sources with optional filtering"""
    query = db.query(DataSource)
    
    if category:
        query = query.filter(DataSource.category == category)
        
    if active_only:
        query = query.filter(DataSource.is_active == True)
        
    return query.all()

@app.post("/sources", response_model=DataSourceResponse)
def create_data_source(source: DataSourceCreate, db: Session = Depends(get_db)):
    """Create a new data source"""
    db_source = DataSource(**source.dict())
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source

@app.put("/sources/{source_id}/toggle", response_model=DataSourceResponse)
def toggle_data_source(source_id: int, db: Session = Depends(get_db)):
    """Toggle a data source active status"""
    db_source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not db_source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    db_source.is_active = not db_source.is_active
    db.commit()
    db.refresh(db_source)
    return db_source

@app.post("/sources/import")
async def import_data_sources(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Import data sources from CSV file"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    try:
        content = await file.read()
        df = pd.read_csv(io.StringIO(content.decode('utf-8')))
        
        expected_columns = ["Source_Name", "URL", "Category"]
        if not all(col in df.columns for col in expected_columns):
            raise HTTPException(
                status_code=400, 
                detail=f"CSV must contain columns: {', '.join(expected_columns)}"
            )
        
        # Process and add sources
        added = 0
        skipped = 0
        
        for _, row in df.iterrows():
            # Check if source already exists
            existing = db.query(DataSource).filter(DataSource.url == row["URL"]).first()
            if existing:
                skipped += 1
                continue
                
            # Create new source
            new_source = DataSource(
                source_name=row["Source_Name"],
                url=row["URL"],
                category=row["Category"],
                is_active=True
            )
            db.add(new_source)
            added += 1
            
        db.commit()
        return {"message": f"Imported {added} sources, skipped {skipped} duplicates"}
        
    except Exception as e:
        logger.error(f"Error importing data sources: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error importing data: {str(e)}")

# Scraper endpoints
@app.post("/scrape", response_model=ScrapeLogResponse)
def trigger_scrape(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Trigger news scraping job"""
    # Create a new scrape log
    scrape_log = ScrapeLog(status="started")
    db.add(scrape_log)
    db.commit()
    db.refresh(scrape_log)
    
    # Run scraping in the background
    background_tasks.add_task(news_scraper.run_scrape, scrape_log.id, db)
    
    return scrape_log

@app.get("/logs", response_model=List[ScrapeLogResponse])
def get_scrape_logs(limit: int = 20, db: Session = Depends(get_db)):
    """Get recent scrape logs"""
    return db.query(ScrapeLog).order_by(ScrapeLog.start_time.desc()).limit(limit).all()

# Export endpoint
@app.get("/export")
def export_news_items(
    category: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """Export news items as CSV"""
    query = db.query(NewsItem)
    
    if category:
        query = query.filter(NewsItem.category == category)
    
    if start_date:
        query = query.filter(NewsItem.date_time >= start_date)
        
    if end_date:
        query = query.filter(NewsItem.date_time <= end_date)
        
    items = query.all()
    
    # Convert to DataFrame
    data = []
    for item in items:
        data.append({
            "Date_Time": item.date_time,
            "Title": item.title,
            "Headline": item.headline,
            "Description": item.description,
            "Summary": item.summary,
            "Category": item.category,
            "Location": f"{item.latitude}, {item.longitude}",
            "Latitude": item.latitude,
            "Longitude": item.longitude,
            "Source_URL": item.source_url,
            "Confidence_Score": item.confidence_score
        })
    
    df = pd.DataFrame(data)
    
    # Return CSV as string
    output = io.StringIO()
    df.to_csv(output, index=False)
    
    return {"csv": output.getvalue()}

# NewsAPI endpoint for any location
@app.get("/newsapi/{location}", response_model=List[NewsItemResponse])
async def get_newsapi_news(location: str, db: Session = Depends(get_db)):
    """Get news from NewsAPI.org for a specific location"""
    # Create an instance of the scraper with required services
    news_scraper = NewsScraper(ai_processor, geolocator)
    
    # Add a method to fetch and process NewsAPI content
    news_items = await news_scraper.fetch_from_newsapi(location, db)
    
    return news_items

# RSS Feed endpoint for any location
@app.get("/rss-news/{location}", response_model=List[NewsItemResponse])
async def get_rss_news(location: str, db: Session = Depends(get_db)):
    """Get news from RSS feeds (Patch, Newsday, Google News) for a specific location"""
    # Create an instance of the scraper with required services
    news_scraper = NewsScraper(ai_processor, geolocator)
    
    # Fetch and process RSS feed content
    news_items = await news_scraper.fetch_from_rss_feeds(location, db)
    
    return news_items

# Comprehensive Huntington news endpoint (combines all sources)
@app.get("/huntington-news/comprehensive", response_model=List[NewsItemResponse])
async def get_comprehensive_huntington_news(db: Session = Depends(get_db)):
    """Get comprehensive news for Huntington, NY from all sources including RSS feeds and NewsAPI"""
    # Create an instance of the scraper with required services
    news_scraper = NewsScraper(ai_processor, geolocator)
    
    # Fetch comprehensive Huntington news from all sources
    news_items = await news_scraper.fetch_huntington_news(db)
    
    return news_items

# Dedicated Huntington, Long Island news endpoint
@app.get("/huntington-news", response_model=List[NewsItemResponse])
async def get_huntington_news(db: Session = Depends(get_db)):
    """Get hyperlocal news specifically for Huntington, Long Island"""
    logger.info("Retrieving Huntington news from database and comprehensive sources")
    
    # First, try to get news items from the database
    news_items = db.query(NewsItem).all()
    
    # If we don't have at least 5 items, fetch comprehensive news
    if not news_items or len(news_items) < 5:
        logger.info(f"Only found {len(news_items) if news_items else 0} items in database. Fetching comprehensive news...")
        # Create an instance of the scraper with required services
        news_scraper = NewsScraper(ai_processor, geolocator)
        
        # Use the comprehensive method that combines all sources
        news_items = await news_scraper.fetch_huntington_news(db)
    else:
        logger.info(f"Found {len(news_items)} news items in database. Using existing data.")
    
    return news_items

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
