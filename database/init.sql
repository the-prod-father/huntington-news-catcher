-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create news_items table
CREATE TABLE IF NOT EXISTS news_items (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    headline VARCHAR(255),
    description TEXT,
    summary TEXT,
    category VARCHAR(50) NOT NULL,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    source_url TEXT,
    date_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confidence_score FLOAT,
    geom GEOMETRY(Point, 4326),  -- PostGIS geometry column
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_news_items_category ON news_items(category);
CREATE INDEX idx_news_items_date_time ON news_items(date_time);
CREATE INDEX idx_news_items_geom ON news_items USING GIST(geom);

-- Create data_sources table
CREATE TABLE IF NOT EXISTS data_sources (
    id SERIAL PRIMARY KEY,
    source_name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_data_sources_category ON data_sources(category);
CREATE INDEX idx_data_sources_is_active ON data_sources(is_active);

-- Create scrape_logs table
CREATE TABLE IF NOT EXISTS scrape_logs (
    id SERIAL PRIMARY KEY,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50),
    total_items INT DEFAULT 0,
    successful_items INT DEFAULT 0,
    error_items INT DEFAULT 0,
    log_details TEXT
);

-- Trigger to update geometry column
CREATE OR REPLACE FUNCTION update_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_news_items_geom
BEFORE INSERT OR UPDATE ON news_items
FOR EACH ROW
EXECUTE FUNCTION update_geom();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_news_items_timestamp
BEFORE UPDATE ON news_items
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_data_sources_timestamp
BEFORE UPDATE ON data_sources
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
