"""
Enhanced monitoring and health check utilities for MAVIS.
"""
import asyncio
import psutil
import time
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from pathlib import Path
from dataclasses import dataclass, asdict
from collections import defaultdict, deque

from config import settings, LOGS_DIR

logger = logging.getLogger("monitoring")

@dataclass
class SystemMetrics:
    """System resource metrics snapshot."""
    timestamp: float
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float
    memory_available_mb: float
    disk_usage_percent: float
    disk_free_gb: float
    active_connections: int
    process_count: int

@dataclass
class ApplicationMetrics:
    """Application-specific metrics."""
    timestamp: float
    active_embedding_jobs: int
    total_api_requests: int
    average_response_time: float
    error_rate: float
    cache_hit_rate: float
    database_connections: int

class MetricsCollector:
    """Collects and stores system and application metrics."""
    
    def __init__(self, max_entries: int = 1000):
        self.max_entries = max_entries
        self.system_metrics: deque = deque(maxlen=max_entries)
        self.application_metrics: deque = deque(maxlen=max_entries)
        self.api_calls: deque = deque(maxlen=max_entries)
        self.error_logs: deque = deque(maxlen=max_entries)
        
        # Performance counters
        self.counters = defaultdict(int)
        self.timings = defaultdict(list)
        
    def collect_system_metrics(self) -> SystemMetrics:
        """Collect current system resource metrics."""
        try:
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            metrics = SystemMetrics(
                timestamp=time.time(),
                cpu_percent=psutil.cpu_percent(interval=0.1),
                memory_percent=memory.percent,
                memory_used_mb=memory.used / 1024 / 1024,
                memory_available_mb=memory.available / 1024 / 1024,
                disk_usage_percent=disk.percent,
                disk_free_gb=disk.free / 1024 / 1024 / 1024,
                active_connections=len(psutil.net_connections()),
                process_count=len(psutil.pids())
            )
            
            self.system_metrics.append(metrics)
            return metrics
            
        except Exception as e:
            logger.error(f"Error collecting system metrics: {e}")
            return None
    
    def collect_application_metrics(
        self, 
        active_jobs: int = 0,
        db_connections: int = 0
    ) -> ApplicationMetrics:
        """Collect application-specific metrics."""
        try:
            # Calculate API metrics from recent calls
            recent_calls = [call for call in self.api_calls 
                          if call['timestamp'] > time.time() - 300]  # Last 5 minutes
            
            total_requests = len(recent_calls)
            avg_response_time = 0
            error_count = 0
            
            if recent_calls:
                avg_response_time = sum(call['response_time'] for call in recent_calls) / len(recent_calls)
                error_count = sum(1 for call in recent_calls if call['status_code'] >= 400)
            
            error_rate = error_count / total_requests if total_requests > 0 else 0
            
            # Calculate cache hit rate
            cache_hits = self.counters.get('cache_hits', 0)
            cache_total = self.counters.get('cache_total', 0)
            cache_hit_rate = cache_hits / cache_total if cache_total > 0 else 0
            
            metrics = ApplicationMetrics(
                timestamp=time.time(),
                active_embedding_jobs=active_jobs,
                total_api_requests=total_requests,
                average_response_time=avg_response_time,
                error_rate=error_rate,
                cache_hit_rate=cache_hit_rate,
                database_connections=db_connections
            )
            
            self.application_metrics.append(metrics)
            return metrics
            
        except Exception as e:
            logger.error(f"Error collecting application metrics: {e}")
            return None
    
    def record_api_call(
        self, 
        method: str, 
        endpoint: str, 
        status_code: int, 
        response_time: float,
        user_agent: str = None
    ):
        """Record an API call for metrics tracking."""
        call_data = {
            'timestamp': time.time(),
            'method': method,
            'endpoint': endpoint,
            'status_code': status_code,
            'response_time': response_time,
            'user_agent': user_agent
        }
        
        self.api_calls.append(call_data)
        self.counters[f'api_{method.lower()}'] += 1
        
        if status_code >= 400:
            self.counters['api_errors'] += 1
    
    def record_error(self, error_type: str, error_message: str, context: Dict = None):
        """Record an error for monitoring."""
        error_data = {
            'timestamp': time.time(),
            'type': error_type,
            'message': error_message,
            'context': context or {}
        }
        
        self.error_logs.append(error_data)
        self.counters[f'error_{error_type}'] += 1
    
    def record_timing(self, operation: str, duration: float):
        """Record timing for an operation."""
        self.timings[operation].append({
            'timestamp': time.time(),
            'duration': duration
        })
        
        # Keep only recent timings
        cutoff = time.time() - 3600  # 1 hour
        self.timings[operation] = [
            t for t in self.timings[operation] 
            if t['timestamp'] > cutoff
        ]
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get a comprehensive metrics summary."""
        current_time = time.time()
        
        # Recent system metrics
        recent_system = [m for m in self.system_metrics 
                        if m.timestamp > current_time - 300]
        
        # Recent application metrics  
        recent_app = [m for m in self.application_metrics 
                     if m.timestamp > current_time - 300]
        
        summary = {
            'timestamp': current_time,
            'system': {
                'current': asdict(self.system_metrics[-1]) if self.system_metrics else None,
                'average_cpu': sum(m.cpu_percent for m in recent_system) / len(recent_system) if recent_system else 0,
                'average_memory': sum(m.memory_percent for m in recent_system) / len(recent_system) if recent_system else 0,
            },
            'application': {
                'current': asdict(self.application_metrics[-1]) if self.application_metrics else None,
                'api_calls_last_hour': len([c for c in self.api_calls if c['timestamp'] > current_time - 3600]),
                'errors_last_hour': len([e for e in self.error_logs if e['timestamp'] > current_time - 3600]),
            },
            'counters': dict(self.counters),
            'performance': {
                operation: {
                    'count': len(timings),
                    'average_duration': sum(t['duration'] for t in timings) / len(timings) if timings else 0,
                    'max_duration': max(t['duration'] for t in timings) if timings else 0
                }
                for operation, timings in self.timings.items()
            }
        }
        
        return summary

class HealthChecker:
    """Performs health checks on various system components."""
    
    def __init__(self, metrics_collector: MetricsCollector):
        self.metrics_collector = metrics_collector
        self.checks = {}
        self.register_default_checks()
    
    def register_check(self, name: str, check_function):
        """Register a health check function."""
        self.checks[name] = check_function
    
    def register_default_checks(self):
        """Register default health checks."""
        self.register_check('system_resources', self._check_system_resources)
        self.register_check('disk_space', self._check_disk_space)
        self.register_check('memory_usage', self._check_memory_usage)
        self.register_check('api_performance', self._check_api_performance)
        self.register_check('error_rate', self._check_error_rate)
    
    async def run_health_checks(self) -> Dict[str, Any]:
        """Run all registered health checks."""
        results = {}
        overall_status = 'healthy'
        
        for check_name, check_function in self.checks.items():
            try:
                result = await check_function()
                results[check_name] = result
                
                if result['status'] == 'critical':
                    overall_status = 'critical'
                elif result['status'] == 'warning' and overall_status == 'healthy':
                    overall_status = 'warning'
                    
            except Exception as e:
                logger.error(f"Health check {check_name} failed: {e}")
                results[check_name] = {
                    'status': 'critical',
                    'message': f"Check failed: {str(e)}",
                    'timestamp': time.time()
                }
                overall_status = 'critical'
        
        return {
            'overall_status': overall_status,
            'checks': results,
            'timestamp': time.time()
        }
    
    async def _check_system_resources(self) -> Dict[str, Any]:
        """Check system resource usage."""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            
            status = 'healthy'
            messages = []
            
            if cpu_percent > 90:
                status = 'critical'
                messages.append(f"High CPU usage: {cpu_percent:.1f}%")
            elif cpu_percent > 70:
                status = 'warning'
                messages.append(f"Elevated CPU usage: {cpu_percent:.1f}%")
            
            if memory.percent > 95:
                status = 'critical'
                messages.append(f"Critical memory usage: {memory.percent:.1f}%")
            elif memory.percent > 80:
                if status != 'critical':
                    status = 'warning'
                messages.append(f"High memory usage: {memory.percent:.1f}%")
            
            return {
                'status': status,
                'message': '; '.join(messages) if messages else 'System resources normal',
                'details': {
                    'cpu_percent': cpu_percent,
                    'memory_percent': memory.percent,
                    'memory_used_gb': memory.used / 1024 / 1024 / 1024
                },
                'timestamp': time.time()
            }
            
        except Exception as e:
            return {
                'status': 'critical',
                'message': f"Failed to check system resources: {str(e)}",
                'timestamp': time.time()
            }
    
    async def _check_disk_space(self) -> Dict[str, Any]:
        """Check available disk space."""
        try:
            disk = psutil.disk_usage('/')
            free_gb = disk.free / 1024 / 1024 / 1024
            
            status = 'healthy'
            message = f"Disk space: {free_gb:.1f}GB free"
            
            if free_gb < 1:  # Less than 1GB
                status = 'critical'
                message = f"Critical: Only {free_gb:.1f}GB disk space remaining"
            elif free_gb < 5:  # Less than 5GB
                status = 'warning'
                message = f"Warning: Only {free_gb:.1f}GB disk space remaining"
            
            return {
                'status': status,
                'message': message,
                'details': {
                    'free_gb': free_gb,
                    'used_percent': disk.percent
                },
                'timestamp': time.time()
            }
            
        except Exception as e:
            return {
                'status': 'critical',
                'message': f"Failed to check disk space: {str(e)}",
                'timestamp': time.time()
            }
    
    async def _check_memory_usage(self) -> Dict[str, Any]:
        """Check memory usage trends."""
        try:
            recent_metrics = [
                m for m in self.metrics_collector.system_metrics 
                if m.timestamp > time.time() - 600  # Last 10 minutes
            ]
            
            if len(recent_metrics) < 2:
                return {
                    'status': 'healthy',
                    'message': 'Insufficient data for memory trend analysis',
                    'timestamp': time.time()
                }
            
            # Check for memory leak (increasing trend)
            memory_values = [m.memory_percent for m in recent_metrics]
            trend = (memory_values[-1] - memory_values[0]) / len(memory_values)
            
            status = 'healthy'
            message = 'Memory usage stable'
            
            if trend > 2:  # Increasing by more than 2% per sample
                status = 'warning'
                message = f'Memory usage increasing (trend: +{trend:.1f}%)'
            elif trend > 5:
                status = 'critical'
                message = f'Rapid memory increase detected (trend: +{trend:.1f}%)'
            
            return {
                'status': status,
                'message': message,
                'details': {
                    'trend_percent': trend,
                    'current_usage': memory_values[-1]
                },
                'timestamp': time.time()
            }
            
        except Exception as e:
            return {
                'status': 'critical',
                'message': f"Failed to check memory trends: {str(e)}",
                'timestamp': time.time()
            }
    
    async def _check_api_performance(self) -> Dict[str, Any]:
        """Check API performance metrics."""
        try:
            current_time = time.time()
            recent_calls = [
                call for call in self.metrics_collector.api_calls 
                if call['timestamp'] > current_time - 300  # Last 5 minutes
            ]
            
            if not recent_calls:
                return {
                    'status': 'healthy',
                    'message': 'No recent API calls to analyze',
                    'timestamp': time.time()
                }
            
            avg_response_time = sum(call['response_time'] for call in recent_calls) / len(recent_calls)
            max_response_time = max(call['response_time'] for call in recent_calls)
            
            status = 'healthy'
            message = f'API performance normal (avg: {avg_response_time:.2f}s)'
            
            if avg_response_time > 10:  # Average > 10 seconds
                status = 'critical'
                message = f'Critical: Slow API responses (avg: {avg_response_time:.2f}s)'
            elif avg_response_time > 5:  # Average > 5 seconds
                status = 'warning'
                message = f'Warning: Elevated response times (avg: {avg_response_time:.2f}s)'
            
            return {
                'status': status,
                'message': message,
                'details': {
                    'average_response_time': avg_response_time,
                    'max_response_time': max_response_time,
                    'total_calls': len(recent_calls)
                },
                'timestamp': time.time()
            }
            
        except Exception as e:
            return {
                'status': 'critical',
                'message': f"Failed to check API performance: {str(e)}",
                'timestamp': time.time()
            }
    
    async def _check_error_rate(self) -> Dict[str, Any]:
        """Check error rates."""
        try:
            current_time = time.time()
            recent_errors = [
                error for error in self.metrics_collector.error_logs 
                if error['timestamp'] > current_time - 3600  # Last hour
            ]
            
            recent_api_calls = [
                call for call in self.metrics_collector.api_calls 
                if call['timestamp'] > current_time - 3600
            ]
            
            error_rate = len(recent_errors) / len(recent_api_calls) if recent_api_calls else 0
            
            status = 'healthy'
            message = f'Error rate: {error_rate:.1%}'
            
            if error_rate > 0.1:  # More than 10% error rate
                status = 'critical'
                message = f'Critical: High error rate ({error_rate:.1%})'
            elif error_rate > 0.05:  # More than 5% error rate
                status = 'warning'
                message = f'Warning: Elevated error rate ({error_rate:.1%})'
            
            return {
                'status': status,
                'message': message,
                'details': {
                    'error_rate': error_rate,
                    'total_errors': len(recent_errors),
                    'total_requests': len(recent_api_calls)
                },
                'timestamp': time.time()
            }
            
        except Exception as e:
            return {
                'status': 'critical',
                'message': f"Failed to check error rate: {str(e)}",
                'timestamp': time.time()
            }

class MonitoringService:
    """Main monitoring service that coordinates metrics collection and health checks."""
    
    def __init__(self):
        self.metrics_collector = MetricsCollector()
        self.health_checker = HealthChecker(self.metrics_collector)
        self.is_running = False
        self.collection_interval = 30  # seconds
        self.metrics_file = LOGS_DIR / "metrics.json"
    
    async def start(self):
        """Start the monitoring service."""
        if self.is_running:
            return
        
        self.is_running = True
        logger.info("Starting monitoring service")
        
        # Start background collection task
        asyncio.create_task(self._collection_loop())
    
    async def stop(self):
        """Stop the monitoring service."""
        self.is_running = False
        logger.info("Stopping monitoring service")
    
    async def _collection_loop(self):
        """Background loop for collecting metrics."""
        while self.is_running:
            try:
                # Collect system metrics
                self.metrics_collector.collect_system_metrics()
                
                # Collect application metrics
                self.metrics_collector.collect_application_metrics()
                
                # Save metrics to file periodically
                if len(self.metrics_collector.system_metrics) % 10 == 0:
                    await self._save_metrics()
                
                await asyncio.sleep(self.collection_interval)
                
            except Exception as e:
                logger.error(f"Error in metrics collection loop: {e}")
                await asyncio.sleep(5)  # Short delay before retrying
    
    async def _save_metrics(self):
        """Save current metrics to file."""
        try:
            summary = self.metrics_collector.get_metrics_summary()
            
            with open(self.metrics_file, 'w') as f:
                json.dump(summary, f, indent=2, default=str)
                
        except Exception as e:
            logger.error(f"Error saving metrics: {e}")
    
    async def get_health_status(self) -> Dict[str, Any]:
        """Get current health status."""
        return await self.health_checker.run_health_checks()
    
    async def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics summary."""
        return self.metrics_collector.get_metrics_summary()

