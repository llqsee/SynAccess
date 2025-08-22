"""Logging setup for the MAVIS backend.

This module handles all the logging configuration, including file rotation,
JSON formatting, and console output. It's used throughout the app to
keep track of what's happening.
"""
import logging
import logging.handlers
import sys
import os
from pathlib import Path
from datetime import datetime
import json
from typing import Any, Dict


class JSONFormatter(logging.Formatter):
    """Formats log messages as JSON for easier parsing."""
    
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Add extra fields
        if hasattr(record, 'user_id'):
            log_entry['user_id'] = record.user_id
        if hasattr(record, 'request_id'):
            log_entry['request_id'] = record.request_id
        if hasattr(record, 'job_id'):
            log_entry['job_id'] = record.job_id
        if hasattr(record, 'duration'):
            log_entry['duration'] = record.duration
        if hasattr(record, 'method'):
            log_entry['method'] = record.method
        if hasattr(record, 'endpoint'):
            log_entry['endpoint'] = record.endpoint
        if hasattr(record, 'status_code'):
            log_entry['status_code'] = record.status_code
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        # Add file and line info
        log_entry['file'] = f"{record.filename}:{record.lineno}"
        
        return json.dumps(log_entry)


def setup_logging(
    log_level: str = "INFO",
    log_file: str = None,
    max_file_size: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5,
    enable_console: bool = True,
    enable_json: bool = False
):
    """
    Setup logging configuration for the application.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Path to log file (optional)
        max_file_size: Maximum size of log file before rotation
        backup_count: Number of backup files to keep
        enable_console: Whether to enable console logging
        enable_json: Whether to use JSON formatting
    """
    # Convert string level to logging constant
    level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Clear any existing handlers
    logging.getLogger().handlers.clear()
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    
    # Create formatters
    if enable_json:
        formatter = JSONFormatter()
    else:
        formatter = logging.Formatter(
            fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    # Console handler
    if enable_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(level)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
    
    # File handler with rotation
    if log_file:
        # Ensure log directory exists
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        file_handler = logging.handlers.RotatingFileHandler(
            filename=log_file,
            maxBytes=max_file_size,
            backupCount=backup_count,
            encoding='utf-8'
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    
    # Set specific logger levels for third-party libraries
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("fastapi").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy").setLevel(logging.WARNING)
    
    # Add filter to suppress connection reset errors during shutdown
    class ConnectionResetFilter(logging.Filter):
        def filter(self, record):
            # Suppress common connection reset errors that occur during shutdown
            if hasattr(record, 'exc_info') and record.exc_info:
                exc_type, exc_value, _ = record.exc_info
                if exc_type and issubclass(exc_type, ConnectionResetError):
                    # Suppress if it's the common Windows connection reset error
                    if "WinError 10054" in str(exc_value) or "forcibly closed by the remote host" in str(exc_value):
                        return False
            
            # Suppress asyncio callback connection lost errors during shutdown
            if "ProactorBasePipeTransport._call_connection_lost" in record.getMessage():
                return False
            
            return True
    
    # Apply the filter to asyncio logger
    asyncio_logger = logging.getLogger("asyncio")
    asyncio_logger.addFilter(ConnectionResetFilter())
    asyncio_logger.setLevel(logging.WARNING)
    
    # Create application-specific loggers
    app_logger = logging.getLogger("mavis")
    app_logger.setLevel(level)
    
    return app_logger


def get_logger(name: str = None) -> logging.Logger:
    """Get a logger instance for the given name."""
    if name:
        return logging.getLogger(f"mavis.{name}")
    return logging.getLogger("mavis")


class LoggerAdapter(logging.LoggerAdapter):
    """Logger adapter for adding context to log messages."""
    
    def __init__(self, logger, extra=None):
        super().__init__(logger, extra or {})
    
    def process(self, msg, kwargs):
        # Add extra context to log record
        if 'extra' not in kwargs:
            kwargs['extra'] = {}
        kwargs['extra'].update(self.extra)
        return msg, kwargs


def setup_request_logging():
    """Setup request logging middleware configuration."""
    return {
        'log_requests': True,
        'log_responses': True,
        'log_request_body': False,  # Set to True for debugging, False for production
        'log_response_body': False,  # Set to True for debugging, False for production
        'max_body_size': 1024,  # Max body size to log in bytes
    } 