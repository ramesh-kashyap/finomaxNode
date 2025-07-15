// Load environment variables
require('dotenv').config();

// Import required modules
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/connectDB');
require('./cron/cronController');  // Load cron jobs
const authRoutes = require('./routes/web');

// Create Express app
const app = express();
// Middleware

app.use(cors({
  origin:  "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Health Check
app.get('/', (req, res) => res.send({ status: 'API is Running 🚀' }));

// Database Connection and Server Start
const PORT = process.env.PORT || 5000;

sequelize.authenticate()
  .then(() => {
    console.log("✅ Database Connected Successfully");

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database Connection Error:", err);
    process.exit(1);  // Exit if DB connection fails
  });
