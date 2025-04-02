from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List
from datetime import datetime

class NewsItemBase(BaseModel):
    """Base schema for news items"""
    title: str
    headline: Optional[str] = None
    description: Optional[str] = None
    summary: Optional[str] = None
    category: str
    latitude: float
    longitude: float
    source_url: Optional[str] = None
    date_time: Optional[datetime] = None
    confidence_score: Optional[float] = None

class NewsItemCreate(NewsItemBase):
    """Schema for creating news items"""
    pass

class NewsItemResponse(NewsItemBase):
    """Schema for news item responses"""
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class DataSourceBase(BaseModel):
    """Base schema for data sources"""
    source_name: str
    url: str
    category: str
    is_active: Optional[bool] = True

class DataSourceCreate(DataSourceBase):
    """Schema for creating data sources"""
    pass

class DataSourceResponse(DataSourceBase):
    """Schema for data source responses"""
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ScrapeLogBase(BaseModel):
    """Base schema for scrape logs"""
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str
    total_items: int = 0
    successful_items: int = 0
    error_items: int = 0
    log_details: Optional[str] = None

class ScrapeLogResponse(ScrapeLogBase):
    """Schema for scrape log responses"""
    id: int
    
    class Config:
        from_attributes = True

class LocationSearch(BaseModel):
    """Schema for location search"""
    location: str = Field(..., description="Address, city, or place name")
    category: Optional[str] = None
    radius: Optional[float] = Field(
        default=10.0, 
        description="Search radius in kilometers"
    )
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
