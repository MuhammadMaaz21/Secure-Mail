const User = require('../models/User');
const bcrypt = require('bcrypt');
const { generateTokens, verifyToken } = require('../utils/jwt');
const { generateKeyPair, encryptPrivateKey } = require('../utils/encryption');

// Register new user
const register = async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    // Validation
    if (!email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Email, password, and confirm password are required',
        errors: [
          !email && { field: 'email', message: 'Email is required' },
          !password && { field: 'password', message: 'Password is required' },
          !confirmPassword && { field: 'confirmPassword', message: 'Confirm password is required' }
        ].filter(Boolean)
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Validation failed',
        errors: [{ field: 'email', message: 'Please enter a valid email address' }]
      });
    }

    // Password validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Validation failed',
        errors: [{ field: 'password', message: 'Password must be at least 8 characters' }]
      });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Validation failed',
        errors: [{ field: 'password', message: 'Password must contain uppercase, lowercase, and number' }]
      });
    }

    // Password match validation
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Validation failed',
        errors: [{ field: 'confirmPassword', message: 'Passwords do not match' }]
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'ConflictError',
        message: 'Email already registered'
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate encryption key pair
    const { publicKey, privateKey } = generateKeyPair();
    const encryptedPrivateKeyData = encryptPrivateKey(privateKey, password);

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      passwordHash,
      emailVerified: false, // In production, require email verification
      publicKey,
      encryptedPrivateKey: encryptedPrivateKeyData.encrypted
    });

    await user.save();

    // Generate tokens
    const tokens = generateTokens(user);

    // Return response
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt
        },
        tokens
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Internal server error'
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'AuthenticationError',
        message: 'Invalid email or password'
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(403).json({
        success: false,
        error: 'AccountLockedError',
        message: 'Account is locked due to too many failed attempts. Please try again later.'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Increment login attempts
      user.loginAttempts += 1;
      
      // Lock account after 5 failed attempts
      if (user.loginAttempts >= 5) {
        user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      }
      
      await user.save();

      return res.status(401).json({
        success: false,
        error: 'AuthenticationError',
        message: 'Invalid email or password'
      });
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.accountLockedUntil = null;
    user.lastLogin = new Date();
    await user.save();


    // Generate tokens
    const tokens = generateTokens(user);

    // Return response
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          emailVerified: user.emailVerified,
          lastLogin: user.lastLogin
        },
        tokens
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Internal server error'
    });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = verifyToken(token);
    if (!decoded || decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'AuthenticationError',
        message: 'Invalid or expired refresh token'
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'AuthenticationError',
        message: 'Invalid or expired refresh token'
      });
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: tokens
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Internal server error'
    });
  }
};

// Logout (optional - for token blacklisting in future)
const logout = async (req, res) => {
  try {
    // In a more advanced implementation, you could blacklist the token here
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Internal server error'
    });
  }
};

// Forgot password - request password reset
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Email is required'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Please enter a valid email address'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Always return success to prevent email enumeration
    // In production, you would send an email here
    if (user) {
      // Generate reset token
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save reset token to user
      user.passwordResetToken = resetToken;
      user.passwordResetExpires = resetTokenExpiry;
      
      try {
        await user.save();
      } catch (saveError) {
        console.error('[Forgot Password] Error saving token:', saveError);
        // Try to save again with explicit field marking
        user.markModified('passwordResetToken');
        user.markModified('passwordResetExpires');
        await user.save();
      }
    }

    // Always return success message (security best practice)
    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Internal server error'
    });
  }
};

// Reset password - validate token and update password
const resetPassword = async (req, res) => {
  try {
    let { token, password, confirmPassword } = req.body;
    
    // Trim token in case of whitespace
    if (token) {
      token = token.trim();
    }

    // Validation
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Token, password, and confirm password are required',
        errors: [
          !token && { field: 'token', message: 'Reset token is required' },
          !password && { field: 'password', message: 'Password is required' },
          !confirmPassword && { field: 'confirmPassword', message: 'Confirm password is required' }
        ].filter(Boolean)
      });
    }

    // Password validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Validation failed',
        errors: [{ field: 'password', message: 'Password must be at least 8 characters' }]
      });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Validation failed',
        errors: [{ field: 'password', message: 'Password must contain uppercase, lowercase, and number' }]
      });
    }

    // Password match validation
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Validation failed',
        errors: [{ field: 'confirmPassword', message: 'Passwords do not match' }]
      });
    }

    const now = new Date();
    
    // Find user with valid reset token
    let user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: now }
    });

    // If not found, try with trimmed token
    if (!user) {
      const tokenExists = await User.findOne({ passwordResetToken: token });
      if (tokenExists) {
        const expires = tokenExists.passwordResetExpires;
        const isExpired = !expires || expires <= now;
        
        if (isExpired) {
          return res.status(400).json({
            success: false,
            error: 'ValidationError',
            message: 'Reset token has expired. Please request a new password reset link.'
          });
        }
      } else {
        // Try with trimmed token
        const anyToken = await User.findOne({ passwordResetToken: { $ne: null } });
        if (anyToken && anyToken.passwordResetToken.trim() === token.trim() && anyToken.passwordResetExpires > now) {
          user = anyToken;
        }
      }
      
      if (!user) {
        // Check if token was already used (token exists but was cleared after use)
        const wasUsed = await User.findOne({ 
          email: tokenExists?.email || null 
        });
        
        if (wasUsed && !wasUsed.passwordResetToken) {
          return res.status(400).json({
            success: false,
            error: 'ValidationError',
            message: 'This reset token has already been used. Please request a new password reset link.'
          });
        }
        
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'Invalid reset token. Please request a new password reset link.'
        });
      }
    }
    

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update password and clear reset token
    user.passwordHash = passwordHash;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.loginAttempts = 0; // Reset login attempts
    user.accountLockedUntil = null; // Unlock account if locked
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword
};

