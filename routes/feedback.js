// 引入 express：用來建立 Router、處理路由
const express = require('express');

// 引入 fs：讀寫檔案（用 JSON 當小型資料庫）
const fs = require('fs');

// 引入 path：處理路徑（避免不同作業系統路徑問題）
const path = require('path');

// 引入 multer：處理 multipart/form-data（上傳檔案用）
const multer = require('multer');

// 建立 router（讓這支檔案可以被 app.use(...) 掛載）
const router = express.Router();

// =========================
// 資料與路徑設定
// =========================

// data 資料夾位置：/data
const DATA_DIR = path.join(__dirname, '..', 'data');

// 回報資料 JSON 檔：/data/feedback.json
const FEEDBACK_PATH = path.join(DATA_DIR, 'feedback.json');

// 截圖上傳資料夾：/public/uploads/feedback
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'feedback');

// =========================
// 確保資料夾/檔案存在（初始化）
// =========================

// 如果 data 資料夾不存在就建立
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// 如果 feedback.json 不存在就先建立空陣列
if (!fs.existsSync(FEEDBACK_PATH)) fs.writeFileSync(FEEDBACK_PATH, '[]', 'utf-8');

// 如果 uploads/feedback 不存在就建立（recursive 代表可建立多層）
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// =========================
// 讀取回報資料（JSON -> Array）
// =========================
function readFeedback() {
  try {
    // 讀檔並轉成 JS 資料
    const raw = fs.readFileSync(FEEDBACK_PATH, 'utf-8');
    const data = JSON.parse(raw);

    // 若不是陣列就回傳空陣列（防呆）
    return Array.isArray(data) ? data : [];
  } catch (e) {
    // 檔案壞掉/解析失敗時也回傳空陣列，避免 server crash
    return [];
  }
}

// =========================
// 寫入回報資料（Array -> JSON 檔）
// =========================
function writeFeedback(list) {
  // JSON.stringify(null,2) 只是讓檔案縮排好看
  fs.writeFileSync(FEEDBACK_PATH, JSON.stringify(list, null, 2), 'utf-8');
}

// =========================
// Multer 設定：只收圖片，檔名避免衝突
// =========================

// 設定儲存方式（存到硬碟）
const storage = multer.diskStorage({
  // 指定存放資料夾
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),

  // 產生檔名：fb_時間戳_亂數.副檔名
  filename: (req, file, cb) => {
    // 取得副檔名（轉小寫）
    const ext = path.extname(file.originalname || '').toLowerCase();

    // 只允許常見圖片副檔名，否則一律改成 .png（防呆）
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.png';

    // 存檔名稱：fb_時間戳_亂數 + 副檔名（避免重複）
    cb(null, `fb_${Date.now()}_${Math.random().toString(16).slice(2)}${safeExt}`);
  }
});

// 建立 multer 上傳器
const upload = multer({
  storage,

  // 5MB 檔案大小限制
  limits: { fileSize: 5 * 1024 * 1024 },

  // 過濾檔案類型：只收 image/*
  fileFilter: (req, file, cb) => {
    const ok = (file.mimetype || '').startsWith('image/');
    cb(ok ? null : new Error('只允許上傳圖片檔'), ok);
  }
});

// =========================
// 頁面路由：GET /feedback
// 回傳 EJS 畫面 feedback.ejs
// =========================
router.get('/feedback', (req, res) => {
  res.render('feedback');
});

// =========================
// API：POST /api/feedback
// 接收回報資料（支援截圖上傳）
// upload.single('screenshot') 代表接收欄位名 screenshot 的檔案
// =========================
router.post('/api/feedback', upload.single('screenshot'), (req, res) => {
  // 解構 req.body，給預設值（避免 undefined）
  const {
    type = 'bug',       // bug | suggestion | other
    title = '',
    description = '',
    contact = ''
  } = req.body || {};

  // 轉字串並去空白（統一格式）
  const t = String(type).trim();
  const ti = String(title).trim();
  const d = String(description).trim();
  const c = String(contact).trim();

  // =========================
  // ✅ 基本驗證（必填/字數）
  // =========================

  // 標題或內容沒填
  if (!ti || !d) {
    // 若驗證沒過但已經上傳了檔案 → 刪掉避免垃圾檔
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    return res.status(400).json({
      success: false,
      message: '請填寫「標題」與「內容描述」'
    });
  }

  // 標題長度限制
  if (ti.length > 60) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: '標題請勿超過 60 字' });
  }

  // 內容長度限制
  if (d.length > 1000) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: '內容請勿超過 1000 字' });
  }

  // 讀取現有回報列表
  const list = readFeedback();

  // 用時間戳當 created_at / id（簡單做法）
  const now = Date.now();

  // =========================
  // ✅ 簡易防重複：10 分鐘內同標題 + 同內容視為重複
  // 目的：避免使用者一直按送出造成多筆重複資料
  // =========================
  const isDup = list.some(item =>
    item.title === ti &&
    item.description === d &&
    (now - item.created_at) < 10 * 60 * 1000
  );

  if (isDup) {
    // 重複也要把剛上傳的檔案刪掉（避免垃圾檔）
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    return res.status(409).json({
      success: false,
      message: '這則回報你剛剛送過了（請勿重複送出）'
    });
  }

  // =========================
  // ✅ 產生截圖 URL（可選）
  // 有上傳檔案 → 給可公開的靜態路徑
  // 沒上傳 → 空字串
  // =========================
  const screenshot_url = req.file ? `/uploads/feedback/${req.file.filename}` : '';

  // 新增一筆回報資料
  const newItem = {
    id: 'fb_' + now, // 簡單唯一 id
    type: ['bug', 'suggestion', 'other'].includes(t) ? t : 'other', // 防止亂填 type
    title: ti,
    description: d,
    contact: c,
    screenshot_url,
    status: 'open',  // 可用來做後續處理狀態
    created_at: now
  };

  // 最新的放最前面
  list.unshift(newItem);

  // 寫回 JSON 檔
  writeFeedback(list);

  // 回傳成功
  return res.json({
    success: true,
    message: '已收到！謝謝你的回報 🙏',
    data: newItem
  });
});

// =========================
// ✅ 上傳錯誤統一處理（middleware）
// 常見：
// - 不是圖片
// - 超過 5MB
// =========================
router.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || '上傳失敗'
    });
  }
  next();
});

// 匯出 router，給主程式 app.use(...) 使用
module.exports = router;
