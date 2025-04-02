import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { FaSearch, FaNewspaper, FaStore, FaHandHoldingHeart, FaCalendarDay, FaShieldAlt } from 'react-icons/fa';
import api from '../services/api';

// Map container style
const containerStyle = {
  width: '100%',
  height: '100%'
};

// Default center (Huntington, Long Island, NY)
const defaultCenter = {
  lat: 40.8676,
  lng: -73.4257
};

// Category icons
const categoryIcons = {
  'News': <FaNewspaper />,
  'Business': <FaStore />,
  'Cause': <FaHandHoldingHeart />,
  'Event': <FaCalendarDay />,
  'Crime & Safety': <FaShieldAlt />
};

// Category to CSS class mapping
const categoryClasses = {
  'News': 'news',
  'Business': 'business',
  'Cause': 'cause',
  'Event': 'event',
  'Crime & Safety': 'crime'
};

const MapPage = () => {
  // Google Maps API loader
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    // Note: For development, we can continue without a valid API key
    // but in production a valid key would be required
  });
  
  // Override isLoaded for development when no API key is provided
  const actuallyLoaded = isLoaded && (process.env.REACT_APP_GOOGLE_MAPS_API_KEY || process.env.NODE_ENV === 'development');

  // State
  const [map, setMap] = useState(null);
  const [center, setCenter] = useState(defaultCenter);
  const [zoom, setZoom] = useState(12);
  const [newsItems, setNewsItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategories, setActiveCategories] = useState({
    'News': true,
    'Business': true,
    'Cause': true,
    'Event': true,
    'Crime & Safety': true
  });

  // Refs
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);

  // Load news items
  const loadNewsItems = useCallback(async () => {
    try {
      const response = await api.get('/news');
      setNewsItems(response.data);
    } catch (error) {
      console.error('Error loading news items:', error);
    }
  }, []);

  // Search for location
  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const response = await api.get(`/news/search?location=${encodeURIComponent(searchQuery)}`);
      if (response.data && response.data.length > 0) {
        // Get coordinates from first result
        const firstItem = response.data[0];
        setCenter({ lat: firstItem.latitude, lng: firstItem.longitude });
        setZoom(13);
        setNewsItems(response.data);
      } else {
        // If no news items found, try to geocode the location
        const geocodeResponse = await api.get(`/geocode?address=${encodeURIComponent(searchQuery)}`);
        if (geocodeResponse.data) {
          setCenter({ lat: geocodeResponse.data.lat, lng: geocodeResponse.data.lng });
          setZoom(13);
          // Load news near this location
          const nearbyNews = await api.get(
            `/news?lat=${geocodeResponse.data.lat}&lng=${geocodeResponse.data.lng}&radius=10`
          );
          setNewsItems(nearbyNews.data);
        }
      }
    } catch (error) {
      console.error('Error searching:', error);
    }
  }, [searchQuery]);

  // Toggle category filter
  const toggleCategory = useCallback((category) => {
    setActiveCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  }, []);

  // Filter news items by active categories
  const filteredNewsItems = newsItems.filter(item => activeCategories[item.category]);

  // Handle map load
  const onLoad = useCallback((map) => {
    mapRef.current = map;
    setMap(map);
  }, []);

  // Handle map unmount
  const onUnmount = useCallback(() => {
    mapRef.current = null;
    setMap(null);
  }, []);

  // Load news items on mount
  useEffect(() => {
    loadNewsItems();
  }, [loadNewsItems]);

  // Focus search input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Search and Filters */}
      <div className="bg-white shadow-md p-4">
        <form onSubmit={handleSearch} className="flex mb-4">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search address, city, or location..."
            className="flex-1 p-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button 
            type="submit"
            className="bg-primary-600 text-white p-2 rounded-r hover:bg-primary-700 transition-colors flex items-center"
          >
            <FaSearch className="mr-1" /> Search
          </button>
        </form>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => toggleCategory('News')}
            className={`category-filter news ${activeCategories['News'] ? 'active' : ''}`}
          >
            <FaNewspaper /> News
          </button>
          <button
            onClick={() => toggleCategory('Business')}
            className={`category-filter business ${activeCategories['Business'] ? 'active' : ''}`}
          >
            <FaStore /> Business
          </button>
          <button
            onClick={() => toggleCategory('Cause')}
            className={`category-filter cause ${activeCategories['Cause'] ? 'active' : ''}`}
          >
            <FaHandHoldingHeart /> Causes
          </button>
          <button
            onClick={() => toggleCategory('Event')}
            className={`category-filter event ${activeCategories['Event'] ? 'active' : ''}`}
          >
            <FaCalendarDay /> Events
          </button>
          <button
            onClick={() => toggleCategory('Crime & Safety')}
            className={`category-filter crime ${activeCategories['Crime & Safety'] ? 'active' : ''}`}
          >
            <FaShieldAlt /> Crime & Safety
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1">
        {actuallyLoaded ? (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={zoom}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={{
              fullscreenControl: false,
              streetViewControl: false,
              mapTypeControl: false,
            }}
          >
            {/* Markers */}
            {filteredNewsItems.map((item) => (
              <Marker
                key={item.id}
                position={{ lat: item.latitude, lng: item.longitude }}
                onClick={() => setSelectedItem(item)}
                icon={{
                  path: "M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z",
                  fillColor: getCategoryColor(item.category),
                  fillOpacity: 1,
                  strokeWeight: 1,
                  strokeColor: "#FFFFFF",
                  scale: 1,
                  anchor: { x: 0, y: 0 },
                }}
              />
            ))}

            {/* Info Window for selected item */}
            {selectedItem && (
              <InfoWindow
                position={{ lat: selectedItem.latitude, lng: selectedItem.longitude }}
                onCloseClick={() => setSelectedItem(null)}
              >
                <div className="max-w-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`map-marker ${categoryClasses[selectedItem.category]} w-6 h-6`}>
                      {categoryIcons[selectedItem.category]}
                    </span>
                    <span className="text-xs font-medium text-gray-500">{selectedItem.category}</span>
                  </div>
                  <h3 className="font-semibold text-lg">{selectedItem.title}</h3>
                  {selectedItem.headline && (
                    <p className="text-sm font-medium my-1">{selectedItem.headline}</p>
                  )}
                  <p className="text-sm mt-2">{selectedItem.summary}</p>
                  {selectedItem.source_url && (
                    <a 
                      href={selectedItem.source_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline text-xs mt-2 block"
                    >
                      Source
                    </a>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    {new Date(selectedItem.date_time).toLocaleString()}
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p>Loading Map...</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to get color for category
function getCategoryColor(category) {
  switch (category) {
    case 'News':
      return '#2563EB'; // blue-600
    case 'Business':
      return '#16A34A'; // green-600
    case 'Cause':
      return '#9333EA'; // purple-600
    case 'Event':
      return '#D97706'; // amber-600
    case 'Crime & Safety':
      return '#DC2626'; // red-600
    default:
      return '#6B7280'; // gray-500
  }
}

export default MapPage;
