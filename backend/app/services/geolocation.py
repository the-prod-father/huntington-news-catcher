import requests
import logging
import time
from typing import Optional, Tuple, Dict, Any
import os

# Configure logging
logger = logging.getLogger("news_catcher.geolocation")

class Geolocator:
    """Service for geocoding location text to coordinates"""
    
    def __init__(self):
        """Initialize the geolocator with API keys from environment"""
        # API keys from environment variables
        self.google_api_key = os.getenv("GOOGLE_MAPS_API_KEY")
        
        # Track request timestamps to avoid rate limiting
        self.last_request_time = 0
        self.min_request_interval = 1.0  # seconds between requests
        
        logger.info("Geolocator service initialized")
    
    def geocode(self, location_text: str) -> Optional[Tuple[float, float]]:
        """
        Convert location text to coordinates (latitude, longitude)
        
        Args:
            location_text: Text description of a location
            
        Returns:
            Tuple of (latitude, longitude) or None if geocoding failed
        """
        if not location_text or location_text.strip() == "":
            logger.warning("Empty location text provided for geocoding")
            return None
        
        # Try Google Maps API if available
        if self.google_api_key:
            return self._geocode_with_google(location_text)
        
        # Fall back to Nominatim (OpenStreetMap)
        return self._geocode_with_nominatim(location_text)
    
    def reverse_geocode(self, lat: float, lng: float) -> Optional[str]:
        """
        Convert coordinates to address or location name
        
        Args:
            lat: Latitude
            lng: Longitude
            
        Returns:
            Location name or address as string, or None if reverse geocoding failed
        """
        # Try Google Maps API if available
        if self.google_api_key:
            return self._reverse_geocode_with_google(lat, lng)
        
        # Fall back to Nominatim (OpenStreetMap)
        return self._reverse_geocode_with_nominatim(lat, lng)
    
    def _geocode_with_google(self, location_text: str) -> Optional[Tuple[float, float]]:
        """Geocode location using Google Maps API"""
        try:
            # Respect rate limits
            self._respect_rate_limit()
            
            # Make API request
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                "address": location_text,
                "key": self.google_api_key
            }
            
            response = requests.get(url, params=params)
            data = response.json()
            
            # Check for valid response
            if data["status"] == "OK" and data["results"]:
                location = data["results"][0]["geometry"]["location"]
                return (location["lat"], location["lng"])
            else:
                logger.warning(f"Google geocoding failed for '{location_text}': {data['status']}")
                return None
                
        except Exception as e:
            logger.error(f"Error in Google geocoding: {str(e)}")
            return None
    
    def _geocode_with_nominatim(self, location_text: str) -> Optional[Tuple[float, float]]:
        """Geocode location using Nominatim (OpenStreetMap)"""
        try:
            # Respect rate limits (Nominatim requires 1 request per second)
            self._respect_rate_limit(min_interval=1.0)
            
            # Make API request
            url = "https://nominatim.openstreetmap.org/search"
            params = {
                "q": location_text,
                "format": "json",
                "limit": 1,
                "addressdetails": 1
            }
            headers = {
                "User-Agent": "NewsCatcher/1.0"  # Required by Nominatim
            }
            
            response = requests.get(url, params=params, headers=headers)
            data = response.json()
            
            # Check for valid response
            if data and len(data) > 0:
                return (float(data[0]["lat"]), float(data[0]["lon"]))
            else:
                logger.warning(f"Nominatim geocoding failed for '{location_text}'")
                return None
                
        except Exception as e:
            logger.error(f"Error in Nominatim geocoding: {str(e)}")
            return None
    
    def _reverse_geocode_with_google(self, lat: float, lng: float) -> Optional[str]:
        """Reverse geocode coordinates using Google Maps API"""
        try:
            # Respect rate limits
            self._respect_rate_limit()
            
            # Make API request
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                "latlng": f"{lat},{lng}",
                "key": self.google_api_key
            }
            
            response = requests.get(url, params=params)
            data = response.json()
            
            # Check for valid response
            if data["status"] == "OK" and data["results"]:
                return data["results"][0]["formatted_address"]
            else:
                logger.warning(f"Google reverse geocoding failed for ({lat}, {lng}): {data['status']}")
                return None
                
        except Exception as e:
            logger.error(f"Error in Google reverse geocoding: {str(e)}")
            return None
    
    def _reverse_geocode_with_nominatim(self, lat: float, lng: float) -> Optional[str]:
        """Reverse geocode coordinates using Nominatim (OpenStreetMap)"""
        try:
            # Respect rate limits
            self._respect_rate_limit(min_interval=1.0)
            
            # Make API request
            url = "https://nominatim.openstreetmap.org/reverse"
            params = {
                "lat": lat,
                "lon": lng,
                "format": "json",
                "addressdetails": 1
            }
            headers = {
                "User-Agent": "NewsCatcher/1.0"  # Required by Nominatim
            }
            
            response = requests.get(url, params=params, headers=headers)
            data = response.json()
            
            # Check for valid response
            if "display_name" in data:
                return data["display_name"]
            else:
                logger.warning(f"Nominatim reverse geocoding failed for ({lat}, {lng})")
                return None
                
        except Exception as e:
            logger.error(f"Error in Nominatim reverse geocoding: {str(e)}")
            return None
    
    def _respect_rate_limit(self, min_interval: Optional[float] = None) -> None:
        """
        Ensure minimum time between API requests by sleeping if necessary
        
        Args:
            min_interval: Minimum interval in seconds between requests (optional)
        """
        if min_interval is None:
            min_interval = self.min_request_interval
            
        current_time = time.time()
        elapsed = current_time - self.last_request_time
        
        if elapsed < min_interval:
            sleep_time = min_interval - elapsed
            time.sleep(sleep_time)
            
        self.last_request_time = time.time()
