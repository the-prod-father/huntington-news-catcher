import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { FaCalendarDay, FaList, FaMapMarkedAlt, FaDownload, FaFilter } from 'react-icons/fa';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import api from '../services/api';

// Map container style
const containerStyle = {
  width: '100%',
  height: '400px'
};

// Default center (San Francisco)
const defaultCenter = {
  lat: 37.7749,
  lng: -122.4194
};

const EventsPage = () => {
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
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [timeRange, setTimeRange] = useState('upcoming'); // 'today', 'upcoming', 'past'
  const [filterCategory, setFilterCategory] = useState('');
  
  // Load events
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      // Prepare query parameters
      const params = {};
      
      // Add time range parameters
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (timeRange === 'today') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        params.start_date = today.toISOString();
        params.end_date = tomorrow.toISOString();
      } else if (timeRange === 'upcoming') {
        params.start_date = today.toISOString();
      } else if (timeRange === 'past') {
        params.end_date = today.toISOString();
      }
      
      // Add category filter if selected
      if (filterCategory) {
        params.category = filterCategory;
      }
      
      // Make API call
      const response = await api.get('/news', { params });
      
      // Filter for events-related categories if no specific category is selected
      let filteredEvents = response.data;
      if (!filterCategory) {
        filteredEvents = response.data.filter(item => 
          item.category === 'Event' || 
          item.date_time // Any item with a date_time could be an event
        );
      }
      
      setEvents(filteredEvents);
    } catch (error) {
      toast.error('Failed to load events');
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  }, [timeRange, filterCategory]);

  // Export events as CSV
  const exportEvents = async () => {
    try {
      // Prepare query parameters
      const params = {};
      
      // Add time range parameters
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (timeRange === 'today') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        params.start_date = today.toISOString();
        params.end_date = tomorrow.toISOString();
      } else if (timeRange === 'upcoming') {
        params.start_date = today.toISOString();
      } else if (timeRange === 'past') {
        params.end_date = today.toISOString();
      }
      
      // Add category filter if selected
      if (filterCategory) {
        params.category = filterCategory;
      }
      
      const response = await api.get('/export', { params });
      
      // Create and download CSV file
      const blob = new Blob([response.data.csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      
      // Create filename with date
      const date = format(new Date(), 'yyyy-MM-dd');
      a.setAttribute('download', `news-catcher-events-${date}.csv`);
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Events exported successfully');
    } catch (error) {
      toast.error('Failed to export events');
      console.error('Error exporting events:', error);
    }
  };

  // Load events on mount and when filters change
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Events</h1>
          <p className="text-gray-600">View and export events data</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* View mode toggle */}
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 text-sm font-medium ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border border-gray-300 rounded-l-lg focus:z-10 focus:ring-2 focus:ring-primary-500 focus:text-primary-700`}
            >
              <FaList className="inline mr-1" /> List
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 text-sm font-medium ${
                viewMode === 'map'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border border-gray-300 rounded-r-lg focus:z-10 focus:ring-2 focus:ring-primary-500 focus:text-primary-700`}
            >
              <FaMapMarkedAlt className="inline mr-1" /> Map
            </button>
          </div>
          
          {/* Export button */}
          <button
            onClick={exportEvents}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            <FaDownload /> Export CSV
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded shadow-md mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Time range filter */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Range
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="today">Today</option>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past Events</option>
              <option value="all">All Time</option>
            </select>
          </div>
          
          {/* Category filter */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Categories</option>
              <option value="Event">Events</option>
              <option value="News">News</option>
              <option value="Business">Business</option>
              <option value="Cause">Cause</option>
              <option value="Crime & Safety">Crime & Safety</option>
            </select>
          </div>
          
          {/* Apply filters button */}
          <div className="flex items-end">
            <button
              onClick={loadEvents}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 transition-colors"
            >
              <FaFilter /> Apply Filters
            </button>
          </div>
        </div>
      </div>
      
      {/* Map View */}
      {viewMode === 'map' && (
        <div className="bg-white rounded shadow-md overflow-hidden mb-6">
          <div className="h-[400px]">
            {actuallyLoaded ? (
              <GoogleMap
                mapContainerStyle={containerStyle}
                center={defaultCenter}
                zoom={10}
                options={{
                  fullscreenControl: false,
                  streetViewControl: false,
                  mapTypeControl: false,
                }}
              >
                {/* Markers */}
                {events.map((event) => (
                  <Marker
                    key={event.id}
                    position={{ lat: event.latitude, lng: event.longitude }}
                    onClick={() => setSelectedEvent(event)}
                    icon={{
                      path: "M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z",
                      fillColor: getCategoryColor(event.category),
                      fillOpacity: 1,
                      strokeWeight: 1,
                      strokeColor: "#FFFFFF",
                      scale: 1,
                      anchor: { x: 0, y: 0 },
                    }}
                  />
                ))}

                {/* Info Window for selected event */}
                {selectedEvent && (
                  <InfoWindow
                    position={{ lat: selectedEvent.latitude, lng: selectedEvent.longitude }}
                    onCloseClick={() => setSelectedEvent(null)}
                  >
                    <div className="max-w-xs">
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        {selectedEvent.category}
                      </div>
                      <h3 className="font-semibold text-lg">{selectedEvent.title}</h3>
                      {selectedEvent.headline && (
                        <p className="text-sm font-medium my-1">{selectedEvent.headline}</p>
                      )}
                      <p className="text-sm mt-2">{selectedEvent.summary}</p>
                      {selectedEvent.source_url && (
                        <a 
                          href={selectedEvent.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:underline text-xs mt-2 block"
                        >
                          Source
                        </a>
                      )}
                      <div className="mt-2 text-xs text-gray-500">
                        {selectedEvent.date_time ? 
                          format(new Date(selectedEvent.date_time), 'PPP p') : 
                          'Date not specified'
                        }
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
      {viewMode === 'list' && (
        <div className="bg-white rounded shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                      Loading events...
                    </td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                      No events found with the current filters.
                    </td>
                  </tr>
                ) : (
                  events.map((event) => (
                    <tr key={event.id}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{event.title}</div>
                        {event.headline && (
                          <div className="text-xs text-gray-500">{event.headline}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryBadgeColor(event.category)}`}>
                          {event.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {event.date_time ? (
                          <div className="text-sm text-gray-900">
                            {format(new Date(event.date_time), 'PPP')}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">Not specified</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {event.source_url ? (
                          <a
                            href={event.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-900 hover:underline"
                          >
                            View Source
                          </a>
                        ) : (
                          <span className="text-gray-400">No source</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* CSV Format Guide */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="text-lg font-medium text-blue-800 mb-2">CSV Export Format</h3>
        <p className="text-sm text-blue-600 mb-2">
          Exported CSV files will include the following columns:
        </p>
        <div className="bg-white p-2 rounded border border-blue-200 font-mono text-xs break-all">
          Date_Time,Title,Headline,Description,Summary,Category,Location,Latitude,Longitude,Source_URL,Confidence_Score
        </div>
      </div>
    </div>
  );
};

// Helper function for category badge colors
function getCategoryBadgeColor(category) {
  switch (category) {
    case 'News':
      return 'bg-blue-100 text-blue-800';
    case 'Business':
      return 'bg-green-100 text-green-800';
    case 'Cause':
      return 'bg-purple-100 text-purple-800';
    case 'Event':
      return 'bg-amber-100 text-amber-800';
    case 'Crime & Safety':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

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

export default EventsPage;
