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
  'Causes': <FaHandHoldingHeart />,
  'Events': <FaCalendarDay />,
  'Crime & Safety': <FaShieldAlt />
};

// Category to CSS class mapping
const categoryClasses = {
  'News': 'news',
  'Business': 'business',
  'Causes': 'causes',
  'Events': 'events',
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
    'Causes': true,
    'Events': true,
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
      // First, try to directly search for news by location
      console.log(`Searching for news near: ${searchQuery}`);
      const searchParams = new URLSearchParams({
        location: searchQuery,
        radius: 15 // Use a larger radius to ensure we find results
      });
      
      // Use GET with query parameters
      const response = await api.get(`/news/search?${searchParams.toString()}`);
      
      if (response.data && response.data.length > 0) {
        console.log(`Found ${response.data.length} news items near ${searchQuery}`);
        // Get coordinates from first result
        const firstItem = response.data[0];
        setCenter({ lat: firstItem.latitude, lng: firstItem.longitude });
        setZoom(13);
        setNewsItems(response.data);
        return; // Exit if we found news items
      }
    } catch (error) {
      console.log(`Search failed for ${searchQuery}, falling back to all news: ${error.message}`);
      // If search failed, we'll fall back to showing all news and focusing on Huntington
    }

    try {
      // If search failed or returned no results, load all news items and center on Huntington
      const response = await api.get('/news');
      setNewsItems(response.data);
      
      // Center on default Huntington location
      setCenter(defaultCenter);
      setZoom(12);
      
      // If the search was specifically for Huntington, don't show an alert
      if (!searchQuery.toLowerCase().includes('huntington')) {
        alert(`No specific news found for "${searchQuery}". Showing all Huntington area news instead.`);
      }
    } catch (error) {
      console.error('Error loading all news items:', error);
      alert('Error searching for news. Please try again later.');
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
            onClick={() => toggleCategory('Causes')}
            className={`category-filter causes ${activeCategories['Causes'] ? 'active' : ''}`}
          >
            <FaHandHoldingHeart /> Causes
          </button>
          <button
            onClick={() => toggleCategory('Events')}
            className={`category-filter events ${activeCategories['Events'] ? 'active' : ''}`}
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
                  
                  {/* Description - Show full description when available */}
                  {selectedItem.description && (
                    <div className="mt-3 border-t pt-2">
                      <h4 className="text-sm font-medium text-gray-700">Description:</h4>
                      <p className="text-sm">{selectedItem.description}</p>
                    </div>
                  )}
                  
                  {/* Summary */}
                  {selectedItem.summary && (
                    <div className="mt-3 border-t pt-2">
                      <h4 className="text-sm font-medium text-gray-700">Summary:</h4>
                      <p className="text-sm">{selectedItem.summary}</p>
                    </div>
                  )}
                  
                  {/* Source URL - More prominent and descriptive */}
                  {selectedItem.source_url && (
                    <div className="mt-3 border-t pt-2">
                      <h4 className="text-sm font-medium text-gray-700">Source URL:</h4>
                      <a 
                        href={selectedItem.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline text-sm overflow-hidden text-ellipsis block"
                      >
                        {selectedItem.source_url}
                      </a>
                    </div>
                  )}
                  
                  {/* Date and time */}
                  <div className="mt-3 border-t pt-2 text-xs text-gray-500">
                    Posted: {new Date(selectedItem.date_time).toLocaleString()}
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
    case 'Causes':
      return '#9333EA'; // purple-600
    case 'Events':
      return '#D97706'; // amber-600
    case 'Crime & Safety':
      return '#DC2626'; // red-600
    default:
      return '#6B7280'; // gray-500
  }
}

export default MapPage;
