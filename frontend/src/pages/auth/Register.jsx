import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import api from '../../api/api';

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
      } else if (password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        newErrors.password = 'Password must contain uppercase, lowercase, and number';
      } else {
        delete newErrors.password;
      }
    }
    
    if (field === 'confirm') {
      if (!confirm) {
        newErrors.confirm = 'Please confirm your password';
      } else if (password !== confirm) {
        newErrors.confirm = 'Passwords do not match';
      } else {
        delete newErrors.confirm;
      }
    }
    
    setErrors(newErrors);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true, confirm: true });
    setGeneralError('');
    
    // Validate all fields
    validateField('email');
    validateField('password');
    validateField('confirm');
    
    // Check for errors
    const hasErrors = errors.email || errors.password || errors.confirm || !email || !password || !confirm;
    
    // Re-validate to get current errors
    const currentErrors = {};
    if (!email) currentErrors.email = 'Email is required';
    else if (!validateEmail(email)) currentErrors.email = 'Please enter a valid email address';
    
    if (!password) currentErrors.password = 'Password is required';
    else if (password.length < 8) currentErrors.password = 'Password must be at least 8 characters';
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      currentErrors.password = 'Password must contain uppercase, lowercase, and number';
    }
    
    if (!confirm) currentErrors.confirm = 'Please confirm your password';
    else if (password !== confirm) currentErrors.confirm = 'Passwords do not match';
    
    if (Object.keys(currentErrors).length > 0) {
      setErrors(currentErrors);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        confirmPassword: confirm
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
      
      if (error.error === 'ValidationError' && error.errors) {
        // Map backend validation errors to form fields
        const fieldErrors = {};
        error.errors.forEach(err => {
          if (err.field) {
            fieldErrors[err.field] = err.message;
          }
        });
        setErrors(fieldErrors);
        setGeneralError(error.message || 'Validation failed. Please check your input.');
      } else if (error.error === 'ConflictError') {
        setGeneralError('This email is already registered. Try logging in instead.');
        setErrors({ email: 'Email already exists' });
      } else if (error.message && error.message.includes('Network')) {
        setGeneralError('Network error. Please check your connection and try again.');
      } else {
        setGeneralError(error.message || 'Something went wrong. Please try again.');
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
        
        {/* Register Form Card */}
        <div className="glass p-8 rounded-2xl shadow-2xl animate-fade-in border border-white/80 bg-white/80">
          <h2 className="text-3xl font-bold text-primary mb-2 text-center">Create Account</h2>
          <p className="text-textLight text-sm text-center mb-6">Join us! Create your account to get started.</p>
        
        {generalError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{generalError}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="reg-email" className="block text-sm font-semibold text-textDark mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="reg-email"
              type="email"
              placeholder="your.email@example.com"
              className={`glass bg-white/80 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all w-full text-textDark placeholder:text-textLight/60 ${
                touched.email && errors.email ? 'border-2 border-red-400 ring-2 ring-red-200' : 'border border-white/50'
              }`}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (touched.email) validateField('email');
              }}
              onBlur={() => handleBlur('email')}
              aria-invalid={touched.email && errors.email ? 'true' : 'false'}
              aria-describedby={touched.email && errors.email ? 'reg-email-error' : undefined}
            />
            {touched.email && errors.email && (
              <p id="reg-email-error" className="text-red-500 text-xs mt-1" role="alert">
                {errors.email}
              </p>
            )}
            {!errors.email && email && (
              <p className="text-textLight text-xs mt-1">Format: name@domain.com</p>
            )}
          </div>

          <div>
            <label htmlFor="reg-password" className="block text-sm font-semibold text-textDark mb-2">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password"
                className={`glass bg-white/80 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all w-full pr-12 text-textDark placeholder:text-textLight/60 ${
                  touched.password && errors.password ? 'border-2 border-red-400 ring-2 ring-red-200' : 'border border-white/50'
                }`}
                value={password}
                onChange={(e) => {
                  const newPassword = e.target.value;
                  setPassword(newPassword);
                  if (touched.password) validateField('password');
                  // Re-validate confirm password immediately if it has a value
                  if (confirm) {
                    const newErrors = { ...errors };
                    if (newPassword !== confirm) {
                      newErrors.confirm = 'Passwords do not match';
                    } else {
                      delete newErrors.confirm;
                    }
                    setErrors(newErrors);
                  }
                }}
                onBlur={() => handleBlur('password')}
                aria-invalid={touched.password && errors.password ? 'true' : 'false'}
                aria-describedby={touched.password && errors.password ? 'reg-password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-textLight hover:text-primary transition-colors text-lg"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {touched.password && errors.password && (
              <p id="reg-password-error" className="text-red-500 text-xs mt-1" role="alert">
                {errors.password}
              </p>
            )}
            {!errors.password && password && (
              <p className="text-textLight text-xs mt-1">
                Must be 8+ characters with uppercase, lowercase, and number
              </p>
            )}
          </div>

          <div>
            <label htmlFor="reg-confirm" className="block text-sm font-semibold text-textDark mb-2">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="reg-confirm"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter your password"
                className={`glass bg-white/80 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all w-full pr-12 text-textDark placeholder:text-textLight/60 ${
                  touched.confirm && errors.confirm ? 'border-2 border-red-400 ring-2 ring-red-200' : 'border border-white/50'
                }`}
                value={confirm}
                onChange={(e) => {
                  const newConfirm = e.target.value;
                  setConfirm(newConfirm);
                  // Validate immediately if password field has value
                  if (password) {
                    const newErrors = { ...errors };
                    if (!newConfirm) {
                      newErrors.confirm = 'Please confirm your password';
                    } else if (password !== newConfirm) {
                      newErrors.confirm = 'Passwords do not match';
                    } else {
                      delete newErrors.confirm;
                    }
                    setErrors(newErrors);
                  }
                  // Mark as touched when user starts typing
                  if (!touched.confirm) {
                    setTouched({ ...touched, confirm: true });
                  }
                }}
                onBlur={() => handleBlur('confirm')}
                aria-invalid={touched.confirm && errors.confirm ? 'true' : 'false'}
                aria-describedby={touched.confirm && errors.confirm ? 'reg-confirm-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-textLight hover:text-primary transition-colors text-lg"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {touched.confirm && errors.confirm && (
              <p id="reg-confirm-error" className="text-red-500 text-xs mt-1" role="alert">
                {errors.confirm}
              </p>
            )}
            {confirm && password && password === confirm && !errors.confirm && (
              <p className="text-green-600 text-xs mt-1">✓ Passwords match</p>
            )}
          </div>

          <button
            type="submit"
            className={`mt-4 w-full text-white font-semibold py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${
              !email || !password || !confirm || isLoading || !validateEmail(email) || password.length < 6 || password !== confirm
                ? 'bg-gray-400 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-[#2CE4C6] to-[#1FB8A0] hover:from-[#1FB8A0] hover:to-[#2CE4C6] text-white'
            }`}
            disabled={!email || !password || !confirm || isLoading || !validateEmail(email) || password.length < 6 || password !== confirm}
          >
            {isLoading ? 'Creating Account...' : 'Register'}
          </button>
        </form>
        <div className="text-sm text-textLight mt-4 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:text-primaryDark hover:underline font-semibold transition-colors">
            Login
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
