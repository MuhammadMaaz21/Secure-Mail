import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import api from '../../api/api';
import { toast } from '../../utils/toast';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Extract token from URL and store in state
  const [token, setToken] = useState(() => {
    // Get token from URL params
    let urlToken = searchParams.get('token');
    if (!urlToken) {
      // Fallback: try window.location
      const urlParams = new URLSearchParams(window.location.search);
      urlToken = urlParams.get('token');
    }
    
    if (urlToken) {
      // Decode URL encoding if present and trim whitespace
      urlToken = decodeURIComponent(urlToken).trim();
      return urlToken;
    }
    return null;
  });

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error('Invalid reset link. Please request a new password reset.');
      setTimeout(() => {
        navigate('/forgot-password');
      }, 2000);
    }
  }, [token, navigate]);

  const handleBlur = (field) => {
    setTouched({ ...touched, [field]: true });
    validateField(field);
  };

  const validateField = (field) => {
    const newErrors = { ...errors };
    
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
    
    if (field === 'confirmPassword') {
      if (!confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      } else {
        delete newErrors.confirmPassword;
      }
    }
    
    setErrors(newErrors);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all fields
    validateField('password');
    validateField('confirmPassword');
    
    if (Object.keys(errors).length > 0 || !password || !confirmPassword || password !== confirmPassword) {
      setTouched({ password: true, confirmPassword: true });
      return;
    }

    if (!token) {
      toast.error('Invalid reset token');
      navigate('/forgot-password');
      return;
    }

    setIsLoading(true);

    try {
      if (!token) {
        toast.error('Invalid reset token');
        navigate('/forgot-password');
        return;
      }
      
      // Ensure token is properly trimmed and not modified
      const cleanToken = token.trim();
      
      if (!cleanToken || cleanToken.length < 10) {
        toast.error('Invalid reset token format');
        navigate('/forgot-password');
        return;
      }
      
      const requestData = {
        token: cleanToken,
        password: password.trim(),
        confirmPassword: confirmPassword.trim()
      };
      
      const response = await api.post('/auth/reset-password', requestData);
      
      if (response.data && response.data.success) {
        setPasswordReset(true);
        toast.success(response.data.message || 'Password reset successfully');
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        toast.error(response.data?.message || 'Failed to reset password');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to reset password';
      toast.error(errorMessage);
      
      // If token is invalid/expired, redirect to forgot password
      if (error.response?.status === 400) {
        setTimeout(() => {
          navigate('/forgot-password');
        }, 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (passwordReset) {
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
          
          {/* Success Card */}
          <div className="glass p-8 rounded-2xl shadow-2xl animate-fade-in border border-white/80 bg-white/80">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-primary mb-2">Password Reset Successful!</h2>
              <p className="text-textLight text-sm">
                Your password has been reset successfully. Redirecting to login...
              </p>
            </div>

            <Link
              to="/login"
              className="flex items-center justify-center gap-2 w-full text-white font-semibold py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 bg-gradient-to-r from-[#2CE4C6] to-[#1FB8A0] hover:from-[#1FB8A0] hover:to-[#2CE4C6]"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return null; // Will redirect in useEffect
  }

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
        
        {/* Reset Password Form Card */}
        <div className="glass p-8 rounded-2xl shadow-2xl animate-fade-in border border-white/80 bg-white/80">
          <h2 className="text-3xl font-bold text-primary mb-2 text-center">Reset Password</h2>
          <p className="text-textLight text-sm text-center mb-6">Enter your new password below.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-textDark mb-2">
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-textLight" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  className={`glass bg-white/90 pl-10 pr-12 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all w-full text-textDark placeholder:text-textLight/60 ${
                    touched.password && errors.password ? 'border-2 border-red-400 ring-2 ring-red-200' : 'border border-gray-200'
                  }`}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (touched.password) validateField('password');
                    if (touched.confirmPassword) validateField('confirmPassword');
                  }}
                  onBlur={() => handleBlur('password')}
                  aria-invalid={touched.password && errors.password ? 'true' : 'false'}
                  aria-describedby={touched.password && errors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-textLight hover:text-primary transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {touched.password && errors.password && (
                <p id="password-error" className="text-red-500 text-xs mt-1" role="alert">
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
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-textDark mb-2">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-textLight" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  className={`glass bg-white/90 pl-10 pr-12 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all w-full text-textDark placeholder:text-textLight/60 ${
                    touched.confirmPassword && errors.confirmPassword ? 'border-2 border-red-400 ring-2 ring-red-200' : 'border border-gray-200'
                  }`}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (touched.confirmPassword) validateField('confirmPassword');
                  }}
                  onBlur={() => handleBlur('confirmPassword')}
                  aria-invalid={touched.confirmPassword && errors.confirmPassword ? 'true' : 'false'}
                  aria-describedby={touched.confirmPassword && errors.confirmPassword ? 'confirmPassword-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-textLight hover:text-primary transition-colors"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {touched.confirmPassword && errors.confirmPassword && (
                <p id="confirmPassword-error" className="text-red-500 text-xs mt-1" role="alert">
                  {errors.confirmPassword}
                </p>
              )}
              {confirmPassword && password && password === confirmPassword && !errors.confirmPassword && (
                <p className="text-green-600 text-xs mt-1">✓ Passwords match</p>
              )}
            </div>

            <button
              type="submit"
              className={`mt-4 w-full text-white font-semibold py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${
                !password || !confirmPassword || isLoading || password !== confirmPassword || password.length < 8
                  ? 'bg-gray-400 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-[#2CE4C6] to-[#1FB8A0] hover:from-[#1FB8A0] hover:to-[#2CE4C6] text-white'
              }`}
              disabled={!password || !confirmPassword || isLoading || password !== confirmPassword || password.length < 8}
            >
              {isLoading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>

          <div className="text-sm text-textLight mt-6 text-center">
            <Link
              to="/login"
              className="text-primary hover:text-primaryDark hover:underline font-semibold transition-colors flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

