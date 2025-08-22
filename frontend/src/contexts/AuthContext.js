import React, { createContext, useContext, useState, useEffect } from 'react';
import logger from '../utils/logger';

// Security helpers
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>'"]/g, '').trim().substring(0, 255);
};

// Track login attempts to prevent brute force attacks
const loginAttemptTracker = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const canAttemptLogin = (identifier) => {
  const attemptData = loginAttemptTracker.get(identifier);
  if (!attemptData) return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  
  const now = Date.now();
  if (attemptData.lockedUntil && now > attemptData.lockedUntil) {
    loginAttemptTracker.delete(identifier);
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }
  
  if (attemptData.lockedUntil && now < attemptData.lockedUntil) {
    const remainingTime = Math.ceil((attemptData.lockedUntil - now) / 60000);
    return { 
      allowed: false, 
      remainingAttempts: 0,
      message: `Account locked. Try again in ${remainingTime} minutes.`
    };
  }
  
  const remainingAttempts = MAX_LOGIN_ATTEMPTS - attemptData.count;
  return { allowed: remainingAttempts > 0, remainingAttempts: Math.max(0, remainingAttempts) };
};

const recordFailedAttempt = (identifier) => {
  const now = Date.now();
  const attemptData = loginAttemptTracker.get(identifier) || { count: 0, firstAttempt: now };
  attemptData.count++;
  attemptData.lastAttempt = now;
  if (attemptData.count >= MAX_LOGIN_ATTEMPTS) {
    attemptData.lockedUntil = now + LOCKOUT_DURATION;
  }
  loginAttemptTracker.set(identifier, attemptData);
};

const recordSuccessfulLogin = (identifier) => {
  loginAttemptTracker.delete(identifier);
};

const AuthContext = createContext();

// Configuration
const AUTH_CONFIG = {
  API_URL: process.env.REACT_APP_API_URL || '/api',
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes before expiry
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development'
};

// Test credentials for development
const TEST_CREDENTIALS = {
  'admin': { password: 'admin123', role: 'admin', email: 'admin@mavis.com' },
  'user': { password: 'user123', role: 'user', email: 'user@mavis.com' },
  'demo': { password: 'demo123', role: 'demo', email: 'demo@mavis.com' },
  'test': { password: 'test123', role: 'user', email: 'test@mavis.com' }
};

// Storage for registered users (development only)
const getRegisteredUsers = () => {
  if (!AUTH_CONFIG.IS_DEVELOPMENT) return {};
  try {
    const stored = localStorage.getItem('mavis_registered_users');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load registered users:', error);
    return {};
  }
};

const saveRegisteredUsers = (users) => {
  if (!AUTH_CONFIG.IS_DEVELOPMENT) return;
  try {
    localStorage.setItem('mavis_registered_users', JSON.stringify(users));
  } catch (error) {
    console.error('Failed to save registered users:', error);
  }
};

// Storage for pending email verifications (development only)
const getPendingVerifications = () => {
  if (!AUTH_CONFIG.IS_DEVELOPMENT) return {};
  try {
    const stored = localStorage.getItem('mavis_pending_verifications');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load pending verifications:', error);
    return {};
  }
};

const savePendingVerifications = (verifications) => {
  if (!AUTH_CONFIG.IS_DEVELOPMENT) return;
  try {
    localStorage.setItem('mavis_pending_verifications', JSON.stringify(verifications));
  } catch (error) {
    console.error('Failed to save pending verifications:', error);
  }
};

