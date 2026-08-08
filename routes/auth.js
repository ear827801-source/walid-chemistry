const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

/**
 * POST /api/login
 * Authenticate admin user and return JWT token.
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
  }

  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }

  const token = jwt.sign(
    {
      username: username,
      role: 'admin'
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      username,
      name: process.env.TEACHER_NAME || 'أ / وليد قنديل',
      subject: process.env.TEACHER_SUBJECT || 'الكيمياء'
    }
  });
});

/**
 * POST /api/verify
 * Verify if the current token is still valid.
 */
router.post('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({
      valid: true,
      user: {
        username: decoded.username,
        name: process.env.TEACHER_NAME || 'أ / وليد قنديل',
        subject: process.env.TEACHER_SUBJECT || 'الكيمياء'
      }
    });
  } catch {
    res.status(401).json({ valid: false });
  }
});

module.exports = router;
