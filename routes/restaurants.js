const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const router = express.Router();

const DATA_PATH = path.join(__dirname, '..', 'data', 'restaurants.json');
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'restaurants');

if (!fs.existsSync(path.dirname(DATA_PATH))) fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, '[]', 'utf-8');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const getData = () => JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const saveData = (data) => fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');

const toTai = (s = '') => String(s).replaceAll('臺', '台').trim();

// ===== multer：只收圖片，<= 5MB =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.png';
    cb(null, `rest_${Date.now()}_${Math.random().toString(16).slice(2)}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = (file.mimetype || '').startsWith('image/');
    cb(ok ? null : new Error('只允許上傳圖片檔'), ok);
  }
});

// ✅ 新增餐廳：支援 image(上傳) 或 image_url(網址)
router.post('/', upload.single('image'), (req, res) => {
  try {
    const data = getData();

    // multipart 時：文字會在 req.body；圖片在 req.file
    const name = (req.body.name || '').trim();
    const address = toTai(req.body.address || '');
    const phone = (req.body.phone || '').trim();
    const city = toTai(req.body.city || '');
    const district = (req.body.district || '').trim();
    const description = (req.body.description || '').trim();

    // 圖片：上傳優先，否則用網址
    const urlFromUpload = req.file ? `/uploads/restaurants/${req.file.filename}` : '';
    const urlFromText = (req.body.image_url || '').trim();
    const image_url = urlFromUpload || urlFromText; // ✅ 規則：上傳優先

    if (!name || !address || !city) {
      // 若必填不合格但剛存了檔，刪掉避免垃圾檔
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: '請至少填寫餐廳名稱、地址、城市' });
    }

    const newRest = {
      id: Date.now().toString(),
      name,
      address,
      phone,
      city,
      district,
      image_url: image_url || '',   // 可空
      description,
      comments: []
    };

    data.unshift(newRest);
    saveData(data);

    return res.json({ success: true, message: '投稿成功！', data: newRest });
  } catch (e) {
    return res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// ✅ 上傳錯誤統一處理（例如檔案太大、不是圖片）
router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ success: false, message: err.message || '上傳失敗' });
  next();
});

module.exports = router;
