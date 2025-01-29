# 面對面翻譯助手 (Face-to-Face Translator)

一個基於網頁的即時語音翻譯應用，支持多種語言之間的即時語音對話翻譯。

## 功能特點

### 1. 語音翻譯
- 支持即時語音輸入和識別
- 自動翻譯並朗讀翻譯結果
- 支持多種語言之間的互譯
- 語音輸入時提供視覺反饋

### 2. 支持的語言
- 中文（台灣）
- 漢語（中國）
- 粵語（香港）
- English（英語）
- 日本語（日語）
- 한국어（韓語）
- ภาษาไทย（泰語）
- Tiếng Việt（越南語）
- Français（法語）
- Español（西班牙語）

### 3. 用戶界面
- 直觀的分屏設計，適合面對面交談
- 深色/淺色主題切換
- 響應式設計，支持各種設備
- 清晰的語音狀態指示
- 對話歷史記錄

### 4. PWA 支持
- 可安裝為本地應用
- 離線功能支持
- 主屏幕快捷方式

## 技術依賴

### 前端
- HTML5
- CSS3
- JavaScript (ES6+)
- Web Speech API
- Service Workers (PWA)

### 後端
- Python 3.8+
- Flask 2.0+
- OpenAI Whisper（語音識別）
- Google Cloud Text-to-Speech
- Google Cloud Translate

### 系統要求
- 現代瀏覽器（Chrome 推薦）
- 麥克風權限
- 網絡連接
- Python 3.8 或更高版本

## 安裝部署

### 1. 環境準備
```bash
# 克隆代碼庫
git clone https://github.com/marmotkit/MDA01.git
cd MDA01

# 創建虛擬環境
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# 安裝依賴
pip install -r requirements.txt
```

### 2. 配置環境變量
創建 `.env` 文件並設置以下變量：
```
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/credentials.json
OPENAI_API_KEY=your_openai_api_key
```

### 3. 啟動應用
```bash
python app.py
```
應用將在 http://localhost:5000 運行

### 4. 生產環境部署
推薦使用 Gunicorn 和 Nginx：
```bash
# 安裝 Gunicorn
pip install gunicorn

# 啟動服務
gunicorn -w 4 -b 127.0.0.1:5000 app:app
```

## 使用說明

1. 打開應用後，選擇上下兩個區域的目標語言
2. 點擊「開始對話」按鈕開始錄音
3. 說話完成後自動停止錄音並進行翻譯
4. 翻譯完成後自動播放翻譯結果
5. 可以點擊清除按鈕清空對話歷史

## 安全性考慮

- 所有音頻數據均使用 HTTPS 傳輸
- 不保存用戶的語音數據
- 遵循瀏覽器的安全策略
- 需要用戶明確授權麥克風權限

## 瀏覽器兼容性

- Chrome 70+（推薦）
- Firefox 65+
- Safari 12+
- Edge 79+

## 開發指南

### 代碼結構
```
MDA01/
├── app.py              # Flask 應用主文件
├── requirements.txt    # Python 依賴
├── static/
│   ├── css/           # 樣式文件
│   ├── js/            # JavaScript 文件
│   └── icons/         # PWA 圖標
├── templates/         # HTML 模板
└── .env              # 環境變量
```

### 開發模式運行
```bash
export FLASK_ENV=development
export FLASK_APP=app.py
flask run
```

## 問題排解

### 常見問題
1. 麥克風無法使用
   - 檢查瀏覽器權限設置
   - 確認系統麥克風設備正常

2. 翻譯服務無響應
   - 檢查網絡連接
   - 確認 API 密鑰配置正確

3. 音頻無法播放
   - 檢查設備音量設置
   - 確認瀏覽器音頻權限

## 版本歷史

- v3.8: 優化界面佈局，改進用戶體驗
- v3.7: 添加多語言支持
- v3.6: 實現 PWA 功能
- v3.5: 優化語音識別準確度
- v3.0: 重構核心功能

## 授權協議

版權所有 © 2024 KT. Liang
