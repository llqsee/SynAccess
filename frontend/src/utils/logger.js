/**
 * Logging service for the MAVIS frontend
 * Provides structured logging, error tracking, and user interaction logging
 */

import log from 'loglevel';

// Configure log level based on environment
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Set default log level
if (isDevelopment) {
  log.setLevel('debug');
} else if (isProduction) {
  log.setLevel('warn');
} else {
  log.setLevel('info');
}

// Create structured log entry
const createLogEntry = (level, message, extra = {}) => ({
  timestamp: new Date().toISOString(),
  level: level.toUpperCase(),
  message,
  url: window.location.href,
  ...extra
});

// Enhanced logging methods
const logger = {
  // Basic logging methods
  debug: (message, extra = {}) => {
    const entry = createLogEntry('debug', message, extra);
    log.debug(message, entry);
  },

  info: (message, extra = {}) => {
    const entry = createLogEntry('info', message, extra);
    log.info(message, entry);
  },

  warn: (message, extra = {}) => {
    const entry = createLogEntry('warn', message, extra);
    log.warn(message, entry);
  },

  error: (message, error = null, extra = {}) => {
    const entry = createLogEntry('error', message, {
      ...extra,
      error: error ? { name: error.name, message: error.message, stack: error.stack } : null
    });
    log.error(message, entry);
    
    // Send error to backend or error tracking service if needed
    if (isProduction && error) {
      // Could send to backend error tracking endpoint
      // sendErrorToBackend(entry);
    }
  },

  // API request/response logging
  apiRequest: (method, url, data = null) => {
    const entry = createLogEntry('info', `API Request: ${method} ${url}`, {
      type: 'api_request',
      method,
      url,
      data: data ? JSON.stringify(data).substring(0, 200) : null
    });
    log.info(`API Request: ${method} ${url}`, entry);
  },

  apiResponse: (method, url, status, data = null, duration = null) => {
    const level = status >= 400 ? 'error' : 'info';
    const entry = createLogEntry(level, `API Response: ${method} ${url} - ${status}`, {
      type: 'api_response',
      method,
      url,
      status,
      duration
    });
    log[level](`API Response: ${method} ${url} - ${status}`, entry);
  },

  apiError: (method, url, error, extra = {}) => {
    const entry = createLogEntry('error', `API Error: ${method} ${url}`, {
      type: 'api_error',
      method,
      url,
      error: { name: error.name, message: error.message },
      ...extra
    });
    log.error(`API Error: ${method} ${url}`, entry);
  },

  // User interaction logging
  userAction: (action, details = {}) => {
    const entry = createLogEntry('info', `User Action: ${action}`, {
      type: 'user_action',
      action,
      ...details
    });
    log.info(`User Action: ${action}`, entry);
  },

  // Performance logging
  performance: (metric, value, extra = {}) => {
    const entry = createLogEntry('info', `Performance: ${metric} = ${value}`, {
      type: 'performance',
      metric,
      value,
      ...extra
    });
    log.info(`Performance: ${metric} = ${value}`, entry);
  },

  // Component lifecycle logging
  componentMount: (componentName, props = {}) => {
    const entry = createLogEntry('debug', `Component Mounted: ${componentName}`, {
      type: 'component_lifecycle',
      event: 'mount',
      component: componentName,
      props: Object.keys(props)
    });
    log.debug(`Component Mounted: ${componentName}`, entry);
  },

  componentUnmount: (componentName) => {
    const entry = createLogEntry('debug', `Component Unmounted: ${componentName}`, {
      type: 'component_lifecycle',
      event: 'unmount',
      component: componentName
    });
    log.debug(`Component Unmounted: ${componentName}`, entry);
  },

  // Data flow logging
  dataFlow: (action, data = null, extra = {}) => {
    const entry = createLogEntry('debug', `Data Flow: ${action}`, {
      type: 'data_flow',
      action,
      data: data ? JSON.stringify(data).substring(0, 200) : null,
      ...extra
    });
    log.debug(`Data Flow: ${action}`, entry);
  },

  // Job/embedding specific logging
  jobStart: (jobName, method, params = {}) => {
    const entry = createLogEntry('info', `Job Started: ${jobName}`, {
      type: 'job_lifecycle',
      event: 'start',
      jobName,
      method,
      params
    });
    log.info(`Job Started: ${jobName}`, entry);
  },

  jobComplete: (jobName, duration, results = {}) => {
    const entry = createLogEntry('info', `Job Completed: ${jobName}`, {
      type: 'job_lifecycle',
      event: 'complete',
      jobName,
      duration,
      results: Object.keys(results)
    });
    log.info(`Job Completed: ${jobName}`, entry);
  },

  jobError: (jobName, error, extra = {}) => {
    const entry = createLogEntry('error', `Job Failed: ${jobName}`, {
      type: 'job_lifecycle',
      event: 'error',
      jobName,
      error: { name: error.name, message: error.message },
      ...extra
    });
    log.error(`Job Failed: ${jobName}`, entry);
  }
};

// Global error handler
window.addEventListener('error', (event) => {
  logger.error('Global Error', event.error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled Promise Rejection', event.reason, {
    type: 'unhandled_rejection'
  });
});

// Export logger configuration functions
export const configureLogger = (level) => log.setLevel(level);
export const getLogLevel = () => log.getLevel();
export default logger; 