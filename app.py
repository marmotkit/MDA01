from flask import Flask, render_template, request, jsonify, send_file, Response, url_for
import openai
import os
from dotenv import load_dotenv
import logging
import sys
from logging.handlers import RotatingFileHandler
import requests
import xml.etree.ElementTree as ET
import tempfile
import time
import hashlib

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

            # 生成音頻
            try:
                # 根據目標語言選擇合適的語音
                voice_name = {
                    'zh-TW': 'zh-CN-XiaoxiaoNeural',
                    'zh-CN': 'zh-CN-XiaoxiaoNeural',
                    'en-US': 'en-US-JennyNeural',
                    'ja-JP': 'ja-JP-NanamiNeural',
                    'ko-KR': 'ko-KR-SunHiNeural',
                    'th-TH': 'th-TH-PremwadeeNeural',
                    'vi-VN': 'vi-VN-HoaiMyNeural'
                }.get(target_lang, 'en-US-JennyNeural')

                # 準備 SSML
                ssml = f"""<?xml version="1.0" encoding="UTF-8"?>
                <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="{target_lang}">
                    <voice name="{voice_name}">
                        {translation}
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
                tts_response = requests.post(endpoint, headers=headers, data=ssml.encode('utf-8'))
                
                if tts_response.status_code == 200:
                    # 生成臨時文件名
                    file_hash = hashlib.md5(translation.encode()).hexdigest()[:8]
                    temp_filename = f"temp_{file_hash}_{int(time.time())}.mp3"
                    temp_path = os.path.join('static', 'audio', temp_filename)
                    
                    # 確保目錄存在
                    os.makedirs(os.path.dirname(temp_path), exist_ok=True)
                    
                    # 保存音頻文件
                    with open(temp_path, 'wb') as f:
                        f.write(tts_response.content)
                    
                    # 返回翻譯結果和音頻 URL
                    audio_url = url_for('static', filename=f'audio/{temp_filename}')
                    return jsonify({
                        "translated_text": translation,
                        "audio_url": audio_url
                    })
                else:
                    app.logger.error(f'TTS API error: {tts_response.status_code} - {tts_response.text}')
                    return jsonify({
                        "translated_text": translation,
                        "error": "無法生成音頻"
                    })

            except Exception as e:
                app.logger.error(f'TTS error: {str(e)}')
                return jsonify({
                    "translated_text": translation,
                    "error": "音頻生成失敗"
                })

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

        # 打印配置信息
        print(f"Azure Speech Key: {os.getenv('AZURE_SPEECH_KEY')}")
        print(f"Azure Speech Region: {os.getenv('AZURE_SPEECH_REGION')}")

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
        
        print(f"Endpoint: {endpoint}")
        
        # 設置請求頭
        headers = {
            'Ocp-Apim-Subscription-Key': os.getenv('AZURE_SPEECH_KEY'),
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
        }

        print("Sending request to Azure TTS...")
        
        # 發送請求
        response = requests.post(endpoint, headers=headers, data=ssml.encode('utf-8'))
        
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {response.headers}")
        
        if response.status_code == 200:
            print("Request successful")
            print(f"Response content length: {len(response.content)} bytes")
            
            # 直接返回音頻數據
            return Response(
                response.content,
                mimetype='audio/mpeg',
                headers={
                    'Content-Disposition': 'attachment; filename=speech.mp3',
                    'Content-Length': str(len(response.content))
                }
            )
        else:
            error_message = f"TTS API error: {response.status_code} - {response.text}"
            print(error_message)
            print(f"Request headers: {headers}")
            print(f"Request body: {ssml}")
            return jsonify({'error': error_message}), 500

    except Exception as e:
        error_message = f"TTS error: {str(e)}"
        print(error_message)
        return jsonify({'error': error_message}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