// Simulate email sending (development only)
const simulateEmailSending = (email, username, verificationToken) => {
  if (!AUTH_CONFIG.IS_DEVELOPMENT) return;
  
  logger.info('📧 EMAIL SIMULATION - Registration Confirmation');
  logger.info('=====================================');
  logger.info(`To: ${email}`);
  logger.info(`Subject: Welcome to MAVIS - Please Confirm Your Email`);
  logger.info('');
  logger.info(`Dear ${username},`);
  logger.info('');
  logger.info('Thank you for registering with MAVIS! To complete your registration,');
  logger.info('please confirm your email address by clicking the link below:');
  logger.info('');
  logger.info(`Verification Link: ${window.location.origin}/?verify=${verificationToken}`);
  logger.info('');
  logger.info('If you did not create this account, please ignore this email.');
  logger.info('');
  logger.info('Best regards,');
  logger.info('The MAVIS Team');
  logger.info('=====================================');
  
  // Also show a browser notification if supported
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('MAVIS Registration', {
      body: `Confirmation email sent to ${email}`,
      icon: '/favicon.ico'
    });
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Secure token storage utilities
const TokenStorage = {
  setToken: (token, refreshToken) => {
    try {
      // In production, consider using secure HTTP-only cookies
      const tokenData = {
        token,
        refreshToken,
        timestamp: Date.now(),
        expiresAt: Date.now() + AUTH_CONFIG.SESSION_TIMEOUT
      };
      
      if (AUTH_CONFIG.IS_DEVELOPMENT) {
        localStorage.setItem('mavis_token', JSON.stringify(tokenData));
      } else {
        // For production, use sessionStorage or secure cookies
        sessionStorage.setItem('mavis_token', JSON.stringify(tokenData));
      }
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  },

  getToken: () => {
    try {
      const storage = AUTH_CONFIG.IS_DEVELOPMENT ? localStorage : sessionStorage;
      const tokenData = storage.getItem('mavis_token');
      if (!tokenData) return null;

      const parsed = JSON.parse(tokenData);
      
      // Check if token is expired
      if (Date.now() > parsed.expiresAt) {
        TokenStorage.clearToken();
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('Failed to retrieve token:', error);
      return null;
    }
  },

  clearToken: () => {
    localStorage.removeItem('mavis_token');
    sessionStorage.removeItem('mavis_token');
    localStorage.removeItem('mavis_user');
    sessionStorage.removeItem('mavis_user');
  },

  isTokenExpiringSoon: (tokenData) => {
    if (!tokenData) return true;
    return (tokenData.expiresAt - Date.now()) < AUTH_CONFIG.TOKEN_REFRESH_THRESHOLD;
  }
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState(null);

  // Check for existing authentication on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const tokenData = TokenStorage.getToken();
        const storage = AUTH_CONFIG.IS_DEVELOPMENT ? localStorage : sessionStorage;
        const savedUser = storage.getItem('mavis_user');
        
        if (tokenData && savedUser) {
          const userData = JSON.parse(savedUser);
          
          // Check if token needs refresh
          if (TokenStorage.isTokenExpiringSoon(tokenData)) {
            await refreshToken(tokenData.refreshToken);
          }
          
          setUser(userData);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Auto token refresh and session management
  useEffect(() => {
    if (!isAuthenticated) return;

    // Session activity tracking
    const updateActivity = () => {
      if (isAuthenticated) {
        const storage = AUTH_CONFIG.IS_DEVELOPMENT ? localStorage : sessionStorage;
        storage.setItem('mavis_last_activity', Date.now().toString());
      }
    };

    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    // Token refresh interval
    const interval = setInterval(() => {
      const tokenData = TokenStorage.getToken();
      if (tokenData && TokenStorage.isTokenExpiringSoon(tokenData)) {
        refreshToken(tokenData.refreshToken);
      }

      // Check session expiry
      const storage = AUTH_CONFIG.IS_DEVELOPMENT ? localStorage : sessionStorage;
      const lastActivity = parseInt(storage.getItem('mavis_last_activity') || '0');
      const now = Date.now();
      const inactiveTime = now - lastActivity;
      
      if (inactiveTime > (AUTH_CONFIG.IS_DEVELOPMENT ? 2 * 60 * 60 * 1000 : 30 * 60 * 1000)) {
        logger.info('Session expired due to inactivity');
        logout();
      }
    }, 60000); // Check every minute

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  const authenticateUser = async (username, password) => {
    // Production API call
    try {
      const response = await fetch(`${AUTH_CONFIG.API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Authentication failed');
      }

      return await response.json();
    } catch (apiError) {
      // Fallback to test credentials in development or if API fails
      if (AUTH_CONFIG.IS_DEVELOPMENT || apiError.message.includes('fetch')) {
        return authenticateTestUser(username, password);
      }
      throw apiError;
    }
  };

  const authenticateTestUser = (username, password) => {
    // Check test credentials first
    const testUser = TEST_CREDENTIALS[username.toLowerCase()];
    
    // Check registered users
    const registeredUsers = getRegisteredUsers();
    const registeredUser = registeredUsers[username.toLowerCase()];
    
    let userData = null;
    
    if (testUser && testUser.password === password) {
      userData = testUser;
    } else if (registeredUser && registeredUser.password === password) {
      userData = registeredUser;
    }
    
    if (!userData) {
      throw new Error('Invalid credentials');
    }

    // Simulate successful authentication response
    return {
      success: true,
      token: `mock_token_${username}_${Date.now()}`,
      refreshToken: `mock_refresh_${username}_${Date.now()}`,
      user: {
        id: testUser ? Object.keys(TEST_CREDENTIALS).indexOf(username.toLowerCase()) + 1 : Date.now(),
        username: username,
        email: userData.email,
        role: userData.role || 'user',
        fullName: userData.fullName || username,
        loginTime: new Date().toISOString(),
        isTestUser: AUTH_CONFIG.IS_DEVELOPMENT,
        isRegisteredUser: !!registeredUser
      }
    };
  };

  const registerUser = async (userData) => {
    setLoading(true);
    setError(null);

    try {
      const { username, password, email, fullName } = userData;

      // Sanitize inputs
      const cleanUsername = sanitizeInput(username);
      const cleanEmail = sanitizeInput(email);
      const cleanFullName = sanitizeInput(fullName);

      if (!cleanUsername || !password || !cleanEmail || !cleanFullName) {
        throw new Error('All fields are required');
      }

      // Check if user already exists
      const existingTestUser = TEST_CREDENTIALS[cleanUsername.toLowerCase()];
      const registeredUsers = getRegisteredUsers();
      const existingRegisteredUser = registeredUsers[cleanUsername.toLowerCase()];

      if (existingTestUser || existingRegisteredUser) {
        throw new Error('Username already exists');
      }

      // Check email uniqueness
      const emailExists = Object.values(TEST_CREDENTIALS).some(user => user.email === cleanEmail) ||
                         Object.values(registeredUsers).some(user => user.email === cleanEmail);

      if (emailExists) {
        throw new Error('Email address already registered');
      }

      if (AUTH_CONFIG.IS_DEVELOPMENT) {
        // Generate verification token
        const verificationToken = crypto.getRandomValues(new Uint32Array(4)).join('');
        
        // Store in pending verifications
        const pendingVerifications = getPendingVerifications();
        pendingVerifications[verificationToken] = {
          username: cleanUsername,
          password: password, // In production, this would be hashed
          email: cleanEmail,
          fullName: cleanFullName,
          role: 'user',
          registeredAt: new Date().toISOString(),
          expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };
        savePendingVerifications(pendingVerifications);

        // Simulate sending confirmation email
        simulateEmailSending(cleanEmail, cleanUsername, verificationToken);

        // Return success without auto-login
        setError(null);
        setLoading(false);
        
        // Return a special response indicating email confirmation needed
        return {
          success: true,
          requiresEmailConfirmation: true,
          email: cleanEmail,
          message: 'Registration successful! Please check your email to confirm your account.'
        };

      } else {
        // Production API call
        const response = await fetch(`${AUTH_CONFIG.API_URL}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: cleanUsername,
            password: password,
            email: cleanEmail,
            fullName: cleanFullName
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Registration failed');
        }

        const result = await response.json();
        
        if (result.success) {
          // Handle successful registration
          if (result.requiresEmailConfirmation) {
            setError(null);
            return {
              success: true,
              requiresEmailConfirmation: true,
              email: cleanEmail,
              message: result.message || 'Registration successful! Please check your email to confirm your account.'
            };
          } else if (result.autoLogin) {
            // Auto-login if email confirmation not required
            TokenStorage.setToken(result.token, result.refreshToken);
            const storage = sessionStorage;
            storage.setItem('mavis_user', JSON.stringify(result.user));
            setUser(result.user);
            setIsAuthenticated(true);
          }
          setError(null);
        } else {
          throw new Error(result.message || 'Registration failed');
        }
      }

    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
      setIsAuthenticated(false);
      setUser(null);
      TokenStorage.clearToken();
      throw err; // Re-throw to handle in component
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async (verificationToken) => {
    setLoading(true);
    setError(null);

    try {
      if (AUTH_CONFIG.IS_DEVELOPMENT) {
        const pendingVerifications = getPendingVerifications();
        const verification = pendingVerifications[verificationToken];

        if (!verification) {
          throw new Error('Invalid or expired verification token');
        }

        if (Date.now() > verification.expiresAt) {
          // Clean up expired token
          delete pendingVerifications[verificationToken];
          savePendingVerifications(pendingVerifications);
          throw new Error('Verification token has expired. Please register again.');
        }

        // Move user from pending to registered
        const registeredUsers = getRegisteredUsers();
        registeredUsers[verification.username.toLowerCase()] = {
          password: verification.password,
          email: verification.email,
          fullName: verification.fullName,
          role: verification.role,
          registeredAt: verification.registeredAt,
          emailVerified: true,
          emailVerifiedAt: new Date().toISOString()
        };
        saveRegisteredUsers(registeredUsers);

        // Clean up pending verification
        delete pendingVerifications[verificationToken];
        savePendingVerifications(pendingVerifications);

        // Auto-login the verified user
        const authResponse = {
          success: true,
          token: `mock_token_${verification.username}_${Date.now()}`,
          refreshToken: `mock_refresh_${verification.username}_${Date.now()}`,
          user: {
            id: Date.now(),
            username: verification.username,
            email: verification.email,
            role: verification.role,
            fullName: verification.fullName,
            loginTime: new Date().toISOString(),
            isTestUser: false,
            isRegisteredUser: true,
            emailVerified: true
          }
        };

        // Store tokens and user data
        TokenStorage.setToken(authResponse.token, authResponse.refreshToken);
        const storage = AUTH_CONFIG.IS_DEVELOPMENT ? localStorage : sessionStorage;
        storage.setItem('mavis_user', JSON.stringify(authResponse.user));

        setUser(authResponse.user);
        setIsAuthenticated(true);
        setError(null);

        return { success: true, message: 'Email verified successfully! Welcome to MAVIS.' };

      } else {
        // Production API call
        const response = await fetch(`${AUTH_CONFIG.API_URL}/auth/verify-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: verificationToken }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Email verification failed');
        }

        const result = await response.json();
        
        if (result.success) {
          if (result.autoLogin) {
            TokenStorage.setToken(result.token, result.refreshToken);
            const storage = sessionStorage;
            storage.setItem('mavis_user', JSON.stringify(result.user));
            setUser(result.user);
            setIsAuthenticated(true);
          }
          setError(null);
          return result;
        } else {
          throw new Error(result.message || 'Email verification failed');
        }
      }

    } catch (err) {
      console.error('Email verification error:', err);
      setError(err.message || 'Email verification failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resendVerificationEmail = async (email) => {
    setLoading(true);
    setError(null);

    try {
      if (AUTH_CONFIG.IS_DEVELOPMENT) {
        const pendingVerifications = getPendingVerifications();
        
        // Find pending verification by email
        let foundVerification = null;
        let foundToken = null;
        
        for (const [token, verification] of Object.entries(pendingVerifications)) {
          if (verification.email === email) {
            foundVerification = verification;
            foundToken = token;
            break;
          }
        }

        if (!foundVerification) {
          throw new Error('No pending verification found for this email address');
        }

        // Generate new token and extend expiry
        const newVerificationToken = crypto.getRandomValues(new Uint32Array(4)).join('');
        
        // Remove old token
        delete pendingVerifications[foundToken];
        
        // Add new token with extended expiry
        pendingVerifications[newVerificationToken] = {
          ...foundVerification,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
        };
        
        savePendingVerifications(pendingVerifications);

        // Simulate sending new confirmation email
        simulateEmailSending(email, foundVerification.username, newVerificationToken);

        setError(null);
        return {
          success: true,
          message: 'Verification email resent successfully! Please check your inbox.'
        };

      } else {
        // Production API call
        const response = await fetch(`${AUTH_CONFIG.API_URL}/auth/resend-verification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to resend verification email');
        }

        const result = await response.json();
        setError(null);
        return result;
      }

    } catch (err) {
      console.error('Resend verification error:', err);
      setError(err.message || 'Failed to resend verification email. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    setLoading(true);
    setError(null);

    try {
      // Sanitize inputs
      const cleanUsername = sanitizeInput(username);
      const cleanPassword = sanitizeInput(password);

      if (!cleanUsername || !cleanPassword) {
        throw new Error('Username and password are required');
      }

      // Check rate limiting
      const attemptCheck = canAttemptLogin(cleanUsername);
      if (!attemptCheck.allowed) {
        throw new Error(attemptCheck.message || 'Too many failed attempts. Please try again later.');
      }

      const authResponse = await authenticateUser(cleanUsername, cleanPassword);

      if (authResponse.success) {
        const { token, refreshToken, user: userData } = authResponse;

        // Record successful login
        recordSuccessfulLogin(cleanUsername);

        // Store tokens securely
        TokenStorage.setToken(token, refreshToken);

        // Store user data with additional security info
        const enhancedUserData = {
          ...userData,
          lastLogin: new Date().toISOString(),
          sessionId: crypto.getRandomValues(new Uint32Array(1))[0].toString(16),
          securityLevel: AUTH_CONFIG.IS_DEVELOPMENT ? 'development' : 'production'
        };

        const storage = AUTH_CONFIG.IS_DEVELOPMENT ? localStorage : sessionStorage;
        storage.setItem('mavis_user', JSON.stringify(enhancedUserData));

        setUser(enhancedUserData);
        setIsAuthenticated(true);
        setError(null);
      } else {
        // Record failed attempt
        recordFailedAttempt(cleanUsername);
        throw new Error(authResponse.message || 'Authentication failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      
      // Record failed attempt if username was provided
      if (username) {
        recordFailedAttempt(sanitizeInput(username));
      }
      
      setError(err.message || 'Login failed. Please try again.');
      setIsAuthenticated(false);
      setUser(null);
      TokenStorage.clearToken();
    } finally {
      setLoading(false);
    }
  };

  const refreshToken = async (refreshToken) => {
    try {
      // In production, call refresh token API
      const response = await fetch(`${AUTH_CONFIG.API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const { token, refreshToken: newRefreshToken } = await response.json();
        TokenStorage.setToken(token, newRefreshToken);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    
    // If refresh fails, logout user
    logout();
    return false;
  };

  const logout = () => {
    try {
      // Call logout API in production
      if (!AUTH_CONFIG.IS_DEVELOPMENT) {
        fetch(`${AUTH_CONFIG.API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TokenStorage.getToken()?.token}`,
          },
        }).catch(error => console.error('Logout API call failed:', error));
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local data
      TokenStorage.clearToken();
      setIsAuthenticated(false);
      setUser(null);
      setError(null);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const isTokenValid = () => {
    const tokenData = TokenStorage.getToken();
    return tokenData && Date.now() < tokenData.expiresAt;
  };

  const getLoginAttemptInfo = (username) => {
    const cleanUsername = sanitizeInput(username);
    return canAttemptLogin(cleanUsername);
  };

  const getSecurityInfo = () => {
    const tokenData = TokenStorage.getToken();
    const storage = AUTH_CONFIG.IS_DEVELOPMENT ? localStorage : sessionStorage;
    const lastActivity = parseInt(storage.getItem('mavis_last_activity') || Date.now().toString());
    
    return {
      hasValidToken: !!tokenData,
      tokenExpiresAt: tokenData?.expiresAt,
      lastActivity: new Date(lastActivity),
      isProduction: !AUTH_CONFIG.IS_DEVELOPMENT,
      sessionTimeoutMs: AUTH_CONFIG.IS_DEVELOPMENT ? 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000,
      inactivityTimeoutMs: AUTH_CONFIG.IS_DEVELOPMENT ? 2 * 60 * 60 * 1000 : 30 * 60 * 1000,
      maxLoginAttempts: MAX_LOGIN_ATTEMPTS,
      lockoutDurationMs: LOCKOUT_DURATION
    };
  };

  const value = {
    isAuthenticated,
    user,
    loading,
    error,
    login,
    logout,
    clearError,
    isTokenValid,
    getLoginAttemptInfo,
    getSecurityInfo,
    testCredentials: AUTH_CONFIG.IS_DEVELOPMENT ? TEST_CREDENTIALS : null,
    isProduction: !AUTH_CONFIG.IS_DEVELOPMENT,
    register: registerUser,
    verifyEmail: verifyEmail,
    resendVerificationEmail: resendVerificationEmail
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 