require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhook');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security & Middleware ───
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
    }
  }
}));
app.use(cors());
app.use(express.json());

// ─── Static Files (Admin Dashboard) ───
app.use(express.static(path.join(__dirname, 'public')));

// ─── Routes ───
app.use('/api', authRoutes);
app.use('/api', apiRoutes);
app.use('/webhook', webhookRoutes);

// ─── Fallback: serve dashboard for any unmatched route ───
app.get('*', (req, res) => {
  // Don't redirect API or webhook routes
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Global Error Handler ───
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'حدث خطأ في السيرفر' });
});

// ─── Start Server ───
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   نظام حجز وإدارة المجموعات                     ║');
  console.log('║   أ / وليد قنديل - الكيمياء 🧪                   ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║   🌐 Dashboard: http://localhost:${PORT}            ║`);
  console.log(`║   📡 Webhook:   http://localhost:${PORT}/webhook    ║`);
  console.log(`║   🔌 API:       http://localhost:${PORT}/api        ║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
