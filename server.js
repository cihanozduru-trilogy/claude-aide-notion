// Authentication middleware
const authenticateRequest = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ') || 
        authHeader.split(' ')[1] !== process.env.API_SECRET_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
  };
  
  // Apply middleware to protected routes
  app.post('/process-ticket', authenticateRequest, async (req, res) => {
    // Your existing route handler code
  });