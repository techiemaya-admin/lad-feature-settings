const express = require('express');
const router = express.Router();

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Settings service is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

