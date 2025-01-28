# 多語言翻譯助手 (Multilingual Translation Assistant)

這是一個基於 Flask 的網頁應用，提供即時多語言翻譯和語音合成功能。使用 OpenAI 的 GPT 模型進行翻譯，並使用 Azure 的語音服務進行文字轉語音 (TTS)。

## 功能特點

- 支援多語言翻譯
  - 中文（繁體/簡體）
  - 英文
  - 日文
  - 韓文
  - 法文
  - 德文
  - 西班牙文
  - 義大利文
  - 俄文
  - 葡萄牙文
  - 阿拉伯文
  - 印地文
  - 泰文
  - 越南文
  - 印尼文
  - 馬來文

- 即時語音合成
  - 使用 Azure 神經網路語音合成
  - 每種語言都有專屬的自然語音
  - 支援跨平台播放（包括 iOS Safari）

- 響應式設計
  - 適配桌面和移動設備
  - 直觀的用戶界面

## 技術棧

### 後端
- Python 3.9+
- Flask：Web 框架
- OpenAI API：GPT 模型翻譯
- Azure Cognitive Services：語音合成
- Gunicorn：WSGI HTTP 服務器

### 前端
- HTML5
- CSS3
- JavaScript (純原生，無框架依賴)
- 響應式設計

## 部署指南

### 前置需求

1. Python 3.9 或更高版本
2. OpenAI API 密鑰
3. Azure 語音服務密鑰和區域設置
4. Git

### 本地部署

1. 克隆倉庫：
```bash
git clone https://github.com/your-username/translator.git
cd translator
```

2. 創建並激活虛擬環境：
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

3. 安裝依賴：
```bash
pip install -r requirements.txt
```

4. 設置環境變量：
創建 `.env` 文件並添加以下內容：
```
OPENAI_API_KEY=your_openai_api_key
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_azure_region
```

5. 運行應用：
```bash
python app.py
```

訪問 http://localhost:10000 即可使用應用。

### Render 部署

1. 在 Render.com 創建帳號並連接 GitHub 倉庫

2. 創建新的 Web Service，選擇你的倉庫

3. 配置以下設置：
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`
   - Python Version: 3.9 或更高

4. 添加環境變量：
   - `OPENAI_API_KEY`
   - `AZURE_SPEECH_KEY`
   - `AZURE_SPEECH_REGION`

5. 點擊 "Create Web Service"

部署完成後，Render 會提供一個域名，可以通過該域名訪問應用。

## 環境變量說明

- `OPENAI_API_KEY`：OpenAI API 密鑰，用於訪問 GPT 模型
- `AZURE_SPEECH_KEY`：Azure 語音服務密鑰
- `AZURE_SPEECH_REGION`：Azure 語音服務區域（如 'eastasia'）

## 開發指南

### 項目結構
```
translator/
├── app.py              # Flask 應用主文件
├── static/
│   ├── css/
│   │   └── style.css  # 樣式表
│   └── js/
│       └── main.js    # 前端 JavaScript
├── templates/
│   └── index.html     # 主頁面模板
├── requirements.txt    # Python 依賴
├── gunicorn.conf.py   # Gunicorn 配置
└── .env              # 環境變量（不納入版本控制）
```

### API 端點

#### POST /translate
翻譯文本
- 請求體：
  ```json
  {
    "text": "要翻譯的文本",
    "from": "源語言代碼",
    "to": "目標語言代碼"
  }
  ```
- 響應：
  ```json
  {
    "translation": "翻譯後的文本"
  }
  ```

#### POST /tts
文字轉語音
- 請求體：
  ```json
  {
    "text": "要轉換的文本",
    "lang": "語言代碼"
  }
  ```
- 響應：音頻文件 (audio/mpeg)

## 故障排除

### 常見問題

1. 音頻無法播放
   - 確保瀏覽器支援 HTML5 音頻
   - 檢查是否允許瀏覽器播放音頻
   - iOS Safari 需要用戶交互才能播放音頻

2. 翻譯失敗
   - 檢查 OpenAI API 密鑰是否正確
   - 確認 API 配額是否足夠

3. 語音合成失敗
   - 驗證 Azure 語音服務密鑰和區域設置
   - 檢查網絡連接

## 授權

MIT License

## 貢獻

歡迎提交 Issue 和 Pull Request！

## 作者

[Your Name]

## 致謝

- OpenAI GPT
- Azure Cognitive Services
- Flask Team
