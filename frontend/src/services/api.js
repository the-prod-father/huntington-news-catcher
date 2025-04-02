import axios from 'axios';
import { toast } from 'react-toastify';

// Default backend URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Default mock data for offline fallback
const FALLBACK_DATA = {
  news: [
    {
      id: 'fallback-1',
      title: 'Huntington Town Board Meeting',
      description: 'The Huntington Town Board will meet to discuss local infrastructure projects.',
      headline: 'Local Government News',
      source_url: 'https://huntingtonny.gov',
      date_time: new Date().toISOString(),
      category: 'News',
      latitude: 40.8676,
      longitude: -73.4257
    },
    {
      id: 'fallback-2',
      title: 'New Restaurant Opening in Huntington Village',
      description: 'A new farm-to-table restaurant is opening next month in Huntington Village.',
      headline: 'Local Business Update',
      source_url: 'https://huntingtonny.gov/business',
      date_time: new Date().toISOString(),
      category: 'Business',
      latitude: 40.8712,
      longitude: -73.4298
    },
    {
      id: 'fallback-3',
      title: 'Community Cleanup Event at Huntington Harbor',
      description: 'Volunteers needed for the annual harbor cleanup event this weekend.',
      headline: 'Environmental Initiative',
      source_url: 'https://huntingtonny.gov/events',
      date_time: new Date().toISOString(),
      category: 'Causes',
      latitude: 40.8954,
      longitude: -73.4262
    },
    {
      id: 'fallback-4',
      title: 'Summer Concert Series Announced for Heckscher Park',
      description: 'The annual summer concert series lineup has been announced featuring local artists.',
      headline: 'Arts & Culture',
      source_url: 'https://huntingtonny.gov/culture',
      date_time: new Date().toISOString(),
      category: 'Events',
      latitude: 40.8734,
      longitude: -73.4287
    },
    {
      id: 'fallback-5',
      title: 'Traffic Safety Improvements on Route 25A',
      description: 'New traffic calming measures being implemented on Route 25A through Huntington.',
      headline: 'Public Safety Update',
      source_url: 'https://huntingtonny.gov/safety',
      date_time: new Date().toISOString(),
      category: 'Crime & Safety',
      latitude: 40.8715,
      longitude: -73.4305
    }
  ],
  logs: [
    {
      id: 'fallback-log-1',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      status: 'completed',
      total_items: 5,
      successful_items: 5,
      error_items: 0,
      log_details: 'Fallback log data - API currently unavailable'
    }
  ],
  datasources: [
    {
      id: 'fallback-source-1',
      name: 'Huntington News',
      url: 'https://huntingtonny.gov/news',
      status: 'active'
    },
    {
      id: 'fallback-source-2',
      name: 'Patch Huntington',
      url: 'https://patch.com/new-york/huntington',
      status: 'active'
    }
  ],
  events: []
};

// Create axios instance with default config for the real backend API
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Add timeout to prevent hanging requests
  timeout: 10000,
});

// Track API connectivity
let isBackendAvailable = true;
let connectivityCheckInProgress = false;

// Function to check API connectivity
const checkApiConnectivity = async () => {
  if (connectivityCheckInProgress) return isBackendAvailable;
  
  try {
    connectivityCheckInProgress = true;
    await axios.get(`${API_URL}/health`, { timeout: 3000 });
    
    if (!isBackendAvailable) {
      isBackendAvailable = true;
      toast.success('Connection to server restored');
      console.log('Backend API connection restored');
    }
    
    return true;
  } catch (error) {
    if (isBackendAvailable) {
      isBackendAvailable = false;
      toast.error('Cannot connect to server. Using offline data.');
      console.warn('Backend API unavailable, switching to offline mode');
    }
    return false;
  } finally {
    connectivityCheckInProgress = false;
  }
};

// Check connectivity initially
checkApiConnectivity();

// Set up periodic connectivity checks
setInterval(checkApiConnectivity, 30000); // Check every 30 seconds

// Get fallback data for a specific endpoint
const getFallbackData = (url) => {
  // Extract endpoint from URL
  const endpoint = url.split('/')[1]?.split('?')[0];
  
  // Return appropriate fallback data based on endpoint
  switch(endpoint) {
    case 'news':
    case 'huntington-news':
    case 'huntington-news/comprehensive':
      return FALLBACK_DATA.news;
    case 'logs':
      return FALLBACK_DATA.logs;
    case 'data-sources':
      return FALLBACK_DATA.datasources;
    case 'events':
      return FALLBACK_DATA.events;
    default:
      return [];
  }
};

// Add request interceptor
api.interceptors.request.use(
  async (config) => {
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Request to: ${config.url}`, config);
    }
    
    // Check if backend is available before making requests
    if (!isBackendAvailable && !config.url.includes('/health')) {
      // Simulate successful network request with fallback data
      throw {
        config,
        response: {
          status: 200,
          data: getFallbackData(config.url)
        },
        isOfflineFallback: true
      };
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Function to perform request with retries
const performRequestWithRetry = async (config, maxRetries = 2) => {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      // Attempt the request
      return await axios(config);
    } catch (error) {
      // If this is the last retry, or it's not a network error, throw
      if (retries === maxRetries || !error.code || error.code !== 'ERR_NETWORK') {
        throw error;
      }
      
      // Increment retry counter
      retries++;
      
      // Wait before retrying (exponential backoff)
      const delay = 1000 * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.log(`Retrying request to ${config.url} (attempt ${retries} of ${maxRetries})`);
    }
  }
};

// Add response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // Handle offline fallback data
    if (error.isOfflineFallback) {
      console.log('Using offline fallback data for:', error.config.url);
      return {
        status: 200,
        data: error.response.data,
        config: error.config,
        headers: {},
        isOfflineFallback: true
      };
    }
    
    // Check if it's a network error
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      // Update connectivity status
      if (isBackendAvailable) {
        await checkApiConnectivity();
      }
      
      // If URL is not a health check and we have offline data, return fallback
      if (!error.config.url.includes('/health')) {
        const fallbackData = getFallbackData(error.config.url);
        console.log('Network error, using fallback data for:', error.config.url);
        
        return {
          status: 200,
          data: fallbackData,
          config: error.config,
          headers: {},
          isOfflineFallback: true
        };
      }
    }
    
    // Only log full error details in development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', error);
    } else {
      console.error(`API Error: ${error.message} when calling ${error.config?.url}`);
    }
    
    return Promise.reject(error);
  }
);

// Enhanced API methods with built-in error handling and fallbacks
const enhancedApi = {
  async get(url, config = {}) {
    try {
      const response = await api.get(url, config);
      return response;
    } catch (error) {
      if (error.isOfflineFallback) {
        return error; // This is already formatted as a response
      }
      
      console.error(`Error getting ${url}:`, error.message);
      throw error;
    }
  },
  
  async post(url, data, config = {}) {
    try {
      const response = await api.post(url, data, config);
      return response;
    } catch (error) {
      console.error(`Error posting to ${url}:`, error.message);
      throw error;
    }
  },
  
  async put(url, data, config = {}) {
    try {
      const response = await api.put(url, data, config);
      return response;
    } catch (error) {
      console.error(`Error putting to ${url}:`, error.message);
      throw error;
    }
  },
  
  async delete(url, config = {}) {
    try {
      const response = await api.delete(url, config);
      return response;
    } catch (error) {
      console.error(`Error deleting ${url}:`, error.message);
      throw error;
    }
  }
};

// Export the enhanced API
export default enhancedApi;
