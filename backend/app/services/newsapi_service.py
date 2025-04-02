import os
import logging
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

# Configure logging
logger = logging.getLogger("news_catcher.newsapi_service")

class NewsAPIService:
    """Service for fetching news from NewsAPI.org"""
    
    def __init__(self):
        """Initialize the NewsAPI service with API key from environment"""
        self.api_key = os.getenv("NEWSAPI_API_KEY")
        
        if not self.api_key:
            logger.warning("NewsAPI API key not found in environment variables")
        else:
            logger.info("NewsAPI service initialized")
            
        self.base_url = "https://newsapi.org/v2"
        
    def fetch_local_news(self, location: str = "Huntington", days_back: int = 14) -> List[Dict[str, Any]]:
        """
        Fetch local news for a specific location, defaulting to Huntington, Long Island
        
        Args:
            location: Location to fetch news for (defaults to Huntington)
            days_back: Number of days to look back for news (defaults to 14 days for more content)
            
        Returns:
            List of news articles
        """
        if not self.api_key:
            logger.error("Cannot fetch news: NewsAPI API key not configured")
            return []
            
        try:
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            # Format dates for API
            from_date = start_date.strftime("%Y-%m-%d")
            to_date = end_date.strftime("%Y-%m-%d")
            
            # For Huntington, create a more specific query that includes Long Island
            if location.lower() == "huntington":
                query = "\"Huntington Long Island\" OR \"Huntington NY\" OR \"Huntington New York\" OR \"Town of Huntington\" OR \"Huntington Station\" OR \"Huntington Bay\" OR \"Huntington Village\""
                query += " AND (local OR community OR news OR event OR town OR school OR business OR library OR park OR restaurant OR festival OR development OR police OR fire OR vote OR road OR traffic OR weather)"
            else:
                # General query for other locations
                query = f"{location} AND (local OR community OR neighborhood)"
            
            # Make API request to everything endpoint
            url = f"{self.base_url}/everything"
            params = {
                "q": query,
                "from": from_date,
                "to": to_date,
                "language": "en",
                "sortBy": "relevancy",
                "pageSize": 100  # Maximum articles per request
            }
            headers = {
                "X-Api-Key": self.api_key
            }
            
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()  # Raise exception for HTTP errors
            
            data = response.json()
            
            if data.get("status") != "ok":
                logger.error(f"NewsAPI error: {data.get('message', 'Unknown error')}")
                return []
                
            articles = data.get("articles", [])
            logger.info(f"Fetched {len(articles)} articles from NewsAPI for location: {location}")
            
            # For Huntington, do additional filtering
            if location.lower() == "huntington":
                filtered_articles = []
                for article in articles:
                    title = article.get("title", "").lower()
                    content = article.get("content", "").lower()
                    description = article.get("description", "").lower()
                    
                    # Filter out articles that mention Huntington but are primarily about other places
                    excludes = ["huntington beach", "huntington wv", "huntington west virginia", "huntington indiana", "huntington hospital", "huntington disease"]
                    if any(exclude in title or exclude in content or exclude in description for exclude in excludes):
                        continue
                        
                    # Ensure it's really about our Huntington
                    includes = ["long island", "suffolk county", "new york", "ny", "town of huntington", "huntington station", "huntington bay", "huntington village"]
                    if any(include in title.lower() or include in content.lower() or include in description.lower() for include in includes):
                        filtered_articles.append(article)
                
                articles = filtered_articles
                logger.info(f"Filtered to {len(articles)} relevant Huntington, Long Island articles")
            
            return articles
            
        except Exception as e:
            logger.error(f"Error fetching from NewsAPI: {str(e)}")
            return []
    
    def fetch_top_headlines(self, country: str = "us", category: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetch top headlines for a country and optional category
        
        Args:
            country: Country code (default: 'us')
            category: Optional category (business, entertainment, general, health, science, sports, technology)
            
        Returns:
            List of headline articles
        """
        if not self.api_key:
            logger.error("Cannot fetch headlines: NewsAPI API key not configured")
            return []
            
        try:
            # Make API request to top-headlines endpoint
            url = f"{self.base_url}/top-headlines"
            params = {
                "country": country,
                "pageSize": 100  # Maximum articles per request
            }
            
            if category:
                params["category"] = category
                
            headers = {
                "X-Api-Key": self.api_key
            }
            
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()  # Raise exception for HTTP errors
            
            data = response.json()
            
            if data.get("status") != "ok":
                logger.error(f"NewsAPI error: {data.get('message', 'Unknown error')}")
                return []
                
            articles = data.get("articles", [])
            category_str = f" in category '{category}'" if category else ""
            logger.info(f"Fetched {len(articles)} top headlines for country '{country}'{category_str}")
            
            return articles
            
        except Exception as e:
            logger.error(f"Error fetching from NewsAPI: {str(e)}")
            return []
            
    def format_for_processing(self, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Format NewsAPI articles for AI processing
        
        Args:
            articles: List of articles from NewsAPI
            
        Returns:
            List of formatted articles ready for AI processing
        """
        formatted_articles = []
        
        for article in articles:
            # Extract relevant fields
            title = article.get("title", "")
            description = article.get("description", "")
            content = article.get("content", "")
            source_name = article.get("source", {}).get("name", "")
            author = article.get("author", "")
            url = article.get("url", "")
            published_at = article.get("publishedAt", "")
            
            # Combine text fields for AI processing
            full_text = f"""
Title: {title}

Source: {source_name}
Author: {author}
Published: {published_at}

Description: {description}

Content: {content}
"""
            
            formatted_articles.append({
                "text": full_text.strip(),
                "source_url": url,
                "date": published_at,
                "source_name": source_name
            })
            
        return formatted_articles
