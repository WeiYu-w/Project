// 引入 express：用來建立 Router、處理路由
const express = require('express');

// 引入 fs：讀寫檔案（用 JSON 當小型資料庫）
const fs = require('fs');

// 引入 path：處理路徑（避免不同作業系統路徑問題）
const path = require('path');

// 引入 multer：處理 multipart/form-data（上傳檔案用）
const multer = require('multer');

// 建立 router（讓這支檔案可以被 app.use('/api/restaurants', router) 掛載）
const router = express.Router();

// ====== 資料與上傳路徑設定 ======

// JSON 資料庫位置：/data/restaurants.json
const DATA_PATH = path.join(__dirname, '..', 'data', 'restaurants.json');

// 圖片上傳資料夾：/public/uploads/restaurants
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'restaurants');

// ====== 初始化（確保資料夾與檔案存在） ======

// 若 data 資料夾不存在就建立（recursive: true 代表連同上層一起建立）
if (!fs.existsSync(path.dirname(DATA_PATH))) fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });

// 若 restaurants.json 不存在就先建立空陣列
if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, '[]', 'utf-8');

// 若上傳資料夾不存在就建立
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ====== 讀寫 JSON 的工具函式 ======

// 讀取資料：把 restaurants.json 讀出來並轉成 JS 陣列
const getData = () => JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

// 存回資料：把 JS 陣列寫回 restaurants.json（null,2 只是讓 JSON 格式縮排好看）
const saveData = (data) => fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');

// 統一「臺」改成「台」，避免資料不一致
const toTai = (s = '') => String(s).replaceAll('臺', '台').trim();

// =========================
// multer 設定：只收圖片，<= 5MB
// =========================

// 設定檔案儲存方式（diskStorage：存到硬碟）
const storage = multer.diskStorage({
  // 決定上傳檔案要存到哪裡
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),

  // 決定上傳檔案名稱（避免重名覆蓋）
  filename: (req, file, cb) => {
    // 取副檔名，轉小寫（例如 .JPG -> .jpg）
    const ext = path.extname(file.originalname || '').toLowerCase();

    // 只允許常見圖片副檔名，否則一律改存成 .png（安全防呆）
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.png';

    // 生成檔名：rest_時間戳_亂數.副檔名
    cb(null, `rest_${Date.now()}_${Math.random().toString(16).slice(2)}${safeExt}`);
  }
});

// 建立 multer 上傳器
const upload = multer({
  storage,

  // 檔案大小限制：5MB
  limits: { fileSize: 5 * 1024 * 1024 },

  // 檔案類型過濾：只允許 image/*
  fileFilter: (req, file, cb) => {
    const ok = (file.mimetype || '').startsWith('image/');
    // ok=false 時給錯誤訊息
    cb(ok ? null : new Error('只允許上傳圖片檔'), ok);
  }
});

// =========================
// ✅ 新增餐廳（POST /api/restaurants）
// 支援兩種圖片來源：
// 1) image：上傳檔案（multer 接）
// 2) image_url：貼網址（文字）
// 規則：上傳優先，沒有上傳才用網址
// =========================
router.post('/', upload.single('image'), (req, res) => {
  try {
    // 讀取現有資料
    const data = getData();

    // multipart/form-data 時：文字在 req.body、檔案在 req.file
    const name = (req.body.name || '').trim();
    const address = toTai(req.body.address || '');
    const phone = (req.body.phone || '').trim();
    const city = toTai(req.body.city || '');
    const district = (req.body.district || '').trim();
    const description = (req.body.description || '').trim();

    // 圖片：如果有上傳檔案 → 產生可公開的 URL
    const urlFromUpload = req.file ? `/uploads/restaurants/${req.file.filename}` : '';

    // 圖片：使用者貼的網址
    const urlFromText = (req.body.image_url || '').trim();

    // 最終圖片：上傳優先，否則用網址
    const image_url = urlFromUpload || urlFromText;

    // 必填檢查：名稱 / 地址 / 城市
    if (!name || !address || !city) {
      // 如果剛才已經上傳了檔案，但必填不合格 → 刪掉檔案避免產生垃圾檔
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

      return res.status(400).json({
        success: false,
        message: '請至少填寫餐廳名稱、地址、城市'
      });
    }

    // 組出新餐廳資料
    const newRest = {
      id: Date.now().toString(),   // 用時間戳當 id（簡單做法）
      name,
      address,
      phone,
      city,
      district,
      image_url: image_url || '',  // 可空字串
      description,
      comments: []                 // 預設沒有留言
    };

    // 新資料放最前面（讓最新投稿排最上面）
    data.unshift(newRest);

    // 寫回 JSON
    saveData(data);

    // 回傳成功
    return res.json({ success: true, message: '投稿成功！', data: newRest });
  } catch (e) {
    // 伺服器出錯
    return res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// =========================
// ✅ 上傳錯誤統一處理（middleware）
// 常見：
// - 檔案太大（超過 5MB）
// - 不是圖片（fileFilter 擋掉）
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

// 匯出 router，讓主程式 app.use() 可以使用
module.exports = router;
