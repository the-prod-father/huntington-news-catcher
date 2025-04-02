import axios from 'axios';
import { mockNewsItems, mockDataSources, mockScrapeLogs } from '../utils/mockData';

// Flag to enable mock data when backend is unavailable
const useMockData = true; // Set to false when backend is available

// Create axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Mock API implementation for development without backend
const mockApi = {
  get: async (url, config) => {
    console.log(`[Mock API] GET ${url}`, config);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return appropriate mock data based on endpoint
    if (url.includes('/news')) {
      return { data: mockNewsItems };
    } else if (url.includes('/sources')) {
      return { data: mockDataSources };
    } else if (url.includes('/logs')) {
      return { data: mockScrapeLogs };
    } else if (url.includes('/export')) {
      // Mock CSV export
      const csvContent = 'Date_Time,Title,Headline,Description,Summary,Category,Location,Latitude,Longitude,Source_URL,Confidence_Score\n' + 
                      mockNewsItems.map(item => (
                        `${item.date_time},"${item.title}","${item.headline || ''}","${item.description || ''}",` +
                        `"${item.summary || ''}",${item.category},"San Francisco, CA",${item.latitude},${item.longitude},` +
                        `${item.source_url || ''},${item.confidence_score}`
                      )).join('\n');
      return { data: { csv: csvContent } };
    }
    
    // Default empty response
    return { data: [] };
  },
  
  post: async (url, data, config) => {
    console.log(`[Mock API] POST ${url}`, data, config);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Handle different endpoints
    if (url.includes('/sources')) {
      // Create new source
      const newSource = {
        id: mockDataSources.length + 1,
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return { data: newSource };
    } else if (url.includes('/scrape')) {
      // Create scrape log
      const newLog = {
        id: mockScrapeLogs.length + 1,
        start_time: new Date().toISOString(),
        status: 'started',
        total_items: 0,
        successful_items: 0,
        error_items: 0
      };
      return { data: newLog };
    }
    
    // Default success response
    return { data: { success: true } };
  },
  
  put: async (url, data, config) => {
    console.log(`[Mock API] PUT ${url}`, data, config);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Handle different endpoints
    if (url.includes('/sources')) {
      // Toggle source activation
      const sourceId = parseInt(url.split('/').filter(Boolean).pop());
      const source = mockDataSources.find(s => s.id === sourceId);
      if (source) {
        const updatedSource = {
          ...source,
          is_active: !source.is_active,
          updated_at: new Date().toISOString()
        };
        return { data: updatedSource };
      }
    }
    
    // Default success response
    return { data: { success: true } };
  }
};

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    // You can add custom logic here (like adding auth headers)
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle errors globally
    console.error('API Error:', error.response || error);
    return Promise.reject(error);
  }
);

// Export either the real API or mock API
export default useMockData ? mockApi : api;
