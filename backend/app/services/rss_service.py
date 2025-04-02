import feedparser
import requests
from typing import List, Dict, Any, Optional
from datetime import datetime
import pytz
import re
import logging
from bs4 import BeautifulSoup
from geopy.geocoders import Nominatim
from urllib.parse import urlparse
import time

logger = logging.getLogger(__name__)

class RSSFeedService:
    """Service to fetch and process RSS feeds from various local news sources."""
    
    def __init__(self):
        """Initialize the RSS Feed Service."""
        self.eastern_tz = pytz.timezone('US/Eastern')
        # Initialize geocoder for location extraction
        self.geolocator = Nominatim(user_agent="news_catcher")
        # Cache for geocoding results to avoid repeated requests
        self.location_cache = {}
        
    def fetch_patch_rss(self, location: str = "huntington") -> List[Dict[str, Any]]:
        """
        Fetch news from Patch.com RSS feed for a specific location.
        
        Args:
            location: The location to fetch news for (default: huntington)
            
        Returns:
            List of processed news articles
        """
        url = f"https://patch.com/new-york/{location.lower()}/rss"
        logger.info(f"Fetching Patch.com RSS for {location} from {url}")
        
        try:
            feed = feedparser.parse(url)
            articles = []
            
            for entry in feed.entries:
                article = self._process_patch_entry(entry, location)
                if article:
                    articles.append(article)
            
            logger.info(f"Successfully fetched {len(articles)} articles from Patch.com")
            return articles
        except Exception as e:
            logger.error(f"Error fetching Patch.com RSS: {str(e)}")
            return []
    
    def fetch_newsday_rss(self) -> List[Dict[str, Any]]:
        """
        Fetch news from Newsday RSS feed and filter for Long Island content.
        
        Returns:
            List of processed news articles
        """
        url = "https://www.newsday.com/xml/rss.xml"
        logger.info(f"Fetching Newsday RSS from {url}")
        
        try:
            feed = feedparser.parse(url)
            articles = []
            
            for entry in feed.entries:
                article = self._process_newsday_entry(entry)
                if article and self._is_relevant_to_huntington(article):
                    articles.append(article)
            
            logger.info(f"Successfully fetched {len(articles)} relevant articles from Newsday")
            return articles
        except Exception as e:
            logger.error(f"Error fetching Newsday RSS: {str(e)}")
            return []
    
    def fetch_google_news_rss(self, location: str = "Huntington NY") -> List[Dict[str, Any]]:
        """
        Fetch news from Google News RSS for a specific location.
        
        Args:
            location: The location to fetch news for (default: Huntington NY)
            
        Returns:
            List of processed news articles
        """
        # URL encode the location for the Google News RSS feed
        encoded_location = location.replace(" ", "+")
        url = f"https://news.google.com/rss/search?q={encoded_location}+when:7d&hl=en-US&gl=US&ceid=US:en"
        logger.info(f"Fetching Google News RSS for {location} from {url}")
        
        try:
            feed = feedparser.parse(url)
            articles = []
            
            for entry in feed.entries:
                article = self._process_google_news_entry(entry, location)
                if article and self._is_relevant_to_huntington(article):
                    articles.append(article)
            
            logger.info(f"Successfully fetched {len(articles)} relevant articles from Google News")
            return articles
        except Exception as e:
            logger.error(f"Error fetching Google News RSS: {str(e)}")
            return []
    
    def fetch_all_huntington_sources(self) -> List[Dict[str, Any]]:
        """
        Fetch news from all configured sources for Huntington, NY.
        
        Returns:
            Combined list of all news articles
        """
        all_articles = []
        
        # Fetch from Patch.com
        patch_articles = self.fetch_patch_rss("huntington")
        all_articles.extend(patch_articles)
        
        # Fetch from Newsday
        newsday_articles = self.fetch_newsday_rss()
        all_articles.extend(newsday_articles)
        
        # Fetch from Google News
        google_articles = self.fetch_google_news_rss("Huntington Long Island NY")
        all_articles.extend(google_articles)
        
        # Remove duplicates based on title similarity
        unique_articles = self._remove_duplicates(all_articles)
        
        logger.info(f"Combined {len(all_articles)} articles into {len(unique_articles)} unique articles")
        return unique_articles
    
    def _remove_duplicates(self, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Remove duplicate articles based on title similarity.
        
        Args:
            articles: List of articles to deduplicate
            
        Returns:
            List of unique articles
        """
        unique_articles = []
        seen_titles = set()
        
        for article in articles:
            # Create a simplified version of the title for comparison
            simple_title = re.sub(r'[^\w\s]', '', article.get('title', '').lower())
            
            # Check if we've seen a similar title
            is_duplicate = False
            for seen_title in seen_titles:
                if self._titles_are_similar(simple_title, seen_title):
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                seen_titles.add(simple_title)
                unique_articles.append(article)
        
        return unique_articles
    
    def _titles_are_similar(self, title1: str, title2: str) -> bool:
        """
        Check if two titles are similar enough to be considered duplicates.
        
        Args:
            title1: First title to compare
            title2: Second title to compare
            
        Returns:
            True if titles are similar, False otherwise
        """
        # Simple check for now - if one title contains most of the other
        words1 = set(title1.split())
        words2 = set(title2.split())
        
        if len(words1) == 0 or len(words2) == 0:
            return False
        
        # Calculate Jaccard similarity
        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))
        similarity = intersection / union
        
        return similarity > 0.6  # 60% similarity threshold
    
    def _process_patch_entry(self, entry: Dict[str, Any], location: str) -> Optional[Dict[str, Any]]:
        """
        Process a single entry from Patch.com RSS feed.
        
        Args:
            entry: RSS feed entry
            location: The location being searched
            
        Returns:
            Processed article or None if not relevant
        """
        try:
            # Extract content from entry
            title = entry.get('title', '')
            link = entry.get('link', '')
            summary = entry.get('summary', '')
            
            # Clean up the summary
            summary = BeautifulSoup(summary, 'html.parser').get_text()
            
            # Parse the published date
            published = entry.get('published', '')
            if published:
                try:
                    date_time = datetime.strptime(published, '%a, %d %b %Y %H:%M:%S %z')
                except ValueError:
                    date_time = datetime.now(self.eastern_tz)
            else:
                date_time = datetime.now(self.eastern_tz)
                
            # Determine category
            category = self._determine_category(title, summary)
            
            # Get coordinates
            latitude, longitude = self._get_location_coordinates(location)
            
            return {
                'title': title,
                'source_url': link,
                'summary': summary,
                'date_time': date_time.isoformat(),
                'category': category,
                'source_name': 'Patch.com',
                'latitude': latitude,
                'longitude': longitude,
                'location': f"Huntington, NY"
            }
        except Exception as e:
            logger.error(f"Error processing Patch.com entry: {str(e)}")
            return None
    
    def _process_newsday_entry(self, entry: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Process a single entry from Newsday RSS feed.
        
        Args:
            entry: RSS feed entry
            
        Returns:
            Processed article or None if not relevant
        """
        try:
            # Extract content from entry
            title = entry.get('title', '')
            link = entry.get('link', '')
            summary = entry.get('summary', '')
            
            # Clean up the summary
            summary = BeautifulSoup(summary, 'html.parser').get_text()
            
            # Parse the published date
            published = entry.get('published', '')
            if published:
                try:
                    date_time = datetime.strptime(published, '%a, %d %b %Y %H:%M:%S %z')
                except ValueError:
                    date_time = datetime.now(self.eastern_tz)
            else:
                date_time = datetime.now(self.eastern_tz)
            
            # Check if this is a Long Island article
            is_li_article = any(term.lower() in title.lower() or term.lower() in summary.lower() 
                                for term in ['long island', 'huntington', 'suffolk county', 'nassau county'])
            
            if not is_li_article:
                return None
                
            # Determine category
            category = self._determine_category(title, summary)
            
            # Extract location and get coordinates
            location = self._extract_location(title, summary)
            if 'huntington' in location.lower():
                latitude, longitude = self._get_location_coordinates("huntington")
            else:
                latitude, longitude = self._get_location_coordinates(location)
            
            return {
                'title': title,
                'source_url': link,
                'summary': summary,
                'date_time': date_time.isoformat(),
                'category': category,
                'source_name': 'Newsday',
                'latitude': latitude,
                'longitude': longitude,
                'location': location
            }
        except Exception as e:
            logger.error(f"Error processing Newsday entry: {str(e)}")
            return None
    
    def _process_google_news_entry(self, entry: Dict[str, Any], location: str) -> Optional[Dict[str, Any]]:
        """
        Process a single entry from Google News RSS feed.
        
        Args:
            entry: RSS feed entry
            location: The location being searched
            
        Returns:
            Processed article or None if not relevant
        """
        try:
            # Extract content from entry
            title = entry.get('title', '')
            link = entry.get('link', '')
            
            # Google News entries often don't have a proper summary
            summary = entry.get('summary', '')
            if not summary:
                summary = title
            
            # Clean up the summary
            summary = BeautifulSoup(summary, 'html.parser').get_text()
            
            # Parse the published date
            published = entry.get('published', '')
            if published:
                try:
                    date_time = datetime.strptime(published, '%a, %d %b %Y %H:%M:%S %z')
                except ValueError:
                    date_time = datetime.now(self.eastern_tz)
            else:
                date_time = datetime.now(self.eastern_tz)
                
            # Determine category
            category = self._determine_category(title, summary)
            
            # Extract source name from link
            source_name = self._extract_source_from_link(link)
            
            # Get coordinates for the location
            latitude, longitude = self._get_location_coordinates(location.split()[0])  # Use first word of location
            
            return {
                'title': title,
                'source_url': link,
                'summary': summary,
                'date_time': date_time.isoformat(),
                'category': category,
                'source_name': source_name,
                'latitude': latitude,
                'longitude': longitude,
                'location': 'Huntington, NY'
            }
        except Exception as e:
            logger.error(f"Error processing Google News entry: {str(e)}")
            return None
    
    def _extract_source_from_link(self, link: str) -> str:
        """
        Extract the source name from a link.
        
        Args:
            link: URL to extract source from
            
        Returns:
            Source name
        """
        try:
            parsed_url = urlparse(link)
            domain = parsed_url.netloc
            
            # Remove www. and get first part of domain
            domain = domain.replace('www.', '')
            
            # Extract the main domain name
            parts = domain.split('.')
            if len(parts) >= 2:
                return parts[-2].capitalize()
            return domain.capitalize()
        except Exception:
            return "Unknown Source"
    
    def _determine_category(self, title: str, content: str) -> str:
        """
        Determine the category of an article based on its content.
        
        Args:
            title: Article title
            content: Article content or summary
            
        Returns:
            Category (News, Business, Cause, Event, or Crime & Safety)
        """
        combined_text = (title + " " + content).lower()
        
        # Check for events
        event_keywords = ['event', 'festival', 'parade', 'concert', 'exhibition', 'show', 
                         'ceremony', 'celebration', 'workshop', 'meeting', 'conference',
                         'gathering', 'upcoming', 'schedule']
        if any(keyword in combined_text for keyword in event_keywords):
            return 'Event'
        
        # Check for business
        business_keywords = ['business', 'company', 'store', 'shop', 'restaurant', 'cafe',
                            'market', 'grand opening', 'closing', 'economic', 'commercial',
                            'retail', 'entrepreneur', 'enterprise']
        if any(keyword in combined_text for keyword in business_keywords):
            return 'Business'
        
        # Check for crime & safety
        crime_keywords = ['police', 'crime', 'arrest', 'investigation', 'safety', 'accident',
                         'crash', 'fire', 'emergency', 'warning', 'alert', 'shooting', 'robbery',
                         'theft', 'burglary', 'assault', 'traffic', 'violation']
        if any(keyword in combined_text for keyword in crime_keywords):
            return 'Crime & Safety'
        
        # Check for causes
        cause_keywords = ['volunteer', 'charity', 'donation', 'fundraiser', 'nonprofit',
                         'community service', 'campaign', 'awareness', 'support', 'cause',
                         'drive', 'helping', 'benefit']
        if any(keyword in combined_text for keyword in cause_keywords):
            return 'Cause'
        
        # Default to News
        return 'News'
    
    def _extract_location(self, title: str, content: str) -> str:
        """
        Extract location information from article content.
        
        Args:
            title: Article title
            content: Article content or summary
            
        Returns:
            Extracted location or default
        """
        combined_text = title + " " + content
        
        # Check for Huntington-related locations
        huntington_patterns = [
            r'Huntington\s+Village',
            r'Huntington\s+Station',
            r'Cold\s+Spring\s+Harbor',
            r'Huntington\s+Bay',
            r'Halesite',
            r'Centerport',
            r'Greenlawn',
            r'Northport',
            r'East\s+Northport',
            r'Huntington,\s+NY',
            r'Huntington\s+New\s+York'
        ]
        
        for pattern in huntington_patterns:
            match = re.search(pattern, combined_text, re.IGNORECASE)
            if match:
                return match.group(0)
        
        # If no specific location found, check if Huntington is mentioned
        if re.search(r'Huntington', combined_text, re.IGNORECASE):
            return 'Huntington, NY'
        
        # Default location
        return 'Huntington, NY'
    
    def _get_location_coordinates(self, location: str) -> tuple:
        """
        Get the coordinates for a location using geocoding.
        
        Args:
            location: Location name to geocode
            
        Returns:
            Tuple of (latitude, longitude)
        """
        # Default coordinates for Huntington, NY
        default_coords = (40.8676, -73.4257)
        
        # Check cache first
        if location.lower() in self.location_cache:
            return self.location_cache[location.lower()]
        
        # If location is not specific enough, add more context
        search_location = location
        if location.lower() == 'huntington':
            search_location = 'Huntington, Long Island, NY'
        
        try:
            # Add a small delay to avoid rate limiting
            time.sleep(0.5)
            
            # Try to geocode the location
            geocode_result = self.geolocator.geocode(search_location)
            
            if geocode_result:
                coords = (geocode_result.latitude, geocode_result.longitude)
                
                # Cache the result
                self.location_cache[location.lower()] = coords
                
                return coords
        except Exception as e:
            logger.error(f"Error geocoding location '{location}': {str(e)}")
        
        # Return default coordinates if geocoding fails
        return default_coords
    
    def _is_relevant_to_huntington(self, article: Dict[str, Any]) -> bool:
        """
        Check if an article is relevant to Huntington, NY.
        
        Args:
            article: The article to check
            
        Returns:
            True if relevant, False otherwise
        """
        # Terms related to Huntington, NY
        huntington_terms = [
            'huntington', 'long island', 'suffolk county', 
            'cold spring harbor', 'centerport', 'greenlawn',
            'huntington bay', 'halesite', 'huntington station',
            'lloyd harbor', 'northport', 'east northport'
        ]
        
        # Check title and summary for relevant terms
        title = article.get('title', '').lower()
        summary = article.get('summary', '').lower()
        
        # Check for relevant terms
        if any(term in title or term in summary for term in huntington_terms):
            return True
        
        # Additional check to filter out articles about other Huntingtons
        non_li_huntingtons = ['huntington beach', 'huntington park', 'huntington, west virginia', 
                             'huntington, indiana', 'huntington, wv', 'huntington hospital, ca']
        
        # If it mentions Huntington but also mentions other Huntingtons, it's likely not relevant
        if 'huntington' in title or 'huntington' in summary:
            if any(term in title or term in summary for term in non_li_huntingtons):
                return False
            return True
        
        return False
