const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/restaurants.json');

// 輔助函式：確保讀取時不會報錯
const getData = () => {
    try {
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(content || '[]'); // 如果是空白字串就回傳 []
    } catch (e) {
        return []; // 如果連檔案都找不到就回傳 []
    }
};

router.get('/', (req, res) => {
    res.json(getData());
});

router.post('/', (req, res) => {
    const data = getData();
    const newEntry = { id: Date.now(), ...req.body };
    data.push(newEntry);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

module.exports = router;