// 引入 express
const express = require('express');

// 建立 router（模組化路由）
const router = express.Router();

// 用來讀寫檔案
const fs = require('fs');

// 用來處理路徑
const path = require('path');


// ======================
// 資料存放路徑設定
// ======================

// data 資料夾路徑
const DATA_DIR = path.join(__dirname, '../data');

// comments.json 檔案路徑
const DATA_FILE = path.join(DATA_DIR, 'comments.json');


// ======================
// 確保資料夾與檔案存在
// ======================

// 如果 data 資料夾不存在就建立
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 如果 comments.json 不存在就建立空陣列
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]');
}


// ======================
// API 路由
// ======================

// 取得所有留言
router.get('/', (req, res) => {
    // 讀取檔案內容
    const data = fs.readFileSync(DATA_FILE, 'utf8');

    // 回傳 JSON（如果是空字串就回傳 []）
    res.json(JSON.parse(data || '[]'));
});

// 新增留言
router.post('/', (req, res) => {

    // 先讀取現有留言資料
    const data = JSON.parse(
        fs.readFileSync(DATA_FILE, 'utf8') || '[]'
    );

    // 新留言物件
    data.push({
        id: Date.now(),                 // 留言 ID
        ...req.body,                    // 前端送來的內容
        time: new Date().toLocaleString('zh-TW') // 留言時間
    });

    // 存回 JSON 檔案
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

    // 回傳成功訊息
    res.json({ success: true });
});


// ======================
// 匯出 router
// ======================

module.exports = router;
