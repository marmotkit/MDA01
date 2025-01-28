// 語音識別相關變量
let recognition = null;
let isRecording = false;
let audioContext = null;
let currentAudio = null;
let currentAudioUrl = null;

// 添加全局變量來追踪播放按鈕
let topSectionPlayButton = null;
let bottomSectionPlayButton = null;

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
        console.log('開始翻譯請求:', { text, targetLang });
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
        console.log('收到翻譯響應:', data);
        
        // 在對方的聊天框顯示翻譯
        const listenerSection = isTopSection ? '.bottom-section' : '.top-section';
        const speakerSection = isTopSection ? '.top-section' : '.bottom-section';
        
        // 在說話者的聊天框顯示原文
        addChatBubble(text, 'right', false, speakerSection);
        
        // 在聽者的聊天框顯示翻譯
        addChatBubble(data.translated_text, 'left', false, listenerSection);
        
        // 更新對應區域的播放按鈕
        updatePlayButton(listenerSection, data.audio_url);

    } catch (error) {
        console.error('翻譯或播放錯誤:', error);
        const playButton = isTopSection ? bottomSectionPlayButton : topSectionPlayButton;
        if (playButton) {
            playButton.textContent = '重新播放';
            playButton.disabled = false;
        }
    }
}

// 更新播放按鈕
function updatePlayButton(sectionSelector, audioUrl) {
    if (!audioUrl) {
        console.error('未收到音頻 URL');
        return;
    }

    const section = document.querySelector(sectionSelector);
    let playButton = section.querySelector('.btn-play');
    
    // 如果按鈕不存在，創建一個新的
    if (!playButton) {
        playButton = document.createElement('button');
        playButton.className = 'btn btn-play';
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'play-button-container';
        buttonContainer.appendChild(playButton);
        section.appendChild(buttonContainer);
        
        // 保存按鈕引用
        if (sectionSelector === '.top-section') {
            topSectionPlayButton = playButton;
        } else {
            bottomSectionPlayButton = playButton;
        }
    }

    playButton.textContent = '播放中...';
    playButton.disabled = true;

    // 創建新的音頻對象
    try {
        console.log('準備播放音頻:', audioUrl);
        const audio = new Audio(audioUrl);
        
        // 保存當前音頻 URL 和音頻對象
        currentAudioUrl = audioUrl;
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        currentAudio = audio;
        
        // 設置音頻事件處理
        audio.addEventListener('loadeddata', () => {
            console.log('音頻數據已加載');
            // 使用 play() 方法返回的 Promise
            audio.play().then(() => {
                console.log('開始播放音頻');
            }).catch(error => {
                console.error('播放音頻失敗:', error);
                playButton.textContent = '重新播放';
                playButton.disabled = false;
            });
        });

        audio.addEventListener('play', () => {
            console.log('音頻開始播放');
            playButton.textContent = '播放中...';
            playButton.disabled = true;
        });

        audio.addEventListener('ended', () => {
            console.log('音頻播放完成');
            playButton.textContent = '重新播放';
            playButton.disabled = false;
        });

        audio.addEventListener('error', (error) => {
            console.error('音頻加載失敗:', error);
            playButton.textContent = '重新播放';
            playButton.disabled = false;
        });

        // 設置播放按鈕點擊事件
        playButton.onclick = async () => {
            try {
                playButton.textContent = '播放中...';
                playButton.disabled = true;

                if (currentAudio) {
                    currentAudio.pause();
                    currentAudio.currentTime = 0;
                }

                // 重新創建音頻對象以確保可以重新播放
                const newAudio = new Audio(currentAudioUrl);
                currentAudio = newAudio;

                // 設置事件監聽器
                newAudio.addEventListener('loadeddata', () => {
                    newAudio.play().catch(error => {
                        console.error('重新播放失敗:', error);
                        playButton.textContent = '重新播放';
                        playButton.disabled = false;
                    });
                });

                newAudio.addEventListener('ended', () => {
                    playButton.textContent = '重新播放';
                    playButton.disabled = false;
                });

                newAudio.addEventListener('error', () => {
                    console.error('音頻加載失敗');
                    playButton.textContent = '重新播放';
                    playButton.disabled = false;
                });

                // 開始加載音頻
                newAudio.load();

            } catch (error) {
                console.error('播放按鈕點擊處理錯誤:', error);
                playButton.textContent = '重新播放';
                playButton.disabled = false;
            }
        };

        // 開始加載音頻
        audio.load();
        
    } catch (error) {
        console.error('音頻播放設置失敗:', error);
        playButton.textContent = '重新播放';
        playButton.disabled = false;
    }
}

// 添加聊天氣泡
function addChatBubble(text, position, isTranslated, sectionSelector) {
    const container = document.querySelector(`${sectionSelector} .chat-container`);
    
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${position}`;
    bubble.textContent = text;

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    
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
