"""Middleware for request logging and monitoring."""
import time
import uuid
import json
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi import FastAPI

from .logging_config import get_logger, LoggerAdapter

logger = get_logger("middleware")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging HTTP requests and responses."""
    
    def __init__(
        self,
        app: FastAPI,
        log_requests: bool = True,
        log_responses: bool = True,
        log_request_body: bool = False,
        log_response_body: bool = False,
        max_body_size: int = 1024,
        exclude_paths: list = None
    ):
        super().__init__(app)
        self.log_requests = log_requests
        self.log_responses = log_responses
        self.log_request_body = log_request_body
        self.log_response_body = log_response_body
        self.max_body_size = max_body_size
        self.exclude_paths = exclude_paths or ["/health", "/docs", "/openapi.json"]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        
        # Add request ID to request state
        request.state.request_id = request_id
        
        # Skip logging for excluded paths
        if request.url.path in self.exclude_paths:
            return await call_next(request)
        
        # Create logger adapter with request context
        request_logger = LoggerAdapter(logger, {
            'request_id': request_id,
            'method': request.method,
            'endpoint': request.url.path,
        })
        
        start_time = time.time()
        
        # Log request
        if self.log_requests:
            await self._log_request(request, request_logger)
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Log response
            if self.log_responses:
                await self._log_response(request, response, duration, request_logger)
            
            return response
            
        except Exception as e:
            # Calculate duration for failed requests
            duration = time.time() - start_time
            
            # Log error
            request_logger.error(
                f"Request failed: {str(e)}",
                extra={
                    'duration': duration,
                    'status_code': 500,
                    'error': str(e)
                },
                exc_info=True
            )
            
            raise
    
    async def _log_request(self, request: Request, request_logger: LoggerAdapter):
        """Log incoming request details."""
        log_data = {
            'user_agent': request.headers.get('user-agent'),
            'content_type': request.headers.get('content-type'),
            'content_length': request.headers.get('content-length'),
            'remote_addr': getattr(request.client, 'host', None) if request.client else None,
            'query_params': dict(request.query_params),
        }
        
        # Log request body if enabled and not too large
        if self.log_request_body and request.headers.get('content-type', '').startswith('application/json'):
            try:
                # Read body
                body = await request.body()
                if len(body) <= self.max_body_size:
                    try:
                        log_data['request_body'] = body.decode('utf-8')[:self.max_body_size]
                    except UnicodeDecodeError:
                        log_data['request_body'] = f"<Binary body: {len(body)} bytes>"
                else:
                    log_data['request_body'] = f"<Body too large: {len(body)} bytes>"
            except Exception as e:
                log_data['request_body'] = f"<Error reading body: {e}>"
        
        request_logger.info(
            f"Incoming request: {request.method} {request.url.path}",
            extra=log_data
        )
    
    async def _log_response(self, request: Request, response: Response, duration: float, request_logger: LoggerAdapter):
        """Log outgoing response details."""
        log_level = "info"
        if response.status_code >= 400:
            log_level = "warning" if response.status_code < 500 else "error"
        
        log_data = {
            'status_code': response.status_code,
            'duration': round(duration, 3),
            'response_size': response.headers.get('content-length'),
        }
        
        # Log response body if enabled (for debugging)
        if self.log_response_body and hasattr(response, 'body'):
            try:
                if hasattr(response.body, '__len__') and len(response.body) <= self.max_body_size:
                    try:
                        log_data['response_body'] = response.body.decode('utf-8')[:self.max_body_size]
                    except UnicodeDecodeError:
                        log_data['response_body'] = f"<Binary response: {len(response.body)} bytes>"
                else:
                    log_data['response_body'] = "<Response body too large or not available>"
            except Exception:
                log_data['response_body'] = "<Error reading response body>"
        
        message = f"Request completed: {request.method} {request.url.path} - {response.status_code} in {duration:.3f}s"
        
        getattr(request_logger, log_level)(message, extra=log_data)


class ErrorLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging unhandled errors."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            return await call_next(request)
        except Exception as e:
            # Log unhandled errors
            error_logger = LoggerAdapter(logger, {
                'request_id': getattr(request.state, 'request_id', 'unknown'),
                'method': request.method,
                'endpoint': request.url.path,
            })
            
            error_logger.error(
                f"Unhandled error in request: {str(e)}",
                extra={
                    'error_type': type(e).__name__,
                    'error_message': str(e),
                    'user_agent': request.headers.get('user-agent'),
                    'remote_addr': getattr(request.client, 'host', None) if request.client else None,
                },
                exc_info=True
            )
            
            raise 