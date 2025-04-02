# News Catcher

A comprehensive AI-powered, hyper-local news visualization tool that aggregates, categorizes, geolocates, visualizes, and analyzes local community information and news through cutting-edge AI (NLP, OpenAI/Claude API), Google Maps visualization, and intuitive UI/UX.

Currently focused on providing hyper-local news for **Huntington, Long Island, New York** with multi-source integration and intelligent filtering.

## Features

- **Interactive Google Maps Interface**: Clear visualization of geo-located news and events with categorized pins
- **Advanced Data Management**: PostgreSQL with PostGIS for efficient spatial queries
- **AI-Powered Analysis**: Intelligent extraction and categorization of news content
- **CSV Import/Export**: Robust data management capabilities
- **Real-time Logs**: Comprehensive logging and error handling
- **Automated Scraping**: Scheduled news retrieval via Celery
- **Huntington-Specific Dashboard**: Dedicated page for Huntington, NY local news
- **Multi-Source Integration**: NewsAPI.org, Patch.com, Newsday, and Google News RSS feeds
- **Hyper-Local Filtering**: Smart filtering to ensure content relevance

## Tech Stack

### Frontend
- React.js with modern hooks and state management
- TailwindCSS for responsive design
- Google Maps API integration
- Data visualization components

### Backend
- Python FastAPI for high-performance API endpoints
- PostgreSQL with PostGIS for spatial data
- AI Integration (OpenAI GPT / Claude API)
- NewsAPI.org integration for curated news sources
- RSS feed service for local news sources (Patch.com, Newsday, Google News)
- Robust error handling and validation

### Infrastructure
- Docker Compose for containerized deployment
- Celery for asynchronous task processing
- Redis for message queuing
- Automated scraping with scheduling

## Getting Started

### Prerequisites
- Docker and Docker Compose
- API keys (optional but recommended):
  - OpenAI API key or Anthropic API key for AI processing
  - Google Maps API key for map visualization
  - NewsAPI.org API key for news aggregation

### Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd news-catcher
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file to add your API keys if available.

3. **Start the application with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Without Docker (Development Mode)

#### Backend Setup:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

#### Frontend Setup:
```bash
cd frontend
npm install
npm start
```

## Usage Guide

### Map View
The main interface displays an interactive map with pins for different categories:
- 📰 News (Blue)
- 🏪 Businesses (Green)
- 🎗️ Causes/Charities (Purple)
- 📅 Events (Amber)
- 🚔 Crime & Safety (Red)

Use the search box to find locations and the category filters to toggle visibility.

### Data Sources
Manage your news sources by:
- Adding individual URLs
- Importing CSV files with sources
- Activating/deactivating sources
- Triggering manual scraping

### Events View
View and export event data with:
- List or map visualization
- Filtering by date range and category
- CSV export capability

### Logs View
Monitor the system with:
- Real-time scraping logs
- Success/failure statistics
- Detailed error information

## License

This project is for internal use only.
