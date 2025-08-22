"""
GPU monitoring and status endpoints.

These routes let you check GPU availability, get performance info,
and monitor system resources for acceleration.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import logging

from backend.services.gpu_monitoring import gpu_monitor

router = APIRouter(prefix="/gpu", tags=["GPU"])

@router.get("/status")
async def get_gpu_status() -> Dict[str, Any]:
    """Get overall GPU status and availability."""
    return gpu_monitor.get_gpu_status()

@router.get("/info")
async def get_all_gpu_info() -> Dict[str, Any]:
    """Get detailed information for all available GPUs."""
    gpu_info = gpu_monitor.get_all_gpu_info()
    return {
        "gpu_count": len(gpu_info),
        "gpus": gpu_info
    }

@router.get("/info/{gpu_index}")
async def get_gpu_info(gpu_index: int) -> Dict[str, Any]:
    """Get detailed information for a specific GPU."""
    gpu_info = gpu_monitor.get_gpu_info(gpu_index)
    if gpu_info is None:
        raise HTTPException(status_code=404, detail=f"GPU {gpu_index} not found")
    return gpu_info

@router.get("/usage")
async def get_gpu_usage_summary() -> Dict[str, Any]:
    """Get summary of GPU usage across all GPUs."""
    return gpu_monitor.get_gpu_usage_summary()

@router.get("/availability")
async def check_gpu_availability() -> Dict[str, Any]:
    """Check if GPU is available for computation."""
    return gpu_monitor.check_gpu_availability() 