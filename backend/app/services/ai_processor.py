import os
import logging
import json
from typing import Dict, Any, Optional, List, Tuple
import openai
from anthropic import Anthropic

# Configure logging
logger = logging.getLogger("news_catcher.ai_processor")

class AIProcessor:
    """Service for processing news content using AI (ChatGPT/Claude)"""
    
    def __init__(self):
        """Initialize AI Processor with API keys from environment"""
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        
        # Determine which AI service to use based on available API keys
        self.use_openai = bool(self.openai_api_key)
        self.use_anthropic = bool(self.anthropic_api_key)
        
        if self.use_openai:
            openai.api_key = self.openai_api_key
            logger.info("Using OpenAI for AI processing")
        elif self.use_anthropic:
            self.anthropic_client = Anthropic(api_key=self.anthropic_api_key)
            logger.info("Using Anthropic Claude for AI processing")
        else:
            logger.warning("No AI API keys available. AI processing will be limited.")
    
    def extract_information(self, text: str, source_url: str) -> Dict[str, Any]:
        """
        Extract structured information from news content
        
        Args:
            text: Raw text from news source
            source_url: URL of the source
            
        Returns:
            Dictionary with extracted information
        """
        if not text:
            logger.warning("Empty text provided for AI processing")
            return self._create_empty_result()
        
        # Try to use available AI service
        if self.use_openai:
            return self._process_with_openai(text, source_url)
        elif self.use_anthropic:
            return self._process_with_claude(text, source_url)
        else:
            # Basic extraction without AI
            logger.warning("Using basic extraction without AI")
            return self._basic_extraction(text, source_url)
    
    def _process_with_openai(self, text: str, source_url: str) -> Dict[str, Any]:
        """Process text with OpenAI API"""
        try:
            prompt = self._create_extraction_prompt(text, source_url)
            
            response = openai.chat.completions.create(
                model="gpt-4",  # Use appropriate model
                messages=[
                    {"role": "system", "content": "You are a hyper-local news analysis assistant. Extract detailed, precise information from local news content. Focus only on local news, events, businesses, causes/charities, and crime/safety. Exclude national news, politics, and professional sports."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,  # Low temperature for more deterministic results
                max_tokens=1500
            )
            
            # Parse response
            result = response.choices[0].message.content
            try:
                # Try to parse as JSON
                return json.loads(result)
            except json.JSONDecodeError:
                logger.error("Failed to parse OpenAI response as JSON")
                # Attempt structured extraction from text
                return self._extract_structured_data(result, source_url)
                
        except Exception as e:
            logger.error(f"Error in OpenAI processing: {str(e)}")
            return self._create_empty_result()
    
    def _process_with_claude(self, text: str, source_url: str) -> Dict[str, Any]:
        """Process text with Anthropic Claude API"""
        try:
            prompt = self._create_extraction_prompt(text, source_url)
            
            response = self.anthropic_client.messages.create(
                model="claude-3-sonnet-20240229",  # Use appropriate model
                max_tokens=1500,
                temperature=0.2,
                system="You are a hyper-local news analysis assistant. Extract detailed, precise information from local news content. Focus only on local news, events, businesses, causes/charities, and crime/safety. Exclude national news, politics, and professional sports.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Parse response
            result = response.content[0].text
            try:
                # Try to parse as JSON
                return json.loads(result)
            except json.JSONDecodeError:
                logger.error("Failed to parse Claude response as JSON")
                # Attempt structured extraction from text
                return self._extract_structured_data(result, source_url)
                
        except Exception as e:
            logger.error(f"Error in Claude processing: {str(e)}")
            return self._create_empty_result()
    
    def _create_extraction_prompt(self, text: str, source_url: str) -> str:
        """Create AI prompt for information extraction"""
        return f"""
        Analyze the following local news content and extract structured information.
        Focus only on hyper-local community information - news, events, businesses, causes/charities, and crime/safety.
        Strictly exclude national news, politics, and professional sports.
        
        Source URL: {source_url}
        
        CONTENT:
        {text}
        
        Extract and return ONLY the following information in JSON format:
        {{
            "title": "Extracted main title or headline",
            "headline": "Secondary headline or subheading if available",
            "description": "Detailed description of the event/news",
            "summary": "Brief 1-2 sentence summary",
            "category": "Must be one of: News, Business, Cause, Event, Crime & Safety",
            "location": "Specific location mentioned in the text",
            "confidence_score": "A score from 0.0 to 1.0 indicating confidence in extraction accuracy",
            "excluded_reason": "If this is national news, politics, or sports, explain why it's excluded"
        }}
        
        Only return valid JSON format, nothing else.
        """
    
    def _extract_structured_data(self, text: str, source_url: str) -> Dict[str, Any]:
        """Extract structured data from AI text response when JSON parsing fails"""
        result = {
            "title": "",
            "headline": "",
            "description": "",
            "summary": "",
            "category": "News",  # Default category
            "location": "",
            "confidence_score": 0.5,  # Medium confidence
            "source_url": source_url
        }
        
        # Simple extraction based on line prefixes
        lines = text.strip().split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith("Title:") or line.startswith("title:"):
                result["title"] = line.split(":", 1)[1].strip()
            elif line.startswith("Headline:") or line.startswith("headline:"):
                result["headline"] = line.split(":", 1)[1].strip()
            elif line.startswith("Description:") or line.startswith("description:"):
                result["description"] = line.split(":", 1)[1].strip()
            elif line.startswith("Summary:") or line.startswith("summary:"):
                result["summary"] = line.split(":", 1)[1].strip()
            elif line.startswith("Category:") or line.startswith("category:"):
                category = line.split(":", 1)[1].strip()
                valid_categories = ["News", "Business", "Cause", "Event", "Crime & Safety"]
                result["category"] = category if category in valid_categories else "News"
            elif line.startswith("Location:") or line.startswith("location:"):
                result["location"] = line.split(":", 1)[1].strip()
            elif line.startswith("Confidence:") or line.startswith("confidence:"):
                try:
                    score = float(line.split(":", 1)[1].strip())
                    result["confidence_score"] = min(max(score, 0.0), 1.0)  # Clamp between 0 and 1
                except ValueError:
                    pass
        
        return result
    
    def _basic_extraction(self, text: str, source_url: str) -> Dict[str, Any]:
        """
        Basic information extraction without AI
        This is a fallback method when AI services are unavailable
        """
        # Extract title (first non-empty line or first 50 chars)
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        title = lines[0] if lines else text[:50]
        
        # Basic extraction result
        return {
            "title": title,
            "headline": "",
            "description": text[:500] if len(text) > 500 else text,
            "summary": text[:200] if len(text) > 200 else text,
            "category": "News",  # Default category
            "location": "",  # No location extraction
            "confidence_score": 0.3,  # Low confidence
            "source_url": source_url
        }
    
    def _create_empty_result(self) -> Dict[str, Any]:
        """Create an empty result for when processing fails"""
        return {
            "title": "",
            "headline": "",
            "description": "",
            "summary": "",
            "category": "News",
            "location": "",
            "confidence_score": 0.0,
            "error": "Failed to process content"
        }
