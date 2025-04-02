#!/bin/bash
# Setup script for News Catcher application

echo "Setting up News Catcher application..."

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file from template..."
  cp .env.example .env
  echo "Please edit the .env file to add your API keys if available."
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "Docker is not installed. Please install Docker and Docker Compose first."
  exit 1
fi

# Check Docker Compose - modern versions use 'docker compose' instead of 'docker-compose'
if ! docker compose version &> /dev/null; then
  echo "Docker Compose is not available. Please make sure Docker is running properly."
  exit 1
fi

echo "Starting News Catcher with Docker Compose..."
docker compose up -d

echo ""
echo "News Catcher is now running!"
echo "- Frontend: http://localhost:3000"
echo "- Backend API: http://localhost:8000"
echo "- API Documentation: http://localhost:8000/docs"
echo ""
echo "To view logs: docker compose logs -f"
echo "To stop: docker compose down"
