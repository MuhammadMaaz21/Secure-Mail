import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import api from '../../api/api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleBlur = (field) => {
    setTouched({ ...touched, [field]: true });
    validateField(field);
  };

  const validateField = (field) => {
    const newErrors = { ...errors };
    
    if (field === 'email') {
      if (!email) {
        newErrors.email = 'Email is required';
      } else if (!validateEmail(email)) {
        newErrors.email = 'Please enter a valid email address';
      } else {
        delete newErrors.email;
      }
    }
    
    if (field === 'password') {
      if (!password) {
        newErrors.password = 'Password is required';
      } else if (password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      } else {
        delete newErrors.password;
      }
    }
    
    setErrors(newErrors);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setGeneralError('');
    
    if (!email || !password) {
      if (!email) setErrors({ ...errors, email: 'Email is required' });
      if (!password) setErrors({ ...errors, password: 'Password is required' });
      return;
    }
    
    if (!validateEmail(email)) {
      setErrors({ ...errors, email: 'Please enter a valid email address' });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await api.post('/auth/login', {
        email,
        password
      });

      if (response.data.success) {
        // Store tokens
        const { accessToken, refreshToken, expiresIn } = response.data.data.tokens;
        localStorage.setItem('jwt', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('tokenExpiresAt', Date.now() + expiresIn * 1000);
        
        // Store user data
        if (response.data.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.data.user));
        }

        // Redirect to dashboard
        navigate('/dashboard');
      }
    } catch (error) {
      setIsLoading(false);
      
      if (error.error === 'AuthenticationError') {
        setGeneralError('Invalid email or password. Please check your credentials and try again.');
        setPassword(''); // Clear password for security
      } else if (error.error === 'VerificationError') {
        setGeneralError('Your email address has not been verified. Please check your inbox for a verification email.');
      } else if (error.error === 'AccountLockedError') {
        setGeneralError('Your account has been temporarily locked due to too many failed login attempts. Please wait 15 minutes and try again.');
      } else if (error.error === 'ValidationError') {
        setGeneralError('Please check that all fields are filled correctly.');
      } else if (error.message && (error.message.includes('Network') || error.message.includes('network'))) {
        setGeneralError('Unable to connect to the server. Please check your internet connection and try again.');
      } else if (error.message && error.message.includes('timeout')) {
        setGeneralError('The request timed out. Please try again.');
      } else {
        setGeneralError(error.message || 'An unexpected error occurred. Please try again or contact support if the problem persists.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
      <div className="w-full max-w-md">
        {/* Title Section */}
        <div className="text-center mb-6 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Shield className="text-[#2CE4C6]" size={32} />
            <h1 className="text-3xl font-bold text-[#1FB8A0]">Secure Mail</h1>
          </div>
        </div>
        
        {/* Login Form Card */}
        <div className="glass p-8 rounded-2xl shadow-2xl animate-fade-in border border-white/80 bg-white/80">
          <h2 className="text-3xl font-bold text-primary mb-2 text-center">Sign In</h2>
          <p className="text-textLight text-sm text-center mb-6">Welcome back! Please enter your credentials.</p>
        
        {generalError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{generalError}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-textDark mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              className={`glass bg-white/90 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all w-full text-textDark placeholder:text-textLight/60 ${
                touched.email && errors.email ? 'border-2 border-red-400 ring-2 ring-red-200' : 'border border-gray-200'
              }`}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (touched.email) validateField('email');
              }}
              onBlur={() => handleBlur('email')}
              aria-invalid={touched.email && errors.email ? 'true' : 'false'}
              aria-describedby={touched.email && errors.email ? 'email-error' : undefined}
            />
            {touched.email && errors.email && (
              <p id="email-error" className="text-red-500 text-xs mt-1" role="alert">
                {errors.email}
              </p>
            )}
            {!errors.email && email && (
              <p className="text-textLight text-xs mt-1">Format: name@domain.com</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-textDark mb-2">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                className={`glass bg-white/90 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all w-full pr-12 text-textDark placeholder:text-textLight/60 ${
                  touched.password && errors.password ? 'border-2 border-red-400 ring-2 ring-red-200' : 'border border-gray-200'
                }`}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (touched.password) validateField('password');
                }}
                onBlur={() => handleBlur('password')}
                aria-invalid={touched.password && errors.password ? 'true' : 'false'}
                aria-describedby={touched.password && errors.password ? 'password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-primary transition-colors text-lg cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {touched.password && errors.password && (
              <p id="password-error" className="text-red-500 text-xs mt-1" role="alert">
                {errors.password}
              </p>
            )}
          </div>

          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-sm text-primary hover:text-primaryDark hover:underline transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className={`mt-4 w-full text-white font-semibold py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${
              !email || !password || isLoading || !validateEmail(email) || password.length < 6
                ? 'bg-gray-400 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-[#2CE4C6] to-[#1FB8A0] hover:from-[#1FB8A0] hover:to-[#2CE4C6] text-white'
            }`}
            disabled={!email || !password || isLoading || !validateEmail(email) || password.length < 6}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="text-sm text-textLight mt-6 text-center">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary hover:text-primaryDark hover:underline font-semibold transition-colors">
            Register
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
