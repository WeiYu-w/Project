// ======================
// comments.js（留言 API 路由）
// 功能：
// 1) GET /  取得所有留言（從 comments.json 讀出來）
// 2) POST / 新增留言（寫入 comments.json）
// ======================

// 引入 express（建立路由用）
const express = require('express');

// 建立 router（模組化路由，最後 module.exports 給主程式用）
const router = express.Router();

// 引入 fs（File System）：用來讀寫 comments.json
const fs = require('fs');

// 引入 path：用來組合路徑，避免 Windows/Mac 路徑不同造成錯誤
const path = require('path');


// ======================
// 資料存放路徑設定
// ======================

// data 資料夾路徑（__dirname 是「目前這支檔案所在資料夾」）
// ../data 代表往上一層找到 data 資料夾
const DATA_DIR = path.join(__dirname, '../data');

// comments.json 檔案路徑（留言會存在這裡）
const DATA_FILE = path.join(DATA_DIR, 'comments.json');


// ======================
// 確保資料夾與檔案存在（初始化）
// ======================

// 如果 data 資料夾不存在就建立（recursive: true 代表可建立多層資料夾）
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 如果 comments.json 不存在就建立空陣列（讓 JSON.parse 讀得到）
if (!fs.existsSync(DATA_FILE)) {
    // 建議加上 'utf8'，但不加也能運作（只是比較標準）
    fs.writeFileSync(DATA_FILE, '[]');
}


// ======================
// API 路由
// ======================

// ✅ 取得所有留言
// GET /api/comments （假設主程式掛載 app.use('/api/comments', router)）
router.get('/', (req, res) => {
    // 讀取 comments.json 內容（utf8 代表讀成文字）
    const data = fs.readFileSync(DATA_FILE, 'utf8');

    // 回傳 JSON
    // data 可能是空字串時用 '[]' 防呆，避免 JSON.parse 爆掉
    res.json(JSON.parse(data || '[]'));
});

// ✅ 新增留言
// POST /api/comments
// 注意：req.body 需要主程式有 app.use(express.json()) 才會有資料
router.post('/', (req, res) => {

    // 先讀取現有留言（若檔案為空用 [] 防呆）
    const data = JSON.parse(
        fs.readFileSync(DATA_FILE, 'utf8') || '[]'
    );

    // 把新的留言 push 進去
    data.push({
        id: Date.now(),                         // 留言 ID（用時間戳，簡單且幾乎不重複）
        ...req.body,                            // 前端送來的內容（例如 { text: "..." } ）
        time: new Date().toLocaleString('zh-TW') // 留言時間（台灣格式）
    });

    // 存回 JSON 檔
    // JSON.stringify(data, null, 2) 會讓 JSON 排版縮排 2 格比較好讀
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

    // 回傳成功訊息（給前端判斷用）
    res.json({ success: true });
});


// ======================
// 匯出 router（讓主程式 app.use(...) 可以使用）
// ======================
module.exports = router;
