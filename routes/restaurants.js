const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'restaurants.json');

// 確保資料夾與檔案存在（避免第一次跑就讀不到）
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

// 輔助函式：讀取資料
const getData = () => {
    try {
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(content || '[]');
    } catch (e) {
        return [];
    }
};

// 輔助函式：寫入資料
const saveData = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// 輔助函式：正規化字串，避免「空格不同、大小寫不同」造成重複判斷失準
const normalize = (s) => {
    if (!s) return '';
    return String(s)
        .trim()
        .replace(/\s+/g, ' ')   // 多個空白變一個
        .toLowerCase();
};

// 地址正規化：順便把「台」統一成「臺」(你資料若本來都用台也可以反過來)
const normalizeAddress = (s) => {
    return normalize(s).replaceAll('台', '臺');
};

// 取得所有餐廳資料
router.get('/', (req, res) => {
    res.json(getData());
});

// 新增餐廳（允許同名不同分店：同名不同地址 OK；同名同地址才擋）
router.post('/', (req, res) => {
    const data = getData();
    const { name, address } = req.body;

    // 基本防呆：必要欄位沒填
    if (!name || !address) {
        return res.status(400).json({
            success: false,
            message: '請至少填寫「餐廳名稱」與「地址」'
        });
    }

    // 正規化後再比對，避免空格/大小寫/台臺差異
    const nName = normalize(name);
    const nAddr = normalizeAddress(address);

    const exists = data.some(r =>
        normalize(r.name) === nName &&
        normalizeAddress(r.address) === nAddr
    );

    if (exists) {
        return res.status(400).json({
            success: false,
            message: '這家餐廳（同地址）已經投稿過了！'
        });
    }

    const newEntry = {
        id: Date.now().toString(),
        comments: [],
        ...req.body
    };

    data.push(newEntry);
    saveData(data);

    res.json({ success: true, message: '投稿成功！' });
});

module.exports = router;