# Global monitoring service instance
monitoring_service = MonitoringService()

# Utility functions
async def start_monitoring():
    """Start the global monitoring service."""
    await monitoring_service.start()

async def stop_monitoring():
    """Stop the global monitoring service."""
    await monitoring_service.stop()

def record_api_call(method: str, endpoint: str, status_code: int, response_time: float, user_agent: str = None):
    """Record an API call for monitoring."""
    monitoring_service.metrics_collector.record_api_call(method, endpoint, status_code, response_time, user_agent)

def record_error(error_type: str, error_message: str, context: Dict = None):
    """Record an error for monitoring."""
    monitoring_service.metrics_collector.record_error(error_type, error_message, context)

def record_timing(operation: str, duration: float):
    """Record timing for an operation."""
    monitoring_service.metrics_collector.record_timing(operation, duration)

# Context manager for timing operations
class TimingContext:
    """Context manager for timing operations."""
    
    def __init__(self, operation_name: str):
        self.operation_name = operation_name
        self.start_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.start_time:
            duration = time.time() - self.start_time
            record_timing(self.operation_name, duration)

# Decorator for timing functions
def time_operation(operation_name: str = None):
    """Decorator to time function execution."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            name = operation_name or f"{func.__module__}.{func.__name__}"
            with TimingContext(name):
                return func(*args, **kwargs)
        return wrapper
    return decorator 