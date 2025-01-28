from flask import Flask, render_template, request, jsonify, send_file
import openai
import os
from dotenv import load_dotenv
import logging
import sys
from logging.handlers import RotatingFileHandler
import requests
import xml.etree.ElementTree as ET
import tempfile

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

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/translate', methods=['POST'])
def translate():
    try:
        # 檢查 API 金鑰
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            app.logger.error('No OpenAI API key found in environment variables')
            return jsonify({"error": "未設置 OpenAI API 金鑰"}), 500

        # 設置 OpenAI API 金鑰
        openai.api_key = api_key

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
            response = openai.ChatCompletion.create(
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

@app.route('/tts', methods=['POST'])
def text_to_speech():
    try:
        data = request.get_json()
        text = data.get('text', '')
        lang = data.get('lang', 'en')

        # 根據語言選擇合適的語音
        voice_name = {
            'zh': 'zh-CN-XiaoxiaoNeural',
            'en': 'en-US-JennyNeural',
            'ja': 'ja-JP-NanamiNeural',
            'ko': 'ko-KR-SunHiNeural',
            'fr': 'fr-FR-DeniseNeural',
            'de': 'de-DE-KatjaNeural',
            'es': 'es-ES-ElviraNeural',
            'it': 'it-IT-ElsaNeural',
            'ru': 'ru-RU-SvetlanaNeural',
            'pt': 'pt-BR-FranciscaNeural',
            'ar': 'ar-SA-ZariyahNeural',
            'hi': 'hi-IN-SwaraNeural',
            'th': 'th-TH-PremwadeeNeural',
            'vi': 'vi-VN-HoaiMyNeural',
            'id': 'id-ID-GadisNeural',
            'ms': 'ms-MY-YasminNeural'
        }.get(lang.split('-')[0], 'en-US-JennyNeural')

        # 準備 SSML
        ssml = f"""<?xml version="1.0" encoding="UTF-8"?>
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="{lang}">
            <voice name="{voice_name}">
                {text}
            </voice>
        </speak>"""

        # Azure TTS endpoint
        endpoint = f"https://{os.getenv('AZURE_SPEECH_REGION')}.tts.speech.microsoft.com/cognitiveservices/v1"
        
        # 設置請求頭
        headers = {
            'Ocp-Apim-Subscription-Key': os.getenv('AZURE_SPEECH_KEY'),
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
        }

        # 發送請求
        response = requests.post(endpoint, headers=headers, data=ssml.encode('utf-8'))
        
        if response.status_code == 200:
            # 創建臨時文件
            temp_dir = tempfile.gettempdir()
            temp_file = os.path.join(temp_dir, 'speech.mp3')
            
            # 保存音頻
            with open(temp_file, 'wb') as f:
                f.write(response.content)

            # 返回音頻
            return send_file(
                temp_file,
                mimetype='audio/mpeg',
                as_attachment=True,
                download_name='speech.mp3'
            )
        else:
            print(f"TTS API error: {response.status_code} - {response.text}")
            return jsonify({'error': f'TTS API error: {response.status_code}'}), 500

    except Exception as e:
        print(f"TTS error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
