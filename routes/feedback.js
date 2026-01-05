const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');
const FEEDBACK_PATH = path.join(DATA_DIR, 'feedback.json');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'feedback');

// 確保資料夾存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(FEEDBACK_PATH)) fs.writeFileSync(FEEDBACK_PATH, '[]', 'utf-8');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function readFeedback() {
  try {
    const raw = fs.readFileSync(FEEDBACK_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function writeFeedback(list) {
  fs.writeFileSync(FEEDBACK_PATH, JSON.stringify(list, null, 2), 'utf-8');
}

// ===== Multer 設定：只收圖片，檔名避免衝突 =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.png';
    cb(null, `fb_${Date.now()}_${Math.random().toString(16).slice(2)}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = (file.mimetype || '').startsWith('image/');
    cb(ok ? null : new Error('只允許上傳圖片檔'), ok);
  }
});

// 頁面：/feedback
router.get('/feedback', (req, res) => {
  res.render('feedback');
});

// API：送出回報（含截圖）
router.post('/api/feedback', upload.single('screenshot'), (req, res) => {
  const {
    type = 'bug',       // bug | suggestion | other
    title = '',
    description = '',
    contact = ''
  } = req.body || {};

  const t = String(type).trim();
  const ti = String(title).trim();
  const d = String(description).trim();
  const c = String(contact).trim();

  // ✅ 基本驗證
  if (!ti || !d) {
    // 如果驗證沒過但已經存檔，刪掉避免垃圾檔
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: '請填寫「標題」與「內容描述」' });
  }
  if (ti.length > 60) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: '標題請勿超過 60 字' });
  }
  if (d.length > 1000) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: '內容請勿超過 1000 字' });
  }

  const list = readFeedback();
  const now = Date.now();

  // ✅ 簡易防重複：10 分鐘內同標題+同描述視為重複
  const isDup = list.some(item =>
    item.title === ti &&
    item.description === d &&
    (now - item.created_at) < 10 * 60 * 1000
  );
  if (isDup) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(409).json({ success: false, message: '這則回報你剛剛送過了（請勿重複送出）' });
  }

  // ✅ 圖片網址（可選）
  const screenshot_url = req.file ? `/uploads/feedback/${req.file.filename}` : '';

  const newItem = {
    id: 'fb_' + now,
    type: ['bug', 'suggestion', 'other'].includes(t) ? t : 'other',
    title: ti,
    description: d,
    contact: c,
    screenshot_url,
    status: 'open',
    created_at: now
  };

  list.unshift(newItem);
  writeFeedback(list);

  return res.json({ success: true, message: '已收到！謝謝你的回報 🙏', data: newItem });
});

// ✅ 上傳錯誤統一處理（例如不是圖片、超過 5MB）
router.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ success: false, message: err.message || '上傳失敗' });
  }
  next();
});

module.exports = router;
