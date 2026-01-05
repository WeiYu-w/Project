// ======================
// 引入套件
// ======================

// 引入 express：用來建立伺服器與路由
const express = require('express');

// 引入 fs：讀寫檔案（用 JSON 當小型資料庫）
const fs = require('fs');

// 引入 path：處理路徑（避免 Windows/Mac 路徑差異）
const path = require('path');

// 建立 express 應用程式
const app = express();


// ======================
// 基本設定
// ======================

// 設定樣板引擎為 EJS（可以把資料塞進 HTML）
app.set('view engine', 'ejs');

// 讓 Express 能讀取 JSON 格式（前端 fetch 傳 application/json 時會用到）
app.use(express.json());

// 讓 Express 能讀取表單送來的資料（name=value）
app.use(express.urlencoded({ extended: true }));

// 設定靜態資料夾（public 裡的 CSS / JS / 圖片可以直接用網址存取）
app.use(express.static(path.join(__dirname, 'public')));


// ======================
// 資料位置（JSON 資料庫）
// ======================

// restaurants.json 的路徑（把資料儲存在 /data/restaurants.json）
const DATA_PATH = path.join(__dirname, 'data', 'restaurants.json'); // 將資料儲存在 restaurants.json

// 若 data 資料夾不存在就建立
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));

// 若 restaurants.json 不存在就建立空陣列，避免 JSON.parse 出錯
if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, '[]');


// ======================
// 讀資料工具函式
// ======================

// 讀取 restaurants.json 內容並轉成 JS 陣列
const getData = () => JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));


// ======================
// 字串統一處理（臺 -> 台）
// ======================

// 統一 city：把「臺」轉成「台」，避免資料不一致造成搜尋/篩選失敗
const normalizeCity = (s = '') => s.replaceAll('臺', '台').trim();


// ======================
// 區域 -> 縣市對照表（台灣版）
// 用於首頁的區域篩選
// ======================
const citiesByRegion = {
    北: ["台北市","新北市","桃園市","基隆市","新竹市","新竹縣","宜蘭縣"],
    中: ["台中市","苗栗縣","彰化縣","南投縣","雲林縣"],
    南: ["高雄市","台南市","嘉義市","嘉義縣","屏東縣","澎湖縣"],
    東: ["花蓮縣","台東縣"],
    外島: ["金門縣","連江縣"]
};


// ======================
// 首頁（顯示餐廳列表 + 搜尋篩選）
// GET /?q=關鍵字&region=北&city=台北市
// ======================
app.get('/', (req, res) => {
    // 先讀全部餐廳資料
    let restaurants = getData();

    // 從 query string 取出搜尋條件（沒帶就用空字串）
    const { q = '', region = '', city = '' } = req.query;

    // ----------------------
    // 1) 關鍵字搜尋
    // ----------------------
    if (q) {
        const keyword = q.toLowerCase();

        // 只要 name / city / district 有包含關鍵字就符合
        restaurants = restaurants.filter(r =>
            r.name.toLowerCase().includes(keyword) ||
            normalizeCity(r.city).toLowerCase().includes(keyword) ||
            (r.district || '').toLowerCase().includes(keyword)
        );
    }

    // ----------------------
    // 2) 區域篩選（北/中/南/東/外島）
    // ----------------------
    if (region && citiesByRegion[region]) {
        restaurants = restaurants.filter(r =>
            citiesByRegion[region].includes(normalizeCity(r.city))
        );
    }

    // ----------------------
    // 3) 城市篩選（例如：台北市）
    // ----------------------
    if (city) {
        const target = normalizeCity(city);
        restaurants = restaurants.filter(r =>
            normalizeCity(r.city) === target
        );
    }

    // 將資料丟給 index.ejs 渲染
    res.render('index', {
        restaurants,        // 餐廳資料
        q,                  // 目前搜尋字串（回填 input）
        region,             // 目前選到的區域（回填 select）
        city: normalizeCity(city) // 目前選到的城市（回填 select，並統一台/臺）
    });
});


// ======================
// 回報/建議功能（feedback routes）
// 這裡用 app.use 掛載 routes/feedback 裡的所有路由
// ======================
const feedbackRoutes = require('./routes/feedback');
app.use(feedbackRoutes);


// ======================
// 頁面路由（render EJS）
// ======================

// 投稿頁面
app.get('/post', (req, res) => res.render('post'));

// 詳情頁面：/detail/:id
app.get('/detail/:id', (req, res) => {
    // 從資料中找到對應 id 的餐廳
    const rest = getData().find(r => r.id === req.params.id);

    // 找不到就回首頁
    if (!rest) return res.redirect('/');

    // 找到就渲染 detail.ejs
    res.render('detail', { rest });
});


// ======================
// API 路由
// ======================

// 餐廳 API（新增餐廳、上傳圖片等）
// 交給 routes/restaurants 處理
app.use('/api/restaurants', require('./routes/restaurants'));


// ======================
// 留言 API（新增留言）
// POST /api/restaurants/:id/comments
// 前端用 JSON 送 { text: "留言內容" }
// ======================
app.post('/api/restaurants/:id/comments', (req, res) => {
    // 讀取全部餐廳資料
    const data = getData();

    // 找到要留言的餐廳 index
    const index = data.findIndex(r => r.id === req.params.id);

    // 若有找到該餐廳才新增留言
    if (index !== -1) {
        // 把留言 push 進 comments 陣列
        data[index].comments.push({
            text: req.body.text,               // 留言文字
            date: new Date().toLocaleString()  // 留言時間（本機時間格式）
        });

        // 存回 restaurants.json
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

        // 回傳成功
        return res.json({ success: true });
    }

    // 若找不到餐廳，回傳 404（比較完整）
    return res.status(404).json({ success: false, message: '找不到該餐廳' });
});


// ======================
// 啟動伺服器
// ======================
app.listen(3000, () => {
    console.log('✅ 伺服器啟動：http://localhost:3000');
});
