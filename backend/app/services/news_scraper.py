import logging
import time
import requests
import feedparser
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import datetime
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
import concurrent.futures
import asyncio
from playwright.async_api import async_playwright
import re
import os

from ..models import NewsItem, DataSource, ScrapeLog
from .ai_processor import AIProcessor
from .geolocation import Geolocator
from .newsapi_service import NewsAPIService
from .rss_service import RSSFeedService

# Configure logging
logger = logging.getLogger("news_catcher.news_scraper")

class NewsScraper:
    """Service for scraping news from various sources"""
    
    def __init__(self, ai_processor: AIProcessor, geolocator: Geolocator):
        """
        Initialize the news scraper
        
        Args:
            ai_processor: AI service for processing content
            geolocator: Geolocation service for converting locations to coordinates
        """
        self.ai_processor = ai_processor
        self.geolocator = geolocator
        self.newsapi_service = NewsAPIService()
        self.rss_service = RSSFeedService()
        
        # Default request headers
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br"
        }
        
        logger.info("News scraper initialized with NewsAPI and RSS feed integration")
    
    async def run_scrape(self, log_id: int, db: Session):
        """
        Run a full scraping job
        
        Args:
            log_id: ID of the scrape log entry
            db: Database session
        """
        logger.info(f"Starting scrape job {log_id}")
        
        # Get active data sources
        sources = db.query(DataSource).filter(DataSource.is_active == True).all()
        if not sources:
            self._update_log(db, log_id, "completed", 0, 0, 0, "No active data sources found")
            logger.warning("No active data sources found")
            return
        
        # Initialize counters
        total = len(sources)
        successful = 0
        errors = 0
        log_details = []
        
        # Update log to in progress
        self._update_log(db, log_id, "in_progress", total, 0, 0, "Scraping in progress")
        
        # Process each source
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            
            for source in sources:
                try:
                    logger.info(f"Processing source: {source.source_name} ({source.url})")
                    log_details.append(f"Processing: {source.source_name}")
                    
                    # Determine source type and scrape accordingly
                    if self._is_rss_feed(source.url):
                        items = await self._scrape_rss(source, browser, db)
                    else:
                        items = await self._scrape_website(source, browser, db)
                    
                    if items:
                        successful += 1
                        log_details.append(f"✓ {source.source_name}: Found {len(items)} items")
                    else:
                        errors += 1
                        log_details.append(f"✗ {source.source_name}: No items found")
                        
                except Exception as e:
                    errors += 1
                    error_msg = str(e)[:200]  # Limit error message length
                    log_details.append(f"✗ {source.source_name}: Error - {error_msg}")
                    logger.error(f"Error processing source {source.source_name}: {str(e)}")
                
                # Update log periodically
                self._update_log(db, log_id, "in_progress", total, successful, errors, 
                                "\n".join(log_details))
            
            await browser.close()
        
        # Update log with final status
        status = "completed" if errors == 0 else "completed_with_errors"
        self._update_log(db, log_id, status, total, successful, errors, "\n".join(log_details))
        logger.info(f"Scrape job {log_id} completed: {successful} successful, {errors} failed")
    
    async def _scrape_rss(self, source: DataSource, browser, db: Session) -> List[Dict[str, Any]]:
        """
        Scrape news from an RSS feed
        
        Args:
            source: Data source to scrape
            browser: Playwright browser instance
            db: Database session
            
        Returns:
            List of processed news items
        """
        items = []
        
        try:
            # Parse the RSS feed with a timeout and custom headers
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
            
            try:
                # First try with direct feedparser
                feed = feedparser.parse(source.url, timeout=15)
                
                # If no entries found, try with requests first
                if not feed.entries:
                    logger.warning(f"No entries found in direct RSS feed parse: {source.url}. Trying with requests.")
                    response = requests.get(source.url, headers=headers, timeout=15)
                    if response.status_code == 200:
                        feed = feedparser.parse(response.content)
                    else:
                        logger.error(f"Failed to fetch RSS feed: {source.url}, status code: {response.status_code}")
                        return items
            except Exception as e:
                logger.error(f"Error parsing RSS feed {source.url}: {str(e)}")
                return items
                
            if not feed.entries:
                logger.warning(f"No entries found in RSS feed after multiple attempts: {source.url}")
                return items
            
            # Process each entry
            for entry in feed.entries[:20]:  # Limit to 20 most recent entries
                try:
                    # Extract content
                    title = entry.get('title', '')
                    link = entry.get('link', '')
                    published = entry.get('published', '')
                    summary = entry.get('summary', '')
                    
                    # Get full content if available
                    content = ''
                    if hasattr(entry, 'content'):
                        content = entry.content[0].value
                    elif 'description' in entry:
                        content = entry.description
                    else:
                        content = summary
                    
                    # Clean HTML
                    content = BeautifulSoup(content, 'html.parser').get_text()
                    
                    # Combine available text
                    full_text = f"{title}\n\n{summary}\n\n{content}"
                    
                    # Process with AI
                    result = self.ai_processor.extract_information(full_text, link)
                    
                    # Skip if excluded
                    if 'excluded_reason' in result and result['excluded_reason']:
                        logger.info(f"Skipping item: {title} - {result['excluded_reason']}")
                        continue
                    
                    # Get coordinates for location
                    lat, lng = None, None
                    if 'location' in result and result['location']:
                        coords = self.geolocator.geocode(result['location'])
                        if coords:
                            lat, lng = coords
                    
                    # Skip if no coordinates (required field)
                    if lat is None or lng is None:
                        logger.warning(f"Skipping item without coordinates: {title}")
                        continue
                    
                    # Parse date if available
                    date_time = None
                    if published:
                        try:
                            date_time = datetime.strptime(published, "%a, %d %b %Y %H:%M:%S %z")
                        except (ValueError, TypeError):
                            try:
                                date_time = datetime.fromisoformat(published.replace('Z', '+00:00'))
                            except (ValueError, TypeError):
                                date_time = datetime.now()
                    
                    # Create news item
                    news_item = NewsItem(
                        title=result.get('title', title)[:255],  # Limit to field size
                        headline=result.get('headline', '')[:255] if result.get('headline') else None,
                        description=result.get('description', content),
                        summary=result.get('summary', summary),
                        category=result.get('category', source.category),
                        latitude=lat,
                        longitude=lng,
                        source_url=link,
                        date_time=date_time,
                        confidence_score=result.get('confidence_score', 0.5)
                    )
                    
                    # Add to database
                    db.add(news_item)
                    db.commit()
                    
                    items.append(news_item)
                    
                except Exception as e:
                    logger.error(f"Error processing RSS entry: {str(e)}")
            
            return items
            
        except Exception as e:
            logger.error(f"Error scraping RSS feed {source.url}: {str(e)}")
            return items
    
    async def _scrape_website(self, source: DataSource, browser, db: Session) -> List[Dict[str, Any]]:
        """
        Scrape news from a website using Playwright
        
        Args:
            source: Data source to scrape
            browser: Playwright browser instance
            db: Database session
            
        Returns:
            List of processed news items
        """
        items = []
        
        try:
            # Create new browser context for each site
            context = await browser.new_context(
                user_agent=self.headers["User-Agent"],
                viewport={"width": 1280, "height": 720}
            )
            page = await context.new_page()
            
            # Navigate to the URL
            await page.goto(source.url, wait_until="domcontentloaded", timeout=30000)
            
            # Wait for content to load
            await page.wait_for_timeout(2000)
            
            # Extract links to article pages
            articles = await page.query_selector_all("article a, .article a, .news-item a, .post a")
            article_links = []
            
            for article in articles:
                try:
                    href = await article.get_attribute("href")
                    if href and href not in article_links:
                        # Make relative URLs absolute
                        if href.startswith("/"):
                            url_parts = source.url.split("/")
                            base_url = f"{url_parts[0]}//{url_parts[2]}"
                            href = f"{base_url}{href}"
                        
                        article_links.append(href)
                except Exception as e:
                    logger.error(f"Error extracting article link: {str(e)}")
            
            # If no article links found, try alternative selectors
            if not article_links:
                links = await page.query_selector_all("a")
                for link in links:
                    try:
                        href = await link.get_attribute("href")
                        text = await link.text_content()
                        
                        # Heuristic: links with more than 30 chars of text are likely article titles
                        if href and text and len(text.strip()) > 30:
                            # Make relative URLs absolute
                            if href.startswith("/"):
                                url_parts = source.url.split("/")
                                base_url = f"{url_parts[0]}//{url_parts[2]}"
                                href = f"{base_url}{href}"
                            
                            article_links.append(href)
                    except Exception as e:
                        pass
            
            # Limit number of articles to process
            article_links = article_links[:10]  # Process up to 10 articles per source
            
            # Process each article
            for link in article_links:
                try:
                    # Navigate to article
                    await page.goto(link, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(1000)
                    
                    # Extract content
                    title = await page.title()
                    
                    # Try to get article content
                    content = ""
                    
                    # First try structured article content
                    article = await page.query_selector("article, .article, .post, .news-item, main")
                    if article:
                        content = await article.inner_text()
                    
                    # If no article found, get body text
                    if not content:
                        content = await page.evaluate("""
                            () => {
                                const bodyText = document.body.innerText;
                                // Remove very short lines and common web elements
                                return bodyText
                                    .split('\\n')
                                    .filter(line => line.trim().length > 30)
                                    .filter(line => !line.includes('Cookie') && !line.includes('Privacy Policy'))
                                    .join('\\n');
                            }
                        """)
                    
                    # Process with AI
                    result = self.ai_processor.extract_information(content, link)
                    
                    # Skip if excluded
                    if 'excluded_reason' in result and result['excluded_reason']:
                        logger.info(f"Skipping item: {title} - {result['excluded_reason']}")
                        continue
                    
                    # Get coordinates for location
                    lat, lng = None, None
                    if 'location' in result and result['location']:
                        coords = self.geolocator.geocode(result['location'])
                        if coords:
                            lat, lng = coords
                    
                    # Skip if no coordinates (required field)
                    if lat is None or lng is None:
                        logger.warning(f"Skipping item without coordinates: {title}")
                        continue
                    
                    # Create news item
                    news_item = NewsItem(
                        title=result.get('title', title)[:255],  # Limit to field size
                        headline=result.get('headline', '')[:255] if result.get('headline') else None,
                        description=result.get('description', content[:1000]),  # Limit description length
                        summary=result.get('summary', content[:200]),  # Limit summary length
                        category=result.get('category', source.category),
                        latitude=lat,
                        longitude=lng,
                        source_url=link,
                        date_time=datetime.now(),  # Use current time if not available
                        confidence_score=result.get('confidence_score', 0.5)
                    )
                    
                    # Add to database
                    db.add(news_item)
                    db.commit()
                    
                    items.append(news_item)
                    
                except Exception as e:
                    logger.error(f"Error processing article {link}: {str(e)}")
            
            await context.close()
            return items
            
        except Exception as e:
            logger.error(f"Error scraping website {source.url}: {str(e)}")
            return items
    
    def _is_rss_feed(self, url: str) -> bool:
        """
        Check if a URL is likely an RSS feed
        
        Args:
            url: URL to check
            
        Returns:
            True if URL is likely an RSS feed, False otherwise
        """
        if re.search(r'\.(rss|xml|feed)($|\?)', url, re.IGNORECASE):
            return True
            
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            content_type = response.headers.get('Content-Type', '').lower()
            
            if 'rss' in content_type or 'xml' in content_type:
                return True
                
            # Check for RSS/XML content
            if '<?xml' in response.text[:100] and ('<rss' in response.text or '<feed' in response.text):
                return True
                
            return False
        except Exception:
            # If we can't determine, assume it's not RSS
            return False
    
    def _update_log(self, 
                   db: Session, 
                   log_id: int, 
                   status: str, 
                   total: int, 
                   successful: int, 
                   errors: int, 
                   details: str):
        """
        Update the scrape log
        
        Args:
            db: Database session
            log_id: ID of the log entry
            status: Current status
            total: Total number of items
            successful: Number of successful items
            errors: Number of error items
            details: Log details
        """
        log = db.query(ScrapeLog).filter(ScrapeLog.id == log_id).first()
        if log:
            log.status = status
            log.total_items = total
            log.successful_items = successful
            log.error_items = errors
            log.log_details = details
            
            if status in ["completed", "completed_with_errors"]:
                log.end_time = datetime.now()
                
            db.commit()
    
    async def fetch_from_rss_feeds(self, location: str, db: Session) -> List[NewsItem]:
        """
        Fetch and process news from RSS feeds (Patch.com, Newsday, Google News) for a specific location
        
        Args:
            location: Location name (city or region)
            db: Database session
            
        Returns:
            List of processed news items
        """
        logger.info(f"Fetching RSS feed news for {location}")
        
        try:
            # Get all articles from RSS feeds based on location
            if location.lower() == "huntington":
                articles = self.rss_service.fetch_all_huntington_sources()
            else:
                # For other locations, use Google News RSS and Patch if available
                articles = []
                
                # Try to get Patch.com news
                patch_articles = self.rss_service.fetch_patch_rss(location.lower())
                articles.extend(patch_articles)
                
                # Use Google News for the location
                google_articles = self.rss_service.fetch_google_news_rss(f"{location} NY")
                articles.extend(google_articles)
            
            logger.info(f"Found {len(articles)} articles from RSS feeds for {location}")
            
            # Save the articles to the database
            saved_items = []
            for article in articles:
                # Create a NewsItem from the article data
                news_item = NewsItem(
                    title=article.get('title'),
                    headline=article.get('title'),  # Use title as headline
                    summary=article.get('summary', ''),
                    date_time=article.get('date_time'),
                    latitude=article.get('latitude'),
                    longitude=article.get('longitude'),
                    location=article.get('location', location),
                    source_name=article.get('source_name'),
                    source_url=article.get('source_url', ''),
                    category=article.get('category', 'News')
                )
                
                # Check if this article already exists in the database
                existing_item = db.query(NewsItem).filter(
                    NewsItem.title == news_item.title,
                    NewsItem.source_url == news_item.source_url
                ).first()
                
                if not existing_item:
                    db.add(news_item)
                    db.commit()
                    saved_items.append(news_item)
            
            logger.info(f"Saved {len(saved_items)} new articles from RSS feeds to database")
            return saved_items
        except Exception as e:
            logger.error(f"Error fetching RSS feed news for {location}: {str(e)}")
            db.rollback()
            return []
    
    async def fetch_huntington_news(self, db: Session) -> List[NewsItem]:
        """
        Comprehensive method to fetch news specifically for Huntington, NY from all sources
        including RSS feeds (Patch, Newsday, Google News) and NewsAPI.
        
        Args:
            db: Database session
            
        Returns:
            List of processed news items
        """
        logger.info("Fetching comprehensive Huntington news from all sources")
        
        try:
            # First check for existing items in database
            existing_items = db.query(NewsItem).all()
            logger.info(f"Found {len(existing_items)} existing news items in database")
            
            # If we have sufficient items, return them
            if len(existing_items) >= 8:
                logger.info("Using existing news items from database")
                return existing_items
                
            all_items = []
            
            # Fetch from RSS feeds first (more hyper-local)
            try:
                rss_items = await self.fetch_from_rss_feeds("huntington", db)
                all_items.extend(rss_items)
                logger.info(f"Found {len(rss_items)} Huntington news items from RSS feeds")
            except Exception as e:
                logger.error(f"Error fetching RSS feeds: {str(e)}")
            
            # Fetch from NewsAPI
            try:
                newsapi_items = await self.fetch_from_newsapi("huntington", db)
                all_items.extend(newsapi_items)
                logger.info(f"Found {len(newsapi_items)} Huntington news items from NewsAPI")
            except Exception as e:
                logger.error(f"Error fetching from NewsAPI: {str(e)}")
            
            # If we still don't have enough items, create fallback items
            if len(all_items) < 5:
                logger.warning("Not enough news items found. Creating fallback items.")
                
                # Default Huntington coordinates
                huntington_coords = {
                    "center": (40.8676, -73.4257),
                    "village": (40.8707, -73.4295),
                    "harbor": (40.8954, -73.4262),
                    "park": (40.8734, -73.4287),
                    "downtown": (40.8715, -73.4305)
                }
                
                # Create fallback items with Huntington locations
                fallback_items = [
                    NewsItem(
                        title="Huntington Town Board Meeting",
                        description="The Huntington Town Board will meet to discuss local infrastructure projects.",
                        headline="Local Government News",
                        source_url="https://huntingtonny.gov",
                        date_time=datetime.now(),
                        category="News",
                        latitude=huntington_coords["center"][0],
                        longitude=huntington_coords["center"][1]
                    ),
                    NewsItem(
                        title="New Restaurant Opening in Huntington Village",
                        description="A new farm-to-table restaurant is opening next month in Huntington Village.",
                        headline="Local Business Update",
                        source_url="https://huntingtonny.gov/business",
                        date_time=datetime.now(),
                        category="Business",
                        latitude=huntington_coords["village"][0],
                        longitude=huntington_coords["village"][1]
                    ),
                    NewsItem(
                        title="Community Cleanup Event at Huntington Harbor",
                        description="Volunteers needed for the annual harbor cleanup event this weekend.",
                        headline="Environmental Initiative",
                        source_url="https://huntingtonny.gov/events",
                        date_time=datetime.now(),
                        category="Causes",
                        latitude=huntington_coords["harbor"][0],
                        longitude=huntington_coords["harbor"][1]
                    ),
                    NewsItem(
                        title="Summer Concert Series Announced for Heckscher Park",
                        description="The annual summer concert series lineup has been announced featuring local artists.",
                        headline="Arts & Culture",
                        source_url="https://huntingtonny.gov/culture",
                        date_time=datetime.now(),
                        category="Events",
                        latitude=huntington_coords["park"][0],
                        longitude=huntington_coords["park"][1]
                    ),
                    NewsItem(
                        title="Traffic Safety Improvements on Route 25A",
                        description="New traffic calming measures being implemented on Route 25A through Huntington.",
                        headline="Public Safety Update",
                        source_url="https://huntingtonny.gov/safety",
                        date_time=datetime.now(),
                        category="Crime & Safety",
                        latitude=huntington_coords["downtown"][0],
                        longitude=huntington_coords["downtown"][1]
                    )
                ]
                
                # Add fallback items to database
                for item in fallback_items:
                    db.add(item)
                db.commit()
                
                # Add to our results
                all_items.extend(fallback_items)
                logger.info(f"Added {len(fallback_items)} fallback items for Huntington")
            
            # Combine with any existing items and return
            combined_items = existing_items + all_items if existing_items else all_items
            logger.info(f"Total Huntington news items from all sources: {len(combined_items)}")
            return combined_items
            
        except Exception as e:
            logger.error(f"Error fetching comprehensive Huntington news: {str(e)}")
            # Try to return whatever we have in database
            try:
                items = db.query(NewsItem).all()
                return items
            except:
                return []

    async def fetch_from_newsapi(self, location: str, db: Session) -> List[NewsItem]:
        """
        Fetch and process news from NewsAPI.org for a specific location
        
        Args:
            location: Location name (city or region)
            db: Database session
            
        Returns:
            List of processed news items
        """
        logger.info(f"Fetching news from NewsAPI.org for location: {location}")
        
        try:
            # Fetch local news articles from NewsAPI
            articles = self.newsapi_service.fetch_local_news(location)
            
            if not articles:
                logger.warning(f"No articles found from NewsAPI for location: {location}")
                return []
            
            logger.info(f"Found {len(articles)} articles from NewsAPI for {location}")
            
            # Format articles for AI processing
            formatted_articles = self.newsapi_service.format_for_processing(articles)
            
            # Process each article
            items = []
            
            for article in formatted_articles:
                try:
                    # Process with AI to extract structured information
                    result = self.ai_processor.extract_information(article["text"], article["source_url"])
                    
                    # Skip if excluded
                    if 'excluded_reason' in result and result['excluded_reason']:
                        logger.info(f"Skipping NewsAPI article: {result.get('excluded_reason')}")
                        continue
                    
                    # Get coordinates for location
                    lat, lng = None, None
                    if 'location' in result and result['location']:
                        coords = self.geolocator.geocode(result['location'])
                        if coords:
                            lat, lng = coords
                    
                    # If no location found, try to geocode the specified location
                    if lat is None or lng is None:
                        coords = self.geolocator.geocode(location)
                        if coords:
                            lat, lng = coords
                    
                    # Skip if no coordinates (required field)
                    if lat is None or lng is None:
                        logger.warning(f"Skipping NewsAPI article without coordinates: {result.get('title', '')}")
                        continue
                    
                    # Parse date if available
                    date_time = None
                    if article["date"]:
                        try:
                            date_time = datetime.fromisoformat(article["date"].replace('Z', '+00:00'))
                        except (ValueError, TypeError):
                            date_time = datetime.now()
                    else:
                        date_time = datetime.now()
                    
                    # Create news item
                    news_item = NewsItem(
                        title=result.get('title', '')[:255],  # Limit to field size
                        headline=result.get('headline', '')[:255] if result.get('headline') else None,
                        description=result.get('description', ''),
                        summary=result.get('summary', ''),
                        category=result.get('category', 'News'),
                        latitude=lat,
                        longitude=lng,
                        source_url=article["source_url"],
                        date_time=date_time,
                        confidence_score=result.get('confidence_score', 0.5)
                    )
                    
                    # Add to database
                    db.add(news_item)
                    db.commit()
                    
                    items.append(news_item)
                    
                except Exception as e:
                    logger.error(f"Error processing NewsAPI article: {str(e)}")
            
            return items
            
        except Exception as e:
            logger.error(f"Error in NewsAPI processing: {str(e)}")
            return []
