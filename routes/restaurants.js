// 引入 express 框架
const express = require('express');

// 建立 Router（用來拆分路由模組）
const router = express.Router();

// 引入檔案系統模組（用來讀寫 JSON 檔）
const fs = require('fs');

// 引入 path（用來處理檔案路徑，避免不同作業系統出錯）
const path = require('path');

// ======================
// 資料存放位置設定
// ======================

// data 資料夾路徑（位於上一層的 data 資料夾）
const DATA_DIR = path.join(__dirname, '../data');

// 餐廳資料檔案 restaurants.json 的完整路徑
const DATA_FILE = path.join(DATA_DIR, 'restaurants.json');

// ======================
// 初始化：確保資料夾與檔案存在
// ======================

// 如果 data 資料夾不存在，就建立（recursive 代表可建立多層）
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 如果 restaurants.json 不存在，就建立一個空陣列
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]');
}

// ======================
// 輔助函式：讀取資料
// ======================

/**
 * 從 restaurants.json 讀取資料
 * @returns {Array} 餐廳資料陣列
 */
const getData = () => {
    try {
        // 讀取檔案內容（utf8 字串）
        const content = fs.readFileSync(DATA_FILE, 'utf8');

        // 將 JSON 字串轉成 JS 陣列
        return JSON.parse(content || '[]');
    } catch (e) {
        // 如果檔案壞掉或解析失敗，回傳空陣列避免程式當掉
        return [];
    }
};

// ======================
// 輔助函式：寫入資料
// ======================

/**
 * 將餐廳資料寫回 restaurants.json
 * @param {Array} data - 餐廳資料陣列
 */
const saveData = (data) => {
    // 將資料轉成漂亮的 JSON（縮排 2 格）
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// ======================
// 輔助函式：字串正規化
// 用來避免「大小寫 / 多餘空白」造成重複判斷錯誤
// ======================

/**
 * 一般字串正規化
 * 1. 去除前後空白
 * 2. 多個空白變成一個
 * 3. 全部轉成小寫
 */
const normalize = (s) => {
    if (!s) return '';
    return String(s)
        .trim()                 // 移除前後空白
        .replace(/\s+/g, ' ')   // 多個空白合併成一個
        .toLowerCase();         // 統一成小寫
};

// ======================
// 地址正規化
// 額外處理「臺 / 台」不同寫法
// ======================

/**
 * 地址正規化
 * 將「臺」統一轉為「台」
 */
const normalizeAddress = (s) => {
    return normalize(s).replaceAll('臺', '台');
};

// ======================
// 路由：取得所有餐廳資料
// GET /restaurants
// ======================

router.get('/', (req, res) => {
    // 回傳所有餐廳資料（JSON 格式）
    res.json(getData());
});

// ======================
// 路由：新增餐廳
// POST /restaurants
// 規則：
// - 同名 + 同地址 → 不允許
// - 同名 + 不同地址 → 允許（不同分店）
// ======================

router.post('/', (req, res) => {
    // 讀取現有資料
    const data = getData();

    // 從前端取得餐廳名稱與地址
    const { name, address } = req.body;

    // ======================
    // 基本防呆檢查
    // ======================

    // 如果名稱或地址沒填，回傳錯誤
    if (!name || !address) {
        return res.status(400).json({
            success: false,
            message: '請至少填寫「餐廳名稱」與「地址」'
        });
    }

    // ======================
    // 正規化後比對是否重複
    // ======================

    const nName = normalize(name);
    const nAddr = normalizeAddress(address);

    // 檢查是否已有「同名 + 同地址」的餐廳
    const exists = data.some(r =>
        normalize(r.name) === nName &&
        normalizeAddress(r.address) === nAddr
    );

    // 如果已存在，阻止重複投稿
    if (exists) {
        return res.status(400).json({
            success: false,
            message: '這家餐廳（同地址）已經投稿過了！'
        });
    }

    // ======================
    // 建立新餐廳資料
    // ======================

    const newEntry = {
        id: Date.now().toString(), // 使用時間戳當作簡易 ID
        comments: [],              // 預設評論陣列
        ...req.body                // 其餘欄位直接存進去
    };

    // 新資料加入陣列
    data.push(newEntry);

    // 寫回 JSON 檔案
    saveData(data);

    // 回傳成功訊息
    res.json({
        success: true,
        message: '投稿成功！'
    });
});

// ======================
// 匯出 router，供 app.js / index.js 使用
// ======================

module.exports = router;
