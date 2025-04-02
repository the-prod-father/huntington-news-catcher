// Mock data for development without backend

export const mockNewsItems = [
  {
    id: 1,
    title: "New Community Center Opening Soon",
    headline: "Grand opening scheduled for next month",
    description: "The new community center will offer various programs for all ages including sports, arts, and educational activities.",
    summary: "New community center opening with programs for all ages",
    category: "News",
    latitude: 37.7749,
    longitude: -122.4194,
    source_url: "https://example.com/news/1",
    date_time: "2025-04-15T10:00:00Z",
    confidence_score: 0.92
  },
  {
    id: 2,
    title: "Local Cafe Expansion",
    headline: "Popular downtown cafe adds new location",
    description: "The Bean Scene cafe is expanding with a second location in the Mission District, creating 15 new jobs.",
    summary: "Popular cafe opening second location",
    category: "Business",
    latitude: 37.7639,
    longitude: -122.4130,
    source_url: "https://example.com/news/2",
    date_time: "2025-04-10T14:30:00Z",
    confidence_score: 0.88
  },
  {
    id: 3,
    title: "Beach Cleanup Event",
    headline: "Volunteers needed for annual beach cleanup",
    description: "The annual Ocean Beach cleanup event is scheduled for this weekend. Volunteers are asked to bring gloves and reusable water bottles.",
    summary: "Volunteer event for beach cleanup this weekend",
    category: "Cause",
    latitude: 37.7594,
    longitude: -122.5107,
    source_url: "https://example.com/news/3",
    date_time: "2025-04-05T09:00:00Z",
    confidence_score: 0.95
  },
  {
    id: 4,
    title: "Summer Festival Announced",
    headline: "Annual summer festival returns with expanded program",
    description: "The Golden Gate Park Summer Festival will return in July with more food vendors, musical performances, and activities for children.",
    summary: "Summer festival returning with expanded offerings",
    category: "Event",
    latitude: 37.7694,
    longitude: -122.4862,
    source_url: "https://example.com/news/4",
    date_time: "2025-07-10T11:00:00Z",
    confidence_score: 0.91
  },
  {
    id: 5,
    title: "Community Alert: Car Break-ins Reported",
    headline: "Police advise residents to take precautions",
    description: "Several car break-ins have been reported in the Marina District. Police recommend not leaving valuables visible in vehicles.",
    summary: "Recent increase in car break-ins in Marina District",
    category: "Crime & Safety",
    latitude: 37.8030,
    longitude: -122.4377,
    source_url: "https://example.com/news/5",
    date_time: "2025-04-01T16:45:00Z",
    confidence_score: 0.89
  }
];

export const mockDataSources = [
  {
    id: 1,
    source_name: "SF Chronicle",
    url: "https://www.sfchronicle.com/feed/",
    category: "News",
    is_active: true,
    created_at: "2025-03-15T10:00:00Z",
    updated_at: "2025-03-15T10:00:00Z"
  },
  {
    id: 2,
    source_name: "Bay Area Events",
    url: "https://www.bayareaevents.com/feed/",
    category: "Event",
    is_active: true,
    created_at: "2025-03-16T10:00:00Z",
    updated_at: "2025-03-16T10:00:00Z"
  },
  {
    id: 3,
    source_name: "Local Business News",
    url: "https://www.localbusinessnews.com/feed/",
    category: "Business",
    is_active: false,
    created_at: "2025-03-17T10:00:00Z",
    updated_at: "2025-03-17T10:00:00Z"
  }
];

export const mockScrapeLogs = [
  {
    id: 1,
    start_time: "2025-03-31T10:00:00Z",
    end_time: "2025-03-31T10:05:23Z",
    status: "completed",
    total_items: 25,
    successful_items: 23,
    error_items: 2,
    log_details: "Processing source: SF Chronicle\n✓ SF Chronicle: Found 10 items\nProcessing source: Bay Area Events\n✓ Bay Area Events: Found 13 items\nProcessing source: Local Business News\n✗ Local Business News: Error - Connection timeout"
  },
  {
    id: 2,
    start_time: "2025-04-01T10:00:00Z",
    end_time: "2025-04-01T10:06:45Z",
    status: "completed_with_errors",
    total_items: 30,
    successful_items: 25,
    error_items: 5,
    log_details: "Processing source: SF Chronicle\n✓ SF Chronicle: Found 12 items\nProcessing source: Bay Area Events\n✓ Bay Area Events: Found 13 items\nProcessing source: Local Business News\n✗ Local Business News: Error - Invalid response format"
  }
];
