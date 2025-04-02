import React, { useState, useEffect, useCallback } from 'react';
import { FaSync, FaInfoCircle, FaExclamationTriangle, FaCheck, FaClock } from 'react-icons/fa';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import api from '../services/api';

const LogsPage = () => {
  // State
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Load logs
  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/logs');
      setLogs(response.data);
    } catch (error) {
      toast.error('Failed to load logs');
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Toggle auto refresh
  const toggleAutoRefresh = () => {
    if (autoRefresh) {
      // Turn off auto refresh
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
      setAutoRefresh(false);
    } else {
      // Turn on auto refresh (every 5 seconds)
      const interval = setInterval(() => {
        loadLogs();
      }, 5000);
      setRefreshInterval(interval);
      setAutoRefresh(true);
    }
  };

  // Format log duration
  const formatDuration = (startTime, endTime) => {
    if (!endTime) return 'In progress';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;
    
    const seconds = Math.floor(durationMs / 1000);
    if (seconds < 60) return `${seconds} seconds`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes} min ${remainingSeconds} sec`;
  };

  // Get status icon based on log status
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <FaCheck className="text-green-500" />;
      case 'completed_with_errors':
        return <FaExclamationTriangle className="text-amber-500" />;
      case 'failed':
        return <FaExclamationTriangle className="text-red-500" />;
      case 'in_progress':
      case 'started':
        return <FaClock className="text-blue-500 animate-pulse" />;
      default:
        return <FaInfoCircle className="text-gray-500" />;
    }
  };

  // Get status badge color based on log status
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'completed_with_errors':
        return 'bg-amber-100 text-amber-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
      case 'started':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Load logs on mount
  useEffect(() => {
    loadLogs();
    
    // Cleanup auto refresh interval when component unmounts
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [loadLogs]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">System Logs</h1>
          <p className="text-gray-600">View scraping job logs and execution details</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={loadLogs}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 transition-colors"
            disabled={loading}
          >
            <FaSync className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          
          <button
            onClick={toggleAutoRefresh}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
              autoRefresh 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      
      {/* Logs List */}
      <div className="bg-white rounded shadow-md overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {loading ? 'Loading logs...' : 'No logs found.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {logs.map((log) => (
              <div key={log.id} className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(log.status)}
                    <span className="font-semibold text-lg">Scrape Job #{log.id}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(log.status)}`}>
                      {log.status}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-500">
                    Started: {format(new Date(log.start_time), 'PPp')}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-500 mb-1">Duration</div>
                    <div className="font-medium">
                      {formatDuration(log.start_time, log.end_time)}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-500 mb-1">Items Processed</div>
                    <div className="font-medium">{log.total_items}</div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-500 mb-1">Success Rate</div>
                    <div className="font-medium">
                      {log.total_items > 0 
                        ? `${Math.round((log.successful_items / log.total_items) * 100)}%` 
                        : 'N/A'
                      }
                      {' '}
                      ({log.successful_items} successful, {log.error_items} failed)
                    </div>
                  </div>
                </div>
                
                {log.log_details && (
                  <div className="mt-3">
                    <h4 className="font-medium text-sm mb-2">Log Details</h4>
                    <pre className="bg-gray-100 p-3 rounded text-xs font-mono overflow-x-auto max-h-60 overflow-y-auto">
                      {log.log_details}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsPage;
