"""
AI-powered analysis endpoints.

These routes use Claude to provide expert analysis of your validation
results, giving you professional insights about your data quality.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging
import json
import uuid
from datetime import datetime

from backend.services.ai_analysis_service import get_ai_agent, initialize_ai_agent
from backend.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-analysis", tags=["AI Analysis"])

class AIAnalysisRequest(BaseModel):
    """Request model for AI analysis."""
    validation_results: Dict[str, Any]
    dataset_info: Optional[Dict[str, Any]] = None
    user_context: Optional[Dict[str, Any]] = None

class AIAnalysisResponse(BaseModel):
    """Response model for AI analysis."""
    success: bool
    analysis: Dict[str, Any]
    service_available: bool
    message: str

class AISimilarityScoreRequest(BaseModel):
    """Request model for AI similarity scoring."""
    computed_scores: Dict[str, Any] = Field(default_factory=dict)
    context: Optional[Dict[str, Any]] = None

class AISimilarityScoreResponse(BaseModel):
    """Response model for AI similarity scoring."""
    success: bool
    scores: Dict[str, float]
    confidence: Optional[str] = None
    rationale: Optional[str] = None
    service_available: bool
    message: str
    timestamp: str

@router.post("/analyze", response_model=AIAnalysisResponse)
async def analyze_validation_results(request: AIAnalysisRequest):
    """
    Analyze validation results using AI Statistician Agent.
    
    Args:
        request: AIAnalysisRequest containing validation results, dataset info, and user context
        
    Returns:
        AIAnalysisResponse with expert analysis results
    """
    try:
        # Check if AI analysis is enabled
        if not settings.enable_ai_analysis:
            raise HTTPException(
                status_code=503,
                detail="AI analysis is disabled. Set ENABLE_AI_ANALYSIS=true to enable."
            )
        
        # Check if Claude API key is available
        if not settings.anthropic_api_key:
            raise HTTPException(
                status_code=503,
                detail="Claude API key not configured. Set ANTHROPIC_API_KEY to enable AI analysis."
            )
        
        # Get or initialize AI agent
        ai_agent = get_ai_agent()
        if ai_agent is None:
            ai_agent = initialize_ai_agent(settings.anthropic_api_key)
        
        # Perform AI Statistician analysis
        analysis = ai_agent.analyze(
            validation_results=request.validation_results
        )
        
        logger.info("AI Statistician analysis completed successfully")
        
        # Return the simple AI analysis format directly
        return AIAnalysisResponse(
            success=True,
            analysis=analysis,  # This is already { timestamp, result_summary }
            service_available=True,
            message="AI Statistician analysis completed successfully."
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"AI analysis failed: {str(e)}"
        )

@router.get("/status")
async def get_ai_service_status():
    """
    Get the status of the AI Statistician service.
    
    Returns:
        Status information about the AI service
    """
    try:
        ai_agent = get_ai_agent()
        if ai_agent is None:
            return {
                "service_available": False,
                "service_type": "ai_statistician",
                "model": "claude-sonnet-4-6",
                "message": "AI Statistician service not initialized"
            }
        
        # Simple availability check - if we can create the agent, it's available
        is_available = ai_agent is not None
        
        return {
            "service_available": is_available,
            "service_type": "ai_statistician",
            "model": "claude-sonnet-4-6",
            "message": "AI Statistician service is available" if is_available else "AI Statistician service is not available"
        }
        
    except Exception as e:
        logger.error(f"Failed to get AI service status: {e}")
        return {
            "service_available": False,
            "service_type": "ai_statistician",
            "model": "claude-sonnet-4-6",
            "message": f"Error checking service status: {str(e)}"
        } 

@router.post("/similarity-scores", response_model=AISimilarityScoreResponse)
async def generate_similarity_scores(request: AISimilarityScoreRequest):
    """Generate AI-estimated similarity scores using computed metrics as evidence."""
    try:
        if not settings.enable_ai_analysis:
            raise HTTPException(
                status_code=503,
                detail="AI analysis is disabled. Set ENABLE_AI_ANALYSIS=true to enable."
            )

        if not settings.anthropic_api_key:
            raise HTTPException(
                status_code=503,
                detail="Claude API key not configured. Set ANTHROPIC_API_KEY to enable AI analysis."
            )

        ai_agent = get_ai_agent()
        if ai_agent is None:
            ai_agent = initialize_ai_agent(settings.anthropic_api_key)

        ai_result = ai_agent.score_similarity(
            computed_scores=request.computed_scores,
            context=request.context,
        )

        if ai_result.get("status") != "success":
            raise HTTPException(
                status_code=500,
                detail=f"AI similarity scoring failed: {ai_result.get('error', 'Unknown error')}"
            )

        return AISimilarityScoreResponse(
            success=True,
            scores=ai_result.get("scores", {}),
            confidence=ai_result.get("confidence"),
            rationale=ai_result.get("rationale"),
            service_available=True,
            message="AI similarity scoring completed successfully.",
            timestamp=ai_result.get("timestamp", datetime.now().isoformat()),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI similarity scoring failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"AI similarity scoring failed: {str(e)}"
        )