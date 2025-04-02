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
    'Cause': true,
    'Event': true,
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
      const response = await api.get('/huntington-news');
      setNewsItems(response.data);
      toast.success('Loaded latest Huntington news');
    } catch (error) {
      console.error('Error loading Huntington news:', error);
      toast.error('Failed to load Huntington news');
    } finally {
      setLoading(false);
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
