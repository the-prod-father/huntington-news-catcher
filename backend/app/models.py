from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from datetime import datetime

from .database import Base

class NewsItem(Base):
    """Database model for news items"""
    __tablename__ = "news_items"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    headline = Column(String(255))
    description = Column(Text)
    summary = Column(Text)
    category = Column(String(50), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    source_url = Column(Text)
    date_time = Column(DateTime(timezone=True), default=datetime.now, index=True)
    confidence_score = Column(Float)
    geom = Column(Geometry('POINT', srid=4326))
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

class DataSource(Base):
    """Database model for data sources"""
    __tablename__ = "data_sources"
    
    id = Column(Integer, primary_key=True, index=True)
    source_name = Column(String(255), nullable=False)
    url = Column(Text, nullable=False, unique=True)
    category = Column(String(50), nullable=False, index=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

class ScrapeLog(Base):
    """Database model for scrape logs"""
    __tablename__ = "scrape_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime(timezone=True), default=func.now())
    end_time = Column(DateTime(timezone=True))
    status = Column(String(50))
    total_items = Column(Integer, default=0)
    successful_items = Column(Integer, default=0)
    error_items = Column(Integer, default=0)
    log_details = Column(Text)
