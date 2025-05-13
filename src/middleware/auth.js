const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  // Extract token from Authorization header
  const token = req.header('Authorization')?.replace('Bearer ', '');

  // If no token is provided, respond with an error
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    // Verify token using the secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'misogiai');
    
    // If the token is valid, attach decoded user info to the request object
    req.user = decoded;
    console.log(req.user);
    // Move to the next middleware or route handler
    next();
  } catch (error) {
    // Log the error message for debugging purposes
    console.error('Auth middleware error:', error.message);
    
    // Differentiate between error types for better feedback
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = auth;
