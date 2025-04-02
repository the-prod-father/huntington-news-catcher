import requests
import logging
import time
from typing import Optional, Tuple, Dict, Any, List
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
        
        # Define Huntington area locations
        self.huntington_area_locations = [
            "Huntington, NY",
            "Huntington Station, NY",
            "Cold Spring Harbor, NY",
            "Northport, NY",
            "Melville, NY",
            "East Northport, NY",
            "Centerport, NY",
            "Lloyd Harbor, NY",
            "Greenlawn, NY",
            "Dix Hills, NY",
            "Commack, NY",
            "Elwood, NY"
        ]
        
        # Cache coordinates for Huntington area locations
        self.location_cache = {}
        self._initialize_location_cache()
        
        logger.info("Geolocator service initialized with Huntington area focus")
    
    def _initialize_location_cache(self):
        """Pre-cache coordinates for all Huntington area locations"""
        try:
            for location in self.huntington_area_locations:
                if self.google_api_key:
                    coords = self._geocode_with_google(location, force_hunt_area=False)
                else:
                    coords = self._geocode_with_nominatim(location, force_hunt_area=False)
                    
                if coords:
                    self.location_cache[location.lower()] = coords
                    # Also cache without NY
                    location_without_ny = location.replace(', NY', '')
                    self.location_cache[location_without_ny.lower()] = coords
            
            logger.info(f"Successfully cached {len(self.location_cache)} Huntington area locations")
        except Exception as e:
            logger.error(f"Error initializing location cache: {str(e)}")
    
    def is_huntington_area(self, location_text: str) -> bool:
        """Check if a location is in the Huntington area"""
        if not location_text:
            return False
            
        location_text = location_text.lower()
        
        # Direct match with our predefined locations
        for area in self.huntington_area_locations:
            area_lower = area.lower()
            area_without_ny = area.replace(', NY', '').lower()
            
            if (location_text == area_lower or 
                location_text == area_without_ny or
                location_text in area_lower or
                area_without_ny in location_text):
                return True
                
        # Check for "huntington" keyword
        if "huntington" in location_text:
            return True
            
        return False
    
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
        
        # Check cache first
        location_key = location_text.lower()
        if location_key in self.location_cache:
            logger.info(f"Using cached coordinates for {location_text}")
            return self.location_cache[location_key]
        
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
    
    def _geocode_with_google(self, location_text: str, force_hunt_area: bool = True) -> Optional[Tuple[float, float]]:
        """Geocode location using Google Maps API"""
        try:
            # Respect rate limits
            self._respect_rate_limit()
            
            # If force_hunt_area is True and it doesn't already contain Huntington context,
            # append "near Huntington, NY" to improve accuracy for local locations
            query = location_text
            if force_hunt_area and not self.is_huntington_area(location_text):
                if "long island" not in location_text.lower() and "new york" not in location_text.lower() and "ny" not in location_text.lower():
                    query = f"{location_text} near Huntington, NY"
                    logger.info(f"Modified location query to: {query}")
            
            # Make API request
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                "address": query,
                "key": self.google_api_key,
                "components": "country:US"  # Restrict to United States
            }
            
            response = requests.get(url, params=params)
            data = response.json()
            
            # Check for valid response
            if data["status"] == "OK" and data["results"]:
                # Get the first result
                result = data["results"][0]
                location = result["geometry"]["location"]
                coords = (location["lat"], location["lng"])
                
                # Check if the result is in New York state
                in_ny = False
                for component in result.get("address_components", []):
                    if "administrative_area_level_1" in component.get("types", []) and component.get("short_name") == "NY":
                        in_ny = True
                        break
                
                # Cache the result
                if in_ny:
                    self.location_cache[location_text.lower()] = coords
                    
                return coords
            else:
                logger.warning(f"Google geocoding failed for '{query}': {data['status']}")
                return None
                
        except Exception as e:
            logger.error(f"Error in Google geocoding: {str(e)}")
            return None
    
    def _geocode_with_nominatim(self, location_text: str, force_hunt_area: bool = True) -> Optional[Tuple[float, float]]:
        """Geocode location using Nominatim (OpenStreetMap)"""
        try:
            # Respect rate limits (Nominatim requires 1 request per second)
            self._respect_rate_limit(min_interval=1.0)
            
            # If force_hunt_area is True and it doesn't already contain Huntington context,
            # append "near Huntington, NY" to improve accuracy for local locations
            query = location_text
            if force_hunt_area and not self.is_huntington_area(location_text):
                if "long island" not in location_text.lower() and "new york" not in location_text.lower() and "ny" not in location_text.lower():
                    query = f"{location_text} near Huntington, NY"
                    logger.info(f"Modified location query to: {query}")
            
            # Make API request
            url = "https://nominatim.openstreetmap.org/search"
            params = {
                "q": query,
                "format": "json",
                "limit": 5,  # Get more results to filter for NY state
                "addressdetails": 1,
                "countrycodes": "us"  # Restrict to United States
            }
            headers = {
                "User-Agent": "NewsCatcher/1.0"  # Required by Nominatim
            }
            
            response = requests.get(url, params=params, headers=headers)
            data = response.json()
            
            # Check for valid response and filter for New York results
            if data and len(data) > 0:
                # Try to find a New York result first
                for item in data:
                    address = item.get("address", {})
                    state = address.get("state", "")
                    if state == "New York":
                        coords = (float(item["lat"]), float(item["lon"]))
                        # Cache the result
                        self.location_cache[location_text.lower()] = coords
                        return coords
                
                # Fall back to first result if no NY result found
                coords = (float(data[0]["lat"]), float(data[0]["lon"]))
                return coords
            else:
                logger.warning(f"Nominatim geocoding failed for '{query}'")
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
