// 語音識別相關變量
let recognition = null;
let isRecording = false;
let audioContext = null;
let currentAudio = null;

// 初始化語音識別
function initSpeechRecognition(targetLang) {
    if (recognition) {
        recognition.stop();
    }

    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = targetLang;

    recognition.onresult = handleRecognitionResult;
    recognition.onerror = handleRecognitionError;
    recognition.onend = handleRecognitionEnd;
}

// 處理語音識別結果
function handleRecognitionResult(event) {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
            finalTranscript += transcript;
        } else {
            interimTranscript += transcript;
        }
    }

    if (finalTranscript) {
        const activeSection = document.querySelector('.recording');
        const targetLang = activeSection.closest('.split-section').querySelector('.language-select').value;
        translateAndSpeak(finalTranscript, targetLang);
    }
}

// 處理語音識別錯誤
function handleRecognitionError(event) {
    console.error('語音識別錯誤:', event.error);
    stopRecording();
}

// 處理語音識別結束
function handleRecognitionEnd() {
    if (isRecording) {
        recognition.start();
    }
}

// 開始錄音
function startRecording(button) {
    if (isRecording) {
        stopRecording();
        return;
    }

    const section = button.closest('.split-section');
    const targetLang = section.querySelector('.language-select').value;
    
    // 停止其他部分的錄音
    document.querySelectorAll('.btn-record').forEach(btn => {
        if (btn !== button && btn.classList.contains('recording')) {
            stopRecording(btn);
        }
    });

    initSpeechRecognition(targetLang);
    
    isRecording = true;
    button.classList.add('recording');
    button.innerHTML = `
        <span class="status-indicator active"></span>
        停止對話
    `;
    
    recognition.start();
}

// 停止錄音
function stopRecording(button) {
    if (!button) {
        button = document.querySelector('.btn-record.recording');
    }
    
    if (recognition) {
        recognition.stop();
    }
    
    isRecording = false;
    button.classList.remove('recording');
    button.innerHTML = `
        <span class="status-indicator"></span>
        開始對話
    `;
}

// 翻譯並播放
async function translateAndSpeak(text, targetLang) {
    try {
        const response = await fetch('/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                target_lang: targetLang
            })
        });

        if (!response.ok) {
            throw new Error('翻譯請求失敗');
        }

        const data = await response.json();
        
        // 添加原文和翻譯到聊天容器
        addChatBubble(text, 'left', false);
        addChatBubble(data.translated_text, 'right', true);

        // 播放翻譯後的音頻
        playAudio(data.audio_url);
    } catch (error) {
        console.error('翻譯錯誤:', error);
    }
}

// 添加聊天氣泡
function addChatBubble(text, position, isTranslated) {
    const container = document.querySelector('.split-section:not(.top-section) .chat-container');
    const topContainer = document.querySelector('.top-section .chat-container');
    
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${position}`;
    bubble.textContent = text;

    if (isTranslated) {
        const playButton = document.createElement('button');
        playButton.className = 'btn btn-play';
        playButton.textContent = '重新播放';
        playButton.onclick = () => playAudio(currentAudioUrl);
        bubble.appendChild(playButton);
    }

    container.insertBefore(bubble, container.firstChild);
    
    // 為上半部分創建鏡像氣泡
    const mirrorBubble = bubble.cloneNode(true);
    if (isTranslated && mirrorBubble.querySelector('.btn-play')) {
        mirrorBubble.querySelector('.btn-play').onclick = () => playAudio(currentAudioUrl);
    }
    topContainer.insertBefore(mirrorBubble, topContainer.firstChild);
}

// 播放音頻
async function playAudio(audioUrl) {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (currentAudio) {
            currentAudio.pause();
        }

        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        currentAudio = audioContext.createBufferSource();
        currentAudio.buffer = audioBuffer;
        currentAudio.connect(audioContext.destination);
        currentAudio.start(0);
        currentAudioUrl = audioUrl;
    } catch (error) {
        console.error('音頻播放錯誤:', error);
    }
}

// 初始化頁面
document.addEventListener('DOMContentLoaded', () => {
    // 初始化音頻上下文
    document.addEventListener('click', () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }, { once: true });

    // 綁定錄音按鈕事件
    document.querySelectorAll('.btn-record').forEach(button => {
        button.addEventListener('click', () => startRecording(button));
    });

    // 綁定語言選擇事件
    document.querySelectorAll('.language-select').forEach(select => {
        select.addEventListener('change', () => {
            if (isRecording) {
                const recordButton = select.closest('.split-section').querySelector('.btn-record');
                stopRecording(recordButton);
            }
        });
    });
});
