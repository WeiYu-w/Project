const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// ===== 基本設定 =====
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ===== 資料位置 =====
const DATA_PATH = path.join(__dirname, 'data', 'restaurants.json'); //將資料儲存在restaurants.json
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, '[]');

// ===== 讀資料 =====
const getData = () => JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

// ===== 統一 city：全部用「台」=====
const normalizeCity = (s = '') => s.replaceAll('臺', '台').trim();

// ===== 區域 -> 縣市對照（台版）=====
const citiesByRegion = {
    北: ["台北市","新北市","桃園市","基隆市","新竹市","新竹縣","宜蘭縣"],
    中: ["台中市","苗栗縣","彰化縣","南投縣","雲林縣"],
    南: ["高雄市","台南市","嘉義市","嘉義縣","屏東縣","澎湖縣"],
    東: ["花蓮縣","台東縣"],
    外島: ["金門縣","連江縣"]
};

// ===== 首頁 =====
app.get('/', (req, res) => {
    let restaurants = getData();
    const { q = '', region = '', city = '' } = req.query;

    // 關鍵字搜尋
    if (q) {
        const keyword = q.toLowerCase();
        restaurants = restaurants.filter(r =>
            r.name.toLowerCase().includes(keyword) ||
            normalizeCity(r.city).toLowerCase().includes(keyword) ||
            (r.district || '').toLowerCase().includes(keyword)
        );
    }

    // 區域篩選
    if (region && citiesByRegion[region]) {
        restaurants = restaurants.filter(r =>
            citiesByRegion[region].includes(normalizeCity(r.city))
        );
    }

    // 城市篩選
    if (city) {
        const target = normalizeCity(city);
        restaurants = restaurants.filter(r =>
            normalizeCity(r.city) === target
        );
    }

    res.render('index', {
        restaurants,
        q,
        region,
        city: normalizeCity(city)
    });
});

// ===== 頁面 =====
app.get('/post', (req, res) => res.render('post'));

app.get('/detail/:id', (req, res) => {
    const rest = getData().find(r => r.id === req.params.id);
    if (!rest) return res.redirect('/');
    res.render('detail', { rest });
});

// ===== API =====
app.use('/api/restaurants', require('./routes/restaurants'));

// 留言
app.post('/api/restaurants/:id/comments', (req, res) => {
    const data = getData();
    const index = data.findIndex(r => r.id === req.params.id);
    if (index !== -1) {
        data[index].comments.push({
            text: req.body.text,
            date: new Date().toLocaleString()
        });
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
        res.json({ success: true });
    }
});

// ===== 啟動 =====
app.listen(3000, () => {
    console.log('✅ 伺服器啟動：http://localhost:3000');
});
