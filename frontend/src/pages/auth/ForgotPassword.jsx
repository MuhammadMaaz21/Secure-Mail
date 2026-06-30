import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Mail, ArrowLeft } from 'lucide-react';
import api from '../../api/api';
import { toast } from '../../utils/toast';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

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
    
    setErrors(newErrors);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all fields
    validateField('email');
    
    if (Object.keys(errors).length > 0 || !email || !validateEmail(email)) {
      setTouched({ email: true });
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { email });
      
      // Check if response has success property
      if (response.data && response.data.success !== false) {
        setEmailSent(true);
        toast.success(response.data.message || 'Password reset link sent to your email');
      } else {
        // If response doesn't indicate success, still show success for security
        setEmailSent(true);
        toast.success('If an account with that email exists, a password reset link has been sent.');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      
      // For security, always show success message (prevent email enumeration)
      // Even if there's an error, we don't want to reveal if email exists
      setEmailSent(true);
      
      // Log error for debugging but show success to user
      if (error.response?.data?.success === true) {
        toast.success(error.response.data.message || 'Password reset link sent to your email');
      } else {
        toast.success('If an account with that email exists, a password reset link has been sent.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
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
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-primary mb-2">Check Your Email</h2>
              <p className="text-textLight text-sm">
                We've sent a password reset link to <span className="text-textDark font-semibold">{email}</span>
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-textDark mb-2">
                <strong className="text-primary">📋 Development Mode:</strong> Check the <strong className="text-primary">backend terminal/console</strong> for the reset token and link.
              </p>
              <p className="text-xs text-textLight">
                Look for a message starting with "🔐 PASSWORD RESET TOKEN GENERATED" in your backend server console.
              </p>
              <p className="text-xs text-textLight mt-2">
                <strong>Note:</strong> If you don't see a token in the backend console, the email address may not be registered. Only registered users will receive reset tokens.
              </p>
            </div>

            <div className="space-y-4">
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 w-full text-white font-semibold py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 bg-gradient-to-r from-[#2CE4C6] to-[#1FB8A0] hover:from-[#1FB8A0] hover:to-[#2CE4C6]"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Login
              </Link>
              
              <button
                onClick={() => {
                  setEmailSent(false);
                  setEmail('');
                }}
                className="w-full text-textLight hover:text-primary transition-colors text-sm"
              >
                Try a different email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
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
        
        {/* Forgot Password Form Card */}
        <div className="glass p-8 rounded-2xl shadow-2xl animate-fade-in border border-white/80 bg-white/80">
          <h2 className="text-3xl font-bold text-primary mb-2 text-center">Forgot Password?</h2>
          <p className="text-textLight text-sm text-center mb-6">Enter your email address and we'll send you a link to reset your password.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-textDark mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-textLight" />
                <input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  className={`glass bg-white/90 pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all w-full text-textDark placeholder:text-textLight/60 ${
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
              </div>
              {touched.email && errors.email && (
                <p id="email-error" className="text-red-500 text-xs mt-1" role="alert">
                  {errors.email}
                </p>
              )}
              {!errors.email && email && (
                <p className="text-textLight text-xs mt-1">Format: name@domain.com</p>
              )}
            </div>

            <button
              type="submit"
              className={`mt-4 w-full text-white font-semibold py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${
                !email || isLoading || !validateEmail(email)
                  ? 'bg-gray-400 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-[#2CE4C6] to-[#1FB8A0] hover:from-[#1FB8A0] hover:to-[#2CE4C6] text-white'
              }`}
              disabled={!email || isLoading || !validateEmail(email)}
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
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

