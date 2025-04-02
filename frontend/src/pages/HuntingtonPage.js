import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { FaCalendarDay, FaNewspaper, FaStore, FaHandHoldingHeart, FaShieldAlt, FaMapMarkedAlt, FaDownload } from 'react-icons/fa';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import api from '../services/api';

// Map container style
const containerStyle = {
  width: '100%',
  height: '400px'
};

// Huntington center coordinates
const huntingtonCenter = {
  lat: 40.8676,
  lng: -73.4257
};

// Category icons and colors
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

// Function to get category color for map markers
const getCategoryColor = (category) => {
  switch (category) {
    case 'News': return '#3B82F6'; // blue
    case 'Business': return '#10B981'; // green
    case 'Causes': return '#EC4899'; // pink
    case 'Events': return '#F59E0B'; // amber
    case 'Crime & Safety': return '#EF4444'; // red
    default: return '#6B7280'; // gray
  }
};

const HuntingtonPage = () => {
  // Google Maps API loader
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
  });
  
  // Override isLoaded for development when no API key is provided
  const actuallyLoaded = isLoaded && (process.env.REACT_APP_GOOGLE_MAPS_API_KEY || process.env.NODE_ENV === 'development');

  // State
  const [newsItems, setNewsItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeCategories, setActiveCategories] = useState({
    'News': true,
    'Business': true,
    'Causes': true,
    'Events': true,
    'Crime & Safety': true
  });
  const [viewMode, setViewMode] = useState('both'); // 'map', 'list', or 'both'

  // Toggle category filter
  const toggleCategory = useCallback((category) => {
    setActiveCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  }, []);

  // Filter news items by active categories
  const filteredNewsItems = newsItems.filter(item => activeCategories[item.category]);

  // Load Huntington news
  const loadHuntingtonNews = useCallback(async () => {
    setLoading(true);
    try {
      console.log('Fetching Huntington news...');
      // Try the main Huntington endpoint first
      const response = await api.get('/huntington-news');
      
      if (response.data && response.data.length > 0) {
        console.log(`Loaded ${response.data.length} news items for Huntington`);
        setNewsItems(response.data);
        toast.success(`Loaded ${response.data.length} latest Huntington news items`);
      } else {
        console.log('No news items found in main endpoint, trying comprehensive endpoint');
        // Try the comprehensive endpoint if main returns no results
        const comprehensiveResponse = await api.get('/huntington-news/comprehensive');
        
        if (comprehensiveResponse.data && comprehensiveResponse.data.length > 0) {
          console.log(`Loaded ${comprehensiveResponse.data.length} news items from comprehensive endpoint`);
          setNewsItems(comprehensiveResponse.data);
          toast.success(`Loaded ${comprehensiveResponse.data.length} Huntington news items`);
        } else {
          console.log('No news items found in comprehensive endpoint, falling back to general news');
          // Final fallback to general news endpoint
          const generalResponse = await api.get('/news');
          setNewsItems(generalResponse.data);
          toast.info(`Loaded ${generalResponse.data.length} general news items`);
        }
      }
    } catch (error) {
      console.error('Error loading Huntington news:', error);
      // Try fallback to the general news endpoint
      try {
        console.log('Attempting fallback to general news endpoint');
        const fallbackResponse = await api.get('/news');
        if (fallbackResponse.data && fallbackResponse.data.length > 0) {
          setNewsItems(fallbackResponse.data);
          toast.info(`Loaded ${fallbackResponse.data.length} general news items`);
        } else {
          toast.error('No news data available');
          setNewsItems([]);
        }
      } catch (fallbackError) {
        console.error('Error with fallback loading:', fallbackError);
        toast.error('Failed to load news data');
        setNewsItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Parse coordinates safely for Google Maps
  const parseCoordinates = useCallback((item) => {
    if (!item) return { lat: huntingtonCenter.lat, lng: huntingtonCenter.lng };
    
    try {
      const lat = typeof item.latitude === 'number' ? item.latitude : parseFloat(item.latitude || '0');
      const lng = typeof item.longitude === 'number' ? item.longitude : parseFloat(item.longitude || '0');
      
      // Check if valid coordinates
      if (isNaN(lat) || isNaN(lng) || !lat || !lng) {
        console.warn('Invalid coordinates for item:', item.title);
        return huntingtonCenter; // Default to Huntington center
      }
      
      return { lat, lng };
    } catch (e) {
      console.error('Error parsing coordinates:', e);
      return huntingtonCenter; // Default to Huntington center
    }
  }, []);

  // Export news as CSV
  const exportNews = async () => {
    try {
      const response = await api.get('/export', { 
        params: { 
          location: 'Huntington'
        } 
      });
      
      // Create and download CSV file
      const blob = new Blob([response.data.csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      
      // Create filename with date
      const date = format(new Date(), 'yyyy-MM-dd');
      a.setAttribute('download', `huntington-news-${date}.csv`);
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Huntington news exported successfully');
    } catch (error) {
      toast.error('Failed to export Huntington news');
      console.error('Error exporting news:', error);
    }
  };

  // Load news on mount
  useEffect(() => {
    loadHuntingtonNews();
    
    // Set up auto-refresh every 30 minutes
    const refreshInterval = setInterval(() => {
      loadHuntingtonNews();
    }, 30 * 60 * 1000);
    
    return () => clearInterval(refreshInterval);
  }, [loadHuntingtonNews]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Huntington Local News</h1>
          <p className="text-gray-600">Hyperlocal news focused on Huntington, Long Island</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* View mode toggle */}
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 text-sm font-medium ${
                viewMode === 'map'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border border-gray-300 rounded-l-lg focus:z-10 focus:ring-2 focus:ring-primary-500 focus:text-primary-700`}
            >
              <FaMapMarkedAlt className="inline mr-1" /> Map
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 text-sm font-medium ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border border-gray-300 focus:z-10 focus:ring-2 focus:ring-primary-500 focus:text-primary-700`}
            >
              <FaNewspaper className="inline mr-1" /> List
            </button>
            <button
              onClick={() => setViewMode('both')}
              className={`px-4 py-2 text-sm font-medium ${
                viewMode === 'both'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border border-gray-300 rounded-r-lg focus:z-10 focus:ring-2 focus:ring-primary-500 focus:text-primary-700`}
            >
              Both
            </button>
          </div>
          
          {/* Refresh button */}
          <button
            onClick={loadHuntingtonNews}
            disabled={loading}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 transition-colors disabled:bg-gray-400"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          
          {/* Export button */}
          <button
            onClick={exportNews}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            <FaDownload /> Export
          </button>
        </div>
      </div>
      
      {/* Category Filters */}
      <div className="bg-white p-4 rounded shadow-md mb-6">
        <h2 className="text-sm font-semibold mb-2">Filter by Category</h2>
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
      
      {/* Map View */}
      {(viewMode === 'map' || viewMode === 'both') && (
        <div className="bg-white rounded shadow-md overflow-hidden mb-6">
          <div className={viewMode === 'both' ? 'h-[400px]' : 'h-[600px]'}>
            {actuallyLoaded ? (
              <GoogleMap
                mapContainerStyle={containerStyle}
                center={huntingtonCenter}
                zoom={13}
                options={{
                  fullscreenControl: false,
                  streetViewControl: true,
                  mapTypeControl: true,
                }}
              >
                {/* Render Markers only when we have data */}
                {filteredNewsItems && filteredNewsItems.length > 0 ? (
                  filteredNewsItems.map((item) => (
                    <Marker
                      key={item.id || Math.random().toString()}
                      position={parseCoordinates(item)}
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
                  ))
                ) : null}

                {/* Info Window for selected item */}
                {selectedItem && (
                  <InfoWindow
                    position={parseCoordinates(selectedItem)}
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
      )}
      
      {/* List View */}
      {(viewMode === 'list' || viewMode === 'both') && (
        <div className="bg-white rounded shadow-md overflow-hidden">
          {loading ? (
            <div className="p-6 text-center">
              <p>Loading latest Huntington news...</p>
            </div>
          ) : filteredNewsItems.length === 0 ? (
            <div className="p-6 text-center">
              <p>No news items found for Huntington with the current filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {filteredNewsItems.map(item => (
                <div key={item.id} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className={`p-2 text-white text-xs font-semibold ${getCategoryBgClass(item.category)}`}>
                    {item.category}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                    {item.headline && (
                      <p className="text-sm font-medium text-gray-700 mb-2">{item.headline}</p>
                    )}
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">{item.summary}</p>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>{format(new Date(item.date_time), 'PPP')}</span>
                      {item.source_url && (
                        <a 
                          href={item.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:underline"
                        >
                          Source
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// NOTE: removed duplicate getCategoryColor function that was causing an ESLint error
// The proper getCategoryColor function is already defined at the top of the file

// Helper function to get background class for category cards
function getCategoryBgClass(category) {
  switch (category) {
    case 'News':
      return 'bg-blue-600';
    case 'Business':
      return 'bg-green-600';
    case 'Cause':
      return 'bg-purple-600';
    case 'Event':
      return 'bg-amber-600';
    case 'Crime & Safety':
      return 'bg-red-600';
    default:
      return 'bg-gray-500';
  }
}

export default HuntingtonPage;
