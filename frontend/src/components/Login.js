import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  Fade,
  Avatar,
  CircularProgress,
  Collapse,
  Card,
  CardContent,
  Chip,
  Grid,
  Tooltip,
  FormControlLabel,
  Checkbox,
  Link
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
  Person,
  Lock,
  Security,
  DeveloperMode,
  ExpandMore,
  ExpandLess,
  AdminPanelSettings,
  Group,
  Science,
  PersonAdd,
  Email
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Login = ({ onLogin, loading, error }) => {
  const { testCredentials, getLoginAttemptInfo, getSecurityInfo, isProduction, register, verifyEmail, resendVerificationEmail } = useAuth();
  
  // Check URL parameters to determine initial mode and verification token
  const getInitialMode = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('mode') !== 'register';
  };

  const getVerificationToken = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('verify');
  };

  const [isLoginMode, setIsLoginMode] = useState(getInitialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showTestCredentials, setShowTestCredentials] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registrationEmail, setRegistrationEmail] = useState(''); // Store email for resend
  const [attemptInfo, setAttemptInfo] = useState({ allowed: true, remainingAttempts: 5 });
  const securityInfo = getSecurityInfo();

  // Handle email verification on component mount
  useEffect(() => {
    const verificationToken = getVerificationToken();
    if (verificationToken) {
      handleEmailVerification(verificationToken);
    }
  }, []);

  const handleEmailVerification = async (token) => {
    try {
      setLocalError('');
      const result = await verifyEmail(token);
      if (result.success) {
        setSuccessMessage(result.message);
        setRegistrationSuccess(false); // Clear registration success state
        // Clear the verification token from URL
        const url = new URL(window.location);
        url.searchParams.delete('verify');
        window.history.replaceState({}, '', url);
      }
    } catch (err) {
      setLocalError(err.message || 'Email verification failed');
    }
  };

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const newMode = getInitialMode();
      setIsLoginMode(newMode);
      setLocalError('');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update URL when mode changes
  const updateURL = (loginMode) => {
    const url = new URL(window.location);
    if (loginMode) {
      url.searchParams.delete('mode');
    } else {
      url.searchParams.set('mode', 'register');
    }
    
    // Update URL without triggering a page reload
    window.history.pushState({ mode: loginMode ? 'login' : 'register' }, '', url);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError('');
    
    if (!username.trim()) {
      setLocalError('Username is required');
      return;
    }
    
    if (!password.trim()) {
      setLocalError('Password is required');
      return;
    }

    if (!isLoginMode) {
      // Registration validation
      if (!email.trim()) {
        setLocalError('Email is required');
        return;
      }

      if (!fullName.trim()) {
        setLocalError('Full name is required');
        return;
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setLocalError('Please enter a valid email address');
        return;
      }

      // Password confirmation
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }

      // Terms acceptance
      if (!acceptTerms) {
        setLocalError('Please accept the terms of service');
        return;
      }
    }
    
    // Check login attempts (for both login and registration)
    const currentAttemptInfo = getLoginAttemptInfo(username);
    setAttemptInfo(currentAttemptInfo);
    
    if (!currentAttemptInfo.allowed) {
      setLocalError(currentAttemptInfo.message || 'Too many failed attempts. Please try again later.');
      return;
    }
    
    // Password strength check (more lenient in dev)
    const minLength = isProduction ? 12 : 6;
    if (password.length < minLength) {
      setLocalError(`Password must be at least ${minLength} characters long`);
      return;
    }
    
    // Production password complexity check
    if (isProduction) {
      if (!/[A-Z]/.test(password)) {
        setLocalError('Password must contain at least one uppercase letter');
        return;
      }
      if (!/[a-z]/.test(password)) {
        setLocalError('Password must contain at least one lowercase letter');
        return;
      }
      if (!/\d/.test(password)) {
        setLocalError('Password must contain at least one number');
        return;
      }
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        setLocalError('Password must contain at least one special character');
        return;
      }
    }
    
    if (isLoginMode) {
      onLogin(username, password);
    } else {
      // Handle registration
      if (register) {
        register({
          username,
          password,
          email,
          fullName
        }).then((result) => {
          if (result && result.requiresEmailConfirmation) {
            setRegistrationSuccess(true);
            setSuccessMessage(result.message);
            setLocalError('');
            // Clear form
            setUsername('');
            setPassword('');
            setConfirmPassword('');
            setEmail('');
            setFullName('');
            setAcceptTerms(false);
            setRegistrationEmail(email); // Store email for resend
          }
        }).catch((err) => {
          // Error is already handled in the register function
          console.error('Registration failed:', err);
        });
      } else {
        setLocalError('Registration is not available at this time');
      }
    }
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  const handleToggleConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleModeSwitch = () => {
    const newMode = !isLoginMode;
    setIsLoginMode(newMode);
    setLocalError('');
    setPassword('');
    setConfirmPassword('');
    setEmail('');
    setFullName('');
    setAcceptTerms(false);
    updateURL(newMode);
  };

  const handleTestCredentialClick = (testUsername, testPassword) => {
    setUsername(testUsername);
    setPassword(testPassword);
    setLocalError('');
    setIsLoginMode(true); // Switch to login mode when using test credentials
    updateURL(true); // Update URL to login mode
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <AdminPanelSettings color="error" />;
      case 'user': return <Group color="primary" />;
      case 'demo': return <Science color="secondary" />;
      default: return <Person color="action" />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'error';
      case 'user': return 'primary';
      case 'demo': return 'secondary';
      default: return 'default';
    }
  };

  const handleResendVerification = async () => {
    if (!registrationEmail) {
      setLocalError('No email address available for resending verification');
      return;
    }

    try {
      setLocalError('');
      const result = await resendVerificationEmail(registrationEmail);
      if (result.success) {
        setSuccessMessage(result.message);
      }
    } catch (err) {
      setLocalError(err.message || 'Failed to resend verification email');
    }
  };

  return (
    <Box sx={{ 
      bgcolor: '#f8fafc', // Same as app background
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      py: 4
    }}>
      <Container maxWidth="sm">
        <Fade in timeout={1000}>
          <Paper sx={{ 
            borderRadius: 3, 
            overflow: 'hidden',
            bgcolor: '#ffffff', // Clean white background
            boxShadow: '0 4px 20px rgba(37, 99, 235, 0.1)', // Blue-tinted shadow
            border: '1px solid rgba(37, 99, 235, 0.1)' // Subtle blue border
          }}>
            {/* Header */}
            <Box sx={{ 
              bgcolor: '#2563eb', // Same blue as app primary color
              p: 4,
              textAlign: 'center',
              color: 'white'
            }}>
              <Avatar sx={{ 
                width: 80, 
                height: 80, 
                mx: 'auto', 
                mb: 2,
                bgcolor: 'rgba(255, 255, 255, 0.15)',
                border: '2px solid rgba(255, 255, 255, 0.3)'
              }}>
                {isLoginMode ? <Security sx={{ fontSize: 40 }} /> : <PersonAdd sx={{ fontSize: 40 }} />}
              </Avatar>
              <Typography variant="h4" component="h1" sx={{ 
                fontWeight: 600, // Slightly less bold to match app style
                mb: 1
              }}>
                MAVIS
              </Typography>
              <Typography variant="h6" sx={{ 
                opacity: 0.95,
                fontWeight: 400
              }}>
                {isLoginMode ? 'Secure Access Portal' : 'Create Your Account'}
              </Typography>
              <Typography variant="body2" sx={{ 
                opacity: 0.85,
                mt: 1
              }}>
                {isLoginMode 
                  ? 'Scalable Visualization & Explainability Platform'
                  : 'Join the MAVIS platform for advanced data visualization'
                }
              </Typography>
            </Box>

            {/* Login Form */}
            <Box sx={{ p: 4 }}>
              {/* Security Info Alerts */}
              {!attemptInfo.allowed && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  <Typography variant="body2">
                    Account temporarily locked due to multiple failed attempts.
                  </Typography>
                </Alert>
              )}

              {attemptInfo.allowed && attemptInfo.remainingAttempts < 5 && (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                  <Typography variant="body2">
                    {attemptInfo.remainingAttempts} login attempt{attemptInfo.remainingAttempts !== 1 ? 's' : ''} remaining before account lockout.
                  </Typography>
                </Alert>
              )}

              {/* Environment Indicator */}
              <Alert 
                severity={isProduction ? "info" : "warning"} 
                sx={{ mb: 2, borderRadius: 2 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Security sx={{ mr: 1, fontSize: '1rem' }} />
                  <Typography variant="caption">
                    <strong>{isProduction ? 'Production' : 'Development'} Mode</strong>
                    {isProduction ? 
                      ' - Enhanced security enabled' : 
                      ' - Test credentials available below'
                    }
                  </Typography>
                </Box>
              </Alert>

              {(error || localError) && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                  {error || localError}
                </Alert>
              )}

              {/* Success Message for Email Confirmation */}
              {successMessage && (
                <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Email sx={{ mr: 1, fontSize: '1rem' }} />
                    <Typography variant="body2">
                      {successMessage}
                    </Typography>
                  </Box>
                  {registrationSuccess && (
                    <>
                      <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
                        Check your email inbox and click the verification link to complete your registration.
                      </Typography>
                      <Box sx={{ mt: 2 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleResendVerification()}
                          disabled={loading}
                          startIcon={<Email />}
                          sx={{ borderRadius: 2 }}
                        >
                          Resend Verification Email
                        </Button>
                      </Box>
                    </>
                  )}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* Registration-only fields */}
                  {!isLoginMode && (
                    <>
                      <TextField
                        fullWidth
                        label="Full Name"
                        variant="outlined"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={loading}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Person color="action" />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                          }
                        }}
                      />

                      <TextField
                        fullWidth
                        label="Email Address"
                        type="email"
                        variant="outlined"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Email color="action" />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                          }
                        }}
                      />
                    </>
                  )}

                  <TextField
                    fullWidth
                    label="Username"
                    variant="outlined"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person color="action" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      }
                    }}
                  />

                  <TextField
                    fullWidth
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    variant="outlined"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={handleTogglePassword}
                            edge="end"
                            disabled={loading}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      }
                    }}
                  />

                  {/* Registration-only password confirmation */}
                  {!isLoginMode && (
                    <TextField
                      fullWidth
                      label="Confirm Password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      variant="outlined"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock color="action" />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={handleToggleConfirmPassword}
                              edge="end"
                              disabled={loading}
                            >
                              {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                        }
                      }}
                    />
                  )}

                  {/* Registration-only terms acceptance */}
                  {!isLoginMode && (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={acceptTerms}
                          onChange={(e) => setAcceptTerms(e.target.checked)}
                          color="primary"
                          disabled={loading}
                        />
                      }
                      label={
                        <Typography variant="body2" color="text.secondary">
                          I agree to the{' '}
                          <Link href="#" color="primary" underline="hover">
                            Terms of Service
                          </Link>
                          {' '}and{' '}
                          <Link href="#" color="primary" underline="hover">
                            Privacy Policy
                          </Link>
                        </Typography>
                      }
                    />
                  )}

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : (isLoginMode ? <LoginIcon /> : <PersonAdd />)}
                    sx={{
                      py: 1.5,
                      borderRadius: 2,
                      bgcolor: '#2563eb', // Same blue as app primary
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                      '&:hover': {
                        bgcolor: '#1d4ed8', // Darker blue on hover
                        transform: 'translateY(-1px)',
                        boxShadow: '0 6px 16px rgba(37, 99, 235, 0.4)',
                      },
                      '&:disabled': {
                        bgcolor: '#e5e7eb',
                        color: '#9ca3af',
                        transform: 'none',
                        boxShadow: 'none'
                      }
                    }}
                  >
                    {loading 
                      ? (isLoginMode ? 'Signing In...' : 'Creating Account...') 
                      : (isLoginMode ? 'Sign In' : 'Create Account')
                    }
                  </Button>
                </Box>
              </form>

              <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {isLoginMode 
                    ? 'Enter your credentials to access the MAVIS platform'
                    : 'Fill in the details below to create your MAVIS account'
                  }
                </Typography>

                {/* Mode Switch */}
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'rgba(37, 99, 235, 0.05)', 
                  borderRadius: 2,
                  border: '1px solid rgba(37, 99, 235, 0.1)'
                }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {isLoginMode ? "Don't have an account?" : "Already have an account?"}
                  </Typography>
                  <Button
                    variant="text"
                    onClick={handleModeSwitch}
                    disabled={loading}
                    sx={{ 
                      color: '#2563eb',
                      fontWeight: 600,
                      '&:hover': {
                        bgcolor: 'rgba(37, 99, 235, 0.1)'
                      }
                    }}
                  >
                    {isLoginMode ? 'Create Account' : 'Sign In Instead'}
                  </Button>
                </Box>
              </Box>

              {/* Test Credentials Section (Development Only - Login Mode Only) */}
              {testCredentials && isLoginMode && (
                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowTestCredentials(!showTestCredentials)}
                    startIcon={<DeveloperMode />}
                    endIcon={showTestCredentials ? <ExpandLess /> : <ExpandMore />}
                    sx={{ 
                      borderColor: '#2563eb',
                      color: '#2563eb',
                      '&:hover': {
                        borderColor: '#1d4ed8',
                        bgcolor: 'rgba(37, 99, 235, 0.05)'
                      }
                    }}
                  >
                    {showTestCredentials ? 'Hide' : 'Show'} Test Credentials
                  </Button>

                  <Collapse in={showTestCredentials}>
                    <Card sx={{ 
                      mt: 2, 
                      bgcolor: 'rgba(37, 99, 235, 0.05)', // Light blue background
                      border: '1px solid',
                      borderColor: 'rgba(37, 99, 235, 0.2)' // Blue border
                    }}>
                      <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <DeveloperMode sx={{ mr: 1, color: '#2563eb' }} />
                          <Typography variant="subtitle2" sx={{ color: '#1d4ed8' }}>
                            Development Test Credentials
                          </Typography>
                        </Box>
                        
                        <Grid container spacing={1}>
                          {Object.entries(testCredentials).map(([username, userData]) => (
                            <Grid item xs={6} key={username}>
                              <Tooltip 
                                title={`Click to use ${username} credentials`}
                                arrow
                              >
                                <Card 
                                  sx={{ 
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    border: '1px solid rgba(37, 99, 235, 0.1)',
                                    '&:hover': {
                                      transform: 'translateY(-2px)',
                                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)',
                                      borderColor: 'rgba(37, 99, 235, 0.3)'
                                    }
                                  }}
                                  onClick={() => handleTestCredentialClick(username, userData.password)}
                                >
                                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                      {getRoleIcon(userData.role)}
                                      <Typography variant="body2" sx={{ ml: 1, fontWeight: 600 }}>
                                        {username}
                                      </Typography>
                                    </Box>
                                    <Chip 
                                      label={userData.role.toUpperCase()} 
                                      size="small" 
                                      color={getRoleColor(userData.role)}
                                      sx={{ fontSize: '0.7rem', height: 20 }}
                                    />
                                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                                      {userData.password}
                                    </Typography>
                                  </CardContent>
                                </Card>
                              </Tooltip>
                            </Grid>
                          ))}
                        </Grid>

                        <Alert severity="info" sx={{ mt: 2, fontSize: '0.8rem' }}>
                          <Typography variant="caption">
                            <strong>Development Mode:</strong> These credentials are for testing purposes only 
                            and are not available in production builds.
                          </Typography>
                        </Alert>
                      </CardContent>
                    </Card>
                  </Collapse>
                </Box>
              )}
            </Box>
          </Paper>
        </Fade>
      </Container>
    </Box>
  );
};

export default Login; 