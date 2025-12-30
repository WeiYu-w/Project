const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_PATH = path.join(__dirname, 'data', 'restaurants.json');

// 確保資料夾與檔案存在
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, '[]');

const getData = () => JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

// 首頁
app.get('/', (req, res) => {
    const restaurants = getData();
    res.render('index', { restaurants });
});

// 投稿頁
app.get('/post', (req, res) => {
    res.render('post');
});

// 詳細頁
app.get('/detail/:id', (req, res) => {
    const data = getData();
    const rest = data.find(r => r.id === req.params.id);
    if (!rest) return res.redirect('/');
    res.render('detail', { rest });
});

// API: 投稿
app.post('/api/restaurants', (req, res) => {
    const data = getData();
    const newRest = { ...req.body, id: Date.now().toString(), comments: [] };
    data.push(newRest);
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

// API: 留言
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

app.listen(3000, () => console.log('✅ 伺服器啟動：http://localhost:3000'));