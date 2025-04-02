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
