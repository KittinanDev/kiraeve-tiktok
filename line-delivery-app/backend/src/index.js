require('dotenv').config();
const express = require('express');
const cors = require('cors');
const orderRoutes = require('./routes/orderRoutes');
const lineWebhookRouter = require('./routes/lineWebhook');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'LINE Delivery API Server is running!' });
});

// API Routes
app.use('/api', orderRoutes);
app.use('/api/line', lineWebhookRouter.router);

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 LINE Delivery Backend running on http://localhost:${PORT}`);
  console.log(`===================================================`);
});
