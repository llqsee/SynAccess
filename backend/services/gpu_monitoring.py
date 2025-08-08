"""
GPU Monitoring Service for MAVIS
Provides GPU status, usage monitoring, and performance metrics.
"""

import time
from typing import Dict, List, Optional, Any
import logging

# GPU monitoring imports
try:
    import pynvml
    GPU_MONITORING_AVAILABLE = True
except ImportError:
    GPU_MONITORING_AVAILABLE = False

try:
    import cupy as cp
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False

logger = logging.getLogger(__name__)

class GPUMonitoringService:
    """Service for monitoring GPU usage and performance."""
    
    def __init__(self):
        """Initialize GPU monitoring service."""
        self.initialized = False
        self.gpu_count = 0
        self.gpu_handles = []
        
        if GPU_MONITORING_AVAILABLE:
            try:
                pynvml.nvmlInit()
                self.gpu_count = pynvml.nvmlDeviceGetCount()
                self.gpu_handles = [pynvml.nvmlDeviceGetHandleByIndex(i) for i in range(self.gpu_count)]
                self.initialized = True
                logger.info(f"GPU monitoring initialized with {self.gpu_count} GPU(s)")
            except Exception as e:
                logger.warning(f"Failed to initialize GPU monitoring: {e}")
                self.initialized = False
        else:
            logger.warning("GPU monitoring not available (pynvml not installed)")
    
    def get_gpu_status(self) -> Dict[str, Any]:
        """Get overall GPU status and availability."""
        return {
            "gpu_available": GPU_AVAILABLE,
            "gpu_monitoring_available": GPU_MONITORING_AVAILABLE,
            "gpu_count": self.gpu_count,
            "monitoring_initialized": self.initialized
        }
    
    def get_gpu_info(self, gpu_index: int = 0) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific GPU."""
        if not self.initialized or gpu_index >= self.gpu_count:
            return None
        
        try:
            handle = self.gpu_handles[gpu_index]
            
            # Get GPU name
            name = pynvml.nvmlDeviceGetName(handle).decode('utf-8')
            
            # Get memory info
            memory_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
            
            # Get utilization
            utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)
            
            # Get temperature
            temperature = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
            
            # Get power usage
            power_usage = pynvml.nvmlDeviceGetPowerUsage(handle) / 1000.0  # Convert to watts
            
            return {
                "index": gpu_index,
                "name": name,
                "memory_total_mb": memory_info.total // (1024 * 1024),
                "memory_used_mb": memory_info.used // (1024 * 1024),
                "memory_free_mb": memory_info.free // (1024 * 1024),
                "memory_utilization_percent": (memory_info.used / memory_info.total) * 100,
                "gpu_utilization_percent": utilization.gpu,
                "memory_utilization_percent": utilization.memory,
                "temperature_celsius": temperature,
                "power_usage_watts": power_usage
            }
        except Exception as e:
            logger.error(f"Error getting GPU info for index {gpu_index}: {e}")
            return None
    
    def get_all_gpu_info(self) -> List[Dict[str, Any]]:
        """Get information for all available GPUs."""
        gpu_info = []
        for i in range(self.gpu_count):
            info = self.get_gpu_info(i)
            if info:
                gpu_info.append(info)
        return gpu_info
    
    def get_gpu_usage_summary(self) -> Dict[str, Any]:
        """Get summary of GPU usage across all GPUs."""
        if not self.initialized:
            return {"error": "GPU monitoring not initialized"}
        
        all_gpu_info = self.get_all_gpu_info()
        if not all_gpu_info:
            return {"error": "No GPU information available"}
        
        # Calculate averages
        total_memory = sum(gpu["memory_total_mb"] for gpu in all_gpu_info)
        used_memory = sum(gpu["memory_used_mb"] for gpu in all_gpu_info)
        avg_gpu_utilization = sum(gpu["gpu_utilization_percent"] for gpu in all_gpu_info) / len(all_gpu_info)
        avg_memory_utilization = sum(gpu["memory_utilization_percent"] for gpu in all_gpu_info) / len(all_gpu_info)
        avg_temperature = sum(gpu["temperature_celsius"] for gpu in all_gpu_info) / len(all_gpu_info)
        total_power = sum(gpu["power_usage_watts"] for gpu in all_gpu_info)
        
        return {
            "gpu_count": len(all_gpu_info),
            "total_memory_mb": total_memory,
            "used_memory_mb": used_memory,
            "memory_utilization_percent": (used_memory / total_memory) * 100 if total_memory > 0 else 0,
            "average_gpu_utilization_percent": avg_gpu_utilization,
            "average_memory_utilization_percent": avg_memory_utilization,
            "average_temperature_celsius": avg_temperature,
            "total_power_usage_watts": total_power,
            "timestamp": time.time()
        }
    
    def check_gpu_availability(self) -> Dict[str, Any]:
        """Check if GPU is available for computation."""
        cupy_available = GPU_AVAILABLE
        gpu_memory_available = False
        
        if cupy_available and self.initialized:
            try:
                # Try to allocate a small amount of GPU memory
                test_array = cp.zeros((100, 100), dtype=cp.float32)
                del test_array
                gpu_memory_available = True
            except Exception as e:
                logger.warning(f"GPU memory allocation test failed: {e}")
                gpu_memory_available = False
        
        return {
            "cupy_available": cupy_available,
            "gpu_memory_available": gpu_memory_available,
            "gpu_ready_for_computation": cupy_available and gpu_memory_available
        }
    
    def __del__(self):
        """Cleanup GPU monitoring on destruction."""
        if self.initialized:
            try:
                pynvml.nvmlShutdown()
            except:
                pass

# Global GPU monitoring service instance
gpu_monitor = GPUMonitoringService() 