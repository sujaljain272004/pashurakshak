const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Ngo = require('../models/Ngo');
const Volunteer = require('../models/Volunteer');

exports.protect = async (req, res, next) => {
  try {
    let token;
    console.log('Auth middleware: Checking for token');

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log(`Auth middleware: Token found: ${token.substring(0, 15)}...`);
    }

    if (!token) {
      console.log('Auth middleware: No token provided');
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token'
      });
    }

    try {
      console.log('Auth middleware: Verifying token');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log(`Auth middleware: Decoded token:`, JSON.stringify(decoded));
      
      // Use either _id or id from the token
      const userId = decoded._id || decoded.id;
      if (!userId) {
        console.log('Auth middleware: No user ID found in token');
        throw new Error('Invalid token: No user ID');
      }
      
      // Check for role in the JWT token for role-based authentication
      if (decoded.role) {
        console.log(`Auth middleware: Role found in token: ${decoded.role}`);
        
        if (decoded.role === 'volunteer') {
          console.log(`Auth middleware: Checking for volunteer with ID: ${userId}`);
          // Check if it's a volunteer
          const volunteer = await Volunteer.findById(userId).select('-password');
          
          if (volunteer) {
            console.log(`Auth middleware: Volunteer found: ${volunteer.name}`);
            
            if (volunteer.status !== 'active') {
              console.log(`Auth middleware: Volunteer not active: ${volunteer.status}`);
              return res.status(403).json({
                success: false,
                message: 'Your account is inactive. Please contact your NGO.'
              });
            }
            
            req.user = volunteer;
            req.userType = 'volunteer';
            console.log(`Auth middleware: Setting userType to: volunteer`);
            return next();
          } else {
            console.log(`Auth middleware: No volunteer found with ID: ${userId}`);
          }
        } else if (decoded.role === 'admin' || decoded.role === 'user') {
          // Check if it's a user (admin or regular user)
          console.log(`Auth middleware: Checking for user with ID: ${userId}`);
          const user = await User.findById(userId);
          if (user) {
            console.log(`Auth middleware: User found: ${user.name}, role: ${user.role}`);
            req.user = user;
            req.userType = user.role;
            return next();
          } else {
            console.log(`Auth middleware: No user found with ID: ${userId}`);
          }
        }
      } else {
        console.log(`Auth middleware: No role found in token`);
      }
      
      // If no role specified or not found with role, try legacy checks
      console.log(`Auth middleware: Trying legacy checks`);
      
      // First check if it's an admin user
      const adminUser = await User.findById(userId);
      if (adminUser) {
        console.log(`Auth middleware: Admin user found: ${adminUser.name}`);
        req.user = adminUser;
        req.userType = adminUser.role; // 'admin' or 'user'
        return next();
      }

      // If not admin, check NGO
      const ngo = await Ngo.findById(userId);
      if (ngo) {
        console.log(`Auth middleware: NGO found: ${ngo.name}`);
        req.user = ngo;
        req.userType = 'ngo';
        return next();
      }

      console.log(`Auth middleware: User not found for token ID: ${userId}`);
      throw new Error('User not found');
    } catch (err) {
      console.error(`Auth middleware: Token verification failed:`, err);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed',
        error: err.message
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication',
      error: error.message
    });
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    console.log(`restrictTo middleware: Checking if ${req.userType} is allowed among [${roles.join(', ')}]`);
    if (!roles.includes(req.userType)) {
      console.log(`restrictTo middleware: Access denied for ${req.userType}`);
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }
    console.log(`restrictTo middleware: Access granted for ${req.userType}`);
    next();
  };
}; 