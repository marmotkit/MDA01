from flask import Flask, render_template, request, jsonify
from openai import OpenAI
import os
from dotenv import load_dotenv
import logging
import sys
from logging.handlers import RotatingFileHandler

app = Flask(__name__)

# 配置日誌
if not os.path.exists('logs'):
    os.makedirs('logs')

file_handler = RotatingFileHandler('logs/app.log', maxBytes=10240, backupCount=10)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
))
file_handler.setLevel(logging.INFO)
app.logger.addHandler(file_handler)

stream_handler = logging.StreamHandler(sys.stdout)
stream_handler.setLevel(logging.INFO)
app.logger.addHandler(stream_handler)
app.logger.setLevel(logging.INFO)
app.logger.info('Translator startup')

# 載入環境變數
load_dotenv()

# 檢查 API 金鑰
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    app.logger.error('No OpenAI API key found in environment variables')
    raise RuntimeError('OpenAI API key not found. Please set OPENAI_API_KEY environment variable.')

# 初始化 OpenAI 客戶端
try:
    client = OpenAI()  # 使用環境變量中的 API key
    # 測試 API 連接
    response = client.models.list()
    app.logger.info('OpenAI client initialized successfully')
except Exception as e:
    app.logger.error(f'Failed to initialize OpenAI client: {str(e)}')
    client = None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/translate', methods=['POST'])
def translate():
    if not client:
        app.logger.error('Translation attempted but OpenAI client is not initialized')
        return jsonify({"error": "翻譯服務未正確初始化，請檢查 API 金鑰設置"}), 500

    try:
        # 獲取目標語言的名稱
        language_names = {
            'zh-TW': '繁體中文',
            'zh-CN': '簡體中文',
            'en-US': '英文',
            'ja-JP': '日文',
            'ko-KR': '韓文',
            'th-TH': '泰文',
            'vi-VN': '越南文'
        }

        data = request.get_json()
        if not data:
            app.logger.error('No JSON data in request')
            return jsonify({"error": "無效的請求數據"}), 400

        text = data.get('text', '')
        source_lang = data.get('source_lang', 'auto')
        target_lang = data.get('target_lang', 'en-US')

        app.logger.info(f'Translation request - From: {source_lang}, To: {target_lang}, Text: {text[:50]}...')

        if not text:
            app.logger.error('Empty text submitted for translation')
            return jsonify({"error": "請輸入要翻譯的文字"}), 400

        source_lang_name = language_names.get(source_lang, source_lang)
        target_lang_name = language_names.get(target_lang, target_lang)

        # 構建翻譯提示
        if source_lang == 'auto':
            system_prompt = f"""你是一個翻譯助手。請將用戶的文字翻譯成{target_lang_name}。
            要求：
            1. 只輸出翻譯後的文字，不要有任何其他解釋或說明
            2. 保持原文的語氣和格式
            3. 使用地道的表達方式"""
        else:
            system_prompt = f"""你是一個翻譯助手。請將用戶的{source_lang_name}文字翻譯成{target_lang_name}。
            要求：
            1. 只輸出翻譯後的文字，不要有任何其他解釋或說明
            2. 保持原文的語氣和格式
            3. 使用地道的表達方式"""

        app.logger.info('Sending request to OpenAI')
        try:
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ]
            )

            translation = response.choices[0].message.content.strip()
            app.logger.info('Translation completed successfully')
            return jsonify({"translation": translation})

        except Exception as e:
            app.logger.error(f'OpenAI API error: {str(e)}')
            return jsonify({"error": f"OpenAI API 錯誤：{str(e)}"}), 500

    except Exception as e:
        app.logger.error(f'Translation error: {str(e)}')
        return jsonify({"error": f"翻譯過程中發生錯誤：{str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
