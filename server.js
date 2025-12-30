// 引入 express 套件（用來建立網站伺服器）
const express = require('express');

// 引入 fs（File System）→ 用來讀寫檔案
const fs = require('fs');

// 引入 path → 幫助處理檔案路徑（避免不同作業系統出錯）
const path = require('path');

// 建立 express 應用程式
const app = express();


// ======================
// 基本設定
// ======================

// 設定樣板引擎為 EJS（用來把資料塞進 HTML）
app.set('view engine', 'ejs');

// 讓 Express 能讀取 JSON 格式的資料（API 常用）
app.use(express.json());

// 讓 Express 能讀取表單送來的資料（name=value）
app.use(express.urlencoded({ extended: true }));

// 設定靜態資料夾（CSS、圖片、JS 都放在 public）
app.use(express.static(path.join(__dirname, 'public')));


// ======================
// 資料存放位置設定
// ======================

// 餐廳資料 JSON 檔案路徑
const DATA_PATH = path.join(__dirname, 'data', 'restaurants.json');


// ======================
// 確保資料夾與檔案存在
// ======================

// 如果沒有 data 資料夾，就建立一個
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// 如果沒有 restaurants.json，就建立一個空陣列 []
if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, '[]');
}


// ======================
// 讀取資料的共用函式
// ======================

// 從 JSON 檔案讀取資料，並轉成 JavaScript 陣列
const getData = () => {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
};


// ======================
// 頁面路由
// ======================

// 首頁（顯示所有餐廳）
app.get('/', (req, res) => {
    let restaurants = getData();
    const { q, region, city } = req.query; // 取得搜尋欄與下拉選單值

    // 關鍵字篩選
    if (q) {
        const keyword = q.toLowerCase();
        restaurants = restaurants.filter(r =>
            r.name.toLowerCase().includes(keyword) ||
            r.city.toLowerCase().includes(keyword) ||
            r.district.toLowerCase().includes(keyword)
        );
    }

    // 區域篩選
    if (region) {
        restaurants = restaurants.filter(r => r.region === region);
    }

    // 城市篩選
    if (city) {
        restaurants = restaurants.filter(r => r.city === city);
    }

    // 自動抓所有城市作下拉選單
    const cities = [...new Set(getData().map(r => r.city))];

    res.render('index', { restaurants, q: q || '', region: region || '', city: city || '', cities });
});



// 投稿頁（新增餐廳的表單頁）
app.get('/post', (req, res) => {
    res.render('post');
});

// 詳細頁（顯示單一餐廳）
app.get('/detail/:id', (req, res) => {
    const data = getData();

    // 找到 id 相同的餐廳
    const rest = data.find(r => r.id === req.params.id);

    // 如果找不到，就回首頁
    if (!rest) return res.redirect('/');

    // 傳資料給 detail.ejs
    res.render('detail', { rest });
});

app.use('/api/restaurants', 
    require('./routes/restaurants'));

// ======================
// API 路由
// ======================

// 新增餐廳
app.post('/api/restaurants', (req, res) => {
    const data = getData();

    // 建立新的餐廳物件
    const newRest = {
        ...req.body,                // 表單送來的資料
        id: Date.now().toString(),  // 用時間當作唯一 ID
        comments: []                // 留言陣列
    };

    data.push(newRest); // 加進資料陣列

    // 寫回 JSON 檔案
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

    res.json({ success: true });
});

// 新增留言
app.post('/api/restaurants/:id/comments', (req, res) => {
    const data = getData();

    // 找到餐廳在陣列中的位置
    const index = data.findIndex(r => r.id === req.params.id);

    if (index !== -1) {
        // 加入留言
        data[index].comments.push({
            text: req.body.text,             // 留言內容
            date: new Date().toLocaleString() // 留言時間
        });

        // 存回檔案
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

        res.json({ success: true });
    }
});


// ======================
// 啟動伺服器
// ======================

app.listen(3000, () => {
    console.log('✅伺服器啟動：http://localhost:3000');
});
