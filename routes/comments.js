const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'comments.json');

// 檢查並自動建立 data 資料夾與檔案
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

router.get('/', (req, res) => {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    res.json(JSON.parse(data || '[]'));
});

router.post('/', (req, res) => {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]');
    data.push({ 
        id: Date.now(), 
        ...req.body, 
        time: new Date().toLocaleString('zh-TW') 
    });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

module.exports = router;