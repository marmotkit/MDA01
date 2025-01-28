// 語音識別相關變量
let recognition = null;
let isRecording = false;
let audioContext = null;
let currentAudio = null;
let currentAudioUrl = null;

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
        const activeSection = document.querySelector('.btn-record.recording').closest('.split-section');
        const targetLang = activeSection.querySelector('.language-select').value;
        const isTopSection = activeSection.classList.contains('top-section');
        translateAndSpeak(finalTranscript, targetLang, isTopSection);
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
        ${section.classList.contains('top-section') ? 'Stop' : '停止對話'}
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
    const isTopSection = button.closest('.split-section').classList.contains('top-section');
    button.innerHTML = `
        <span class="status-indicator"></span>
        ${isTopSection ? 'Start Speaking' : '開始對話'}
    `;
}

// 翻譯並播放
async function translateAndSpeak(text, targetLang, isTopSection) {
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
        
        // 根據說話者的位置決定顯示在哪個容器
        const speakerSection = isTopSection ? '.top-section' : '.bottom-section';
        const listenerSection = isTopSection ? '.bottom-section' : '.top-section';
        
        // 在說話者的容器中顯示原文
        addChatBubble(text, 'right', false, speakerSection);
        // 在聽者的容器中顯示翻譯
        addChatBubble(data.translated_text, 'left', true, listenerSection);

        // 自動播放翻譯後的音頻
        if (data.audio_url) {
            currentAudioUrl = data.audio_url;
            // 確保音頻上下文已初始化
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            await audioContext.resume();
            await playAudio(data.audio_url);
        }
    } catch (error) {
        console.error('翻譯錯誤:', error);
    }
}

// 添加聊天氣泡
function addChatBubble(text, position, isTranslated, sectionSelector) {
    const container = document.querySelector(`${sectionSelector} .chat-container`);
    
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${position}`;
    bubble.textContent = text;

    if (isTranslated) {
        const playButton = document.createElement('button');
        playButton.className = 'btn btn-play';
        playButton.textContent = '準備播放...';
        playButton.disabled = true;
        playButton.onclick = () => playAudio(currentAudioUrl);
        bubble.appendChild(playButton);
    }

    container.insertBefore(bubble, container.firstChild);
    return bubble;
}

// 播放音頻
async function playAudio(audioUrl) {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        await audioContext.resume();

        if (currentAudio) {
            currentAudio.stop();
            currentAudio = null;
        }

        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        currentAudio = audioContext.createBufferSource();
        currentAudio.buffer = audioBuffer;
        currentAudio.connect(audioContext.destination);
        
        // 添加結束事件監聽器
        currentAudio.onended = () => {
            currentAudio = null;
            document.querySelectorAll('.btn-play').forEach(button => {
                button.textContent = '重新播放';
                button.disabled = false;
            });
        };
        
        currentAudio.start(0);
        
        // 更新所有播放按鈕狀態
        document.querySelectorAll('.btn-play').forEach(button => {
            button.textContent = '播放中...';
            button.disabled = true;
        });
        
    } catch (error) {
        console.error('音頻播放錯誤:', error);
        document.querySelectorAll('.btn-play').forEach(button => {
            button.textContent = '重新播放';
            button.disabled = false;
        });
    }
}

// 初始化頁面
document.addEventListener('DOMContentLoaded', () => {
    // 初始化音頻上下文並解除暫停狀態
    document.addEventListener('click', async () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        await audioContext.resume();
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
