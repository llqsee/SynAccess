/**
 * Simple logging utility for the frontend
 * 
 * This provides consistent logging across the app without
 * needing external dependencies.
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const debugEnabled = process.env.REACT_APP_DEBUG === '1' || isDevelopment;

const createEntry = (level, message, extra = {}) => ({
  timestamp: new Date().toISOString(),
  level: level.toUpperCase(),
  message,
  ...extra
});

const safeConsole = {
  debug: (...args) => { if (debugEnabled && console && console.debug) console.debug(...args); },
  info: (...args) => { if (console && console.info) console.info(...args); },
  warn: (...args) => { if (console && console.warn) console.warn(...args); },
  error: (...args) => { if (console && console.error) console.error(...args); }
};

const logger = {
  debug: (message, extra = {}) => safeConsole.debug(message, createEntry('debug', message, extra)),
  info: (message, extra = {}) => safeConsole.info(message, createEntry('info', message, extra)),
  warn: (message, extra = {}) => safeConsole.warn(message, createEntry('warn', message, extra)),
  error: (message, error = null, extra = {}) => {
    const payload = { ...extra };
    if (error) payload.error = { name: error.name, message: error.message, stack: error.stack };
    safeConsole.error(message, createEntry('error', message, payload));
  },
  apiRequest: (method, url, data = null) => safeConsole.info(`API Request: ${method} ${url}`, createEntry('info', 'api_request', { method, url, data })),
  apiResponse: (method, url, status, data = null, duration = null) => {
    const level = status >= 400 ? 'error' : 'info';
    safeConsole[level](`API Response: ${method} ${url} - ${status}`, createEntry(level, 'api_response', { method, url, status, duration }));
  },
  apiError: (method, url, error, extra = {}) => safeConsole.error(`API Error: ${method} ${url}`, createEntry('error', 'api_error', { method, url, error: { name: error.name, message: error.message }, ...extra }))
};

export const configureLogger = () => {};
export const getLogLevel = () => (debugEnabled ? 'debug' : 'info');
export default logger; 