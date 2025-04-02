import React, { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaUpload, FaCheck, FaTimes, FaSync } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';

const SourcesPage = () => {
  // State
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newSource, setNewSource] = useState({
    source_name: '',
    url: '',
    category: 'News'
  });
  const [isAdding, setIsAdding] = useState(false);

  // Load sources
  const loadSources = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/sources');
      setSources(response.data);
    } catch (error) {
      toast.error('Failed to load data sources');
      console.error('Error loading sources:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Add new source
  const addSource = async (e) => {
    e.preventDefault();
    
    if (!newSource.source_name || !newSource.url) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      const response = await api.post('/sources', newSource);
      setSources(prev => [...prev, response.data]);
      toast.success('Source added successfully');
      setNewSource({
        source_name: '',
        url: '',
        category: 'News'
      });
      setIsAdding(false);
    } catch (error) {
      toast.error('Failed to add source');
      console.error('Error adding source:', error);
    }
  };

  // Toggle source active status
  const toggleSourceStatus = async (sourceId) => {
    try {
      const response = await api.put(`/sources/${sourceId}/toggle`);
      setSources(prev => 
        prev.map(source => 
          source.id === sourceId ? response.data : source
        )
      );
      toast.success('Source status updated');
    } catch (error) {
      toast.error('Failed to update source status');
      console.error('Error toggling source:', error);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'text/csv') {
      toast.error('Please upload a CSV file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/sources/import', formData);
      toast.success(response.data.message);
      loadSources(); // Reload sources
    } catch (error) {
      toast.error('Failed to import sources');
      console.error('Error importing sources:', error);
    } finally {
      // Reset file input
      e.target.value = null;
    }
  };

  // Trigger news scraping job
  const triggerScrape = async () => {
    try {
      await api.post('/scrape');
      toast.success('News scraping job started');
    } catch (error) {
      toast.error('Failed to start scraping job');
      console.error('Error triggering scrape:', error);
    }
  };

  // Load sources on mount
  useEffect(() => {
    loadSources();
  }, [loadSources]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Data Sources</h1>
          <p className="text-gray-600">Manage news and information sources</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* Add source button */}
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 transition-colors"
          >
            <FaPlus /> Add Source
          </button>
          
          {/* Import CSV button */}
          <label className="flex items-center gap-2 bg-secondary-600 text-white px-4 py-2 rounded hover:bg-secondary-700 transition-colors cursor-pointer">
            <FaUpload /> Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          
          {/* Trigger scrape button */}
          <button
            onClick={triggerScrape}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            <FaSync /> Run Scraper
          </button>
        </div>
      </div>
      
      {/* Add Source Form */}
      {isAdding && (
        <div className="bg-white p-4 rounded shadow-md mb-6">
          <h2 className="text-lg font-semibold mb-3">Add New Source</h2>
          <form onSubmit={addSource} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source Name *
                </label>
                <input
                  type="text"
                  value={newSource.source_name}
                  onChange={(e) => setNewSource(prev => ({ ...prev, source_name: e.target.value }))}
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL *
                </label>
                <input
                  type="url"
                  value={newSource.url}
                  onChange={(e) => setNewSource(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={newSource.category}
                  onChange={(e) => setNewSource(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="News">News</option>
                  <option value="Business">Business</option>
                  <option value="Cause">Cause</option>
                  <option value="Event">Event</option>
                  <option value="Crime & Safety">Crime & Safety</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
              >
                Add Source
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Sources Table */}
      <div className="bg-white rounded shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  URL
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                    Loading sources...
                  </td>
                </tr>
              ) : sources.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                    No sources found. Add some to get started.
                  </td>
                </tr>
              ) : (
                sources.map((source) => (
                  <tr key={source.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{source.source_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        <a 
                          href={source.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:text-primary-600 hover:underline"
                        >
                          {source.url}
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryBadgeColor(source.category)}`}>
                        {source.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${source.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {source.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => toggleSourceStatus(source.id)}
                        className={`inline-flex items-center px-3 py-1 border border-transparent rounded-md text-xs font-medium text-white ${source.is_active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} transition-colors`}
                      >
                        {source.is_active ? (
                          <>
                            <FaTimes className="mr-1" /> Deactivate
                          </>
                        ) : (
                          <>
                            <FaCheck className="mr-1" /> Activate
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* CSV Format Guide */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="text-lg font-medium text-blue-800 mb-2">CSV Import Format</h3>
        <p className="text-sm text-blue-600 mb-2">
          Your CSV file should have the following columns:
        </p>
        <div className="bg-white p-2 rounded border border-blue-200 font-mono text-xs">
          Source_Name,URL,Category
        </div>
        <p className="text-sm text-blue-600 mt-2">
          For Category, use one of: News, Business, Cause, Event, Crime & Safety
        </p>
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

export default SourcesPage;
