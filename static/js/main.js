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
    recognition.continuous = false;  // 改為單次識別
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
        
        // 在自己的聊天框顯示原文
        addChatBubble(finalTranscript, 'right', false, isTopSection ? '.top-section' : '.bottom-section');
        
        // 自動停止錄音
        stopRecording();
        
        // 進行翻譯並在對方聊天框顯示
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
    // 不再自動重新開始錄音
    stopRecording();
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
    
    if (!button) return;
    
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
        
        // 在對方的聊天框顯示翻譯
        const listenerSection = isTopSection ? '.bottom-section' : '.top-section';
        const translatedBubble = addChatBubble(data.translated_text, 'left', true, listenerSection);

        // 播放翻譯後的音頻
        if (data.audio_url) {
            try {
                // 初始化音頻上下文（如果需要）
                if (!audioContext) {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                
                // 先嘗試解除音頻上下文的暫停狀態
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }

                // 獲取音頻數據
                const audioResponse = await fetch(data.audio_url);
                if (!audioResponse.ok) {
                    throw new Error('無法獲取音頻數據');
                }
                const arrayBuffer = await audioResponse.arrayBuffer();
                
                // 解碼音頻數據
                console.log('開始解碼音頻數據...');
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                console.log('音頻數據解碼完成');

                // 停止當前正在播放的音頻
                if (currentAudio) {
                    currentAudio.stop();
                    currentAudio = null;
                }

                // 創建新的音頻源
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);

                // 設置播放完成的處理
                source.onended = () => {
                    console.log('音頻播放完成');
                    currentAudio = null;
                    document.querySelectorAll('.btn-play').forEach(button => {
                        button.textContent = '重新播放';
                        button.disabled = false;
                    });
                };

                // 開始播放
                console.log('開始播放音頻...');
                source.start(0);
                currentAudio = source;
                currentAudioUrl = data.audio_url;
                console.log('音頻開始播放');
            } catch (error) {
                console.error('音頻播放失敗:', error);
                document.querySelectorAll('.btn-play').forEach(button => {
                    button.textContent = '重新播放';
                    button.disabled = false;
                });
            }
        }
    } catch (error) {
        console.error('翻譯或播放錯誤:', error);
        document.querySelectorAll('.btn-play').forEach(button => {
            button.textContent = '重新播放';
            button.disabled = false;
        });
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
        playButton.textContent = '播放中...';
        playButton.disabled = true;
        playButton.onclick = async () => {
            try {
                // 檢查音頻上下文狀態
                if (!audioContext || audioContext.state === 'closed') {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }

                playButton.textContent = '播放中...';
                playButton.disabled = true;

                // 獲取並播放音頻
                const response = await fetch(currentAudioUrl);
                if (!response.ok) {
                    throw new Error('無法獲取音頻數據');
                }
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                if (currentAudio) {
                    currentAudio.stop();
                    currentAudio = null;
                }

                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);

                source.onended = () => {
                    currentAudio = null;
                    playButton.textContent = '重新播放';
                    playButton.disabled = false;
                };

                source.start(0);
                currentAudio = source;
            } catch (error) {
                console.error('重新播放失敗:', error);
                playButton.textContent = '重新播放';
                playButton.disabled = false;
            }
        };
        bubble.appendChild(playButton);
    }

    container.insertBefore(bubble, container.firstChild);
    return bubble;
}

// 初始化頁面
document.addEventListener('DOMContentLoaded', () => {
    // 初始化音頻上下文
    document.addEventListener('click', async () => {
        try {
            if (!audioContext || audioContext.state === 'closed') {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            console.log('音頻上下文已初始化並解除暫停，狀態:', audioContext.state);
        } catch (error) {
            console.error('音頻上下文初始化失敗:', error);
        }
    });

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
