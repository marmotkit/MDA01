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
                source_lang: 'auto',
                target_lang: targetLang
            })
        });

        if (!response.ok) {
            throw new Error('翻譯請求失敗');
        }

        const data = await response.json();
        console.log('收到翻譯響應:', data);
        
        // 確定說話者和聽者的區域
        const listenerSection = isTopSection ? '.bottom-section' : '.top-section';
        const speakerSection = isTopSection ? '.top-section' : '.bottom-section';
        
        // 在說話者的聊天框顯示原文
        addChatBubble(text, 'right', false, speakerSection);
        
        // 在聽者的聊天框顯示翻譯
        if (data.translated_text) {
            addChatBubble(data.translated_text, 'left', false, listenerSection);
        } else {
            console.error('未收到翻譯文本');
            return;
        }
        
        // 更新對應區域的播放按鈕並播放音頻
        if (data.audio_url) {
            try {
                console.log('準備播放音頻:', data.audio_url);
                
                // 創建新的音頻對象
                const audio = new Audio(data.audio_url);
                
                // 停止當前播放的音頻
                if (currentAudio) {
                    currentAudio.pause();
                    currentAudio.currentTime = 0;
                }
                
                // 更新當前音頻
                currentAudio = audio;
                currentAudioUrl = data.audio_url;

                // 更新按鈕狀態
                updatePlayButtonState(listenerSection, '播放中...', true);

                // 等待音頻加載
                await new Promise((resolve, reject) => {
                    const loadHandler = () => {
                        console.log('音頻加載完成');
                        resolve();
                    };
                    const errorHandler = (error) => {
                        console.error('音頻加載失敗:', error);
                        reject(error);
                    };
                    
                    audio.addEventListener('canplaythrough', loadHandler, { once: true });
                    audio.addEventListener('error', errorHandler, { once: true });
                    
                    // 開始加載
                    audio.load();
                });

                // 播放音頻
                await audio.play();
                console.log('音頻開始播放');

                // 監聽播放結束事件
                audio.addEventListener('ended', () => {
                    console.log('音頻播放結束');
                    updatePlayButtonState(listenerSection, '重新播放', false);
                }, { once: true });

            } catch (error) {
                console.error('音頻播放失敗:', error);
                updatePlayButtonState(listenerSection, '重新播放', false);
            }
        } else {
            console.error('未收到音頻 URL');
        }

    } catch (error) {
        console.error('翻譯或播放錯誤:', error);
        const playButton = isTopSection ? bottomSectionPlayButton : topSectionPlayButton;
        if (playButton) {
            playButton.textContent = '重新播放';
            playButton.disabled = false;
        }
    }
}

// 更新播放按鈕狀態
function updatePlayButtonState(sectionSelector, text, disabled) {
    const section = document.querySelector(sectionSelector);
    const controlPanel = section.querySelector('.control-panel');
    let buttonContainer = controlPanel.querySelector('.play-button-container');
    let playButton;

    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.className = 'play-button-container';
        playButton = document.createElement('button');
        playButton.className = 'btn btn-play';
        buttonContainer.appendChild(playButton);
        
        // 將按鈕容器插入到語言選擇器之後
        const languageSelect = controlPanel.querySelector('.language-select');
        languageSelect.parentNode.insertBefore(buttonContainer, languageSelect.nextSibling);

        // 保存按鈕引用
        if (sectionSelector === '.top-section') {
            topSectionPlayButton = playButton;
        } else {
            bottomSectionPlayButton = playButton;
        }

        // 設置播放按鈕點擊事件
        playButton.onclick = async () => {
            try {
                if (!currentAudioUrl) {
                    console.error('沒有可用的音頻');
                    return;
                }

                console.log('準備重新播放音頻:', currentAudioUrl);
                updatePlayButtonState(sectionSelector, '播放中...', true);

                // 停止當前播放的音頻
                if (currentAudio) {
                    currentAudio.pause();
                    currentAudio.currentTime = 0;
                }

                // 創建新的音頻對象
                const newAudio = new Audio(currentAudioUrl);
                currentAudio = newAudio;

                // 等待音頻加載
                await new Promise((resolve, reject) => {
                    const loadHandler = () => {
                        console.log('音頻加載完成');
                        resolve();
                    };
                    const errorHandler = (error) => {
                        console.error('音頻加載失敗:', error);
                        reject(error);
                    };
                    
                    newAudio.addEventListener('canplaythrough', loadHandler, { once: true });
                    newAudio.addEventListener('error', errorHandler, { once: true });
                    
                    // 開始加載
                    newAudio.load();
                });

                // 播放音頻
                await newAudio.play();
                console.log('音頻開始播放');

                // 監聽播放結束事件
                newAudio.addEventListener('ended', () => {
                    console.log('音頻播放結束');
                    updatePlayButtonState(sectionSelector, '重新播放', false);
                }, { once: true });

            } catch (error) {
                console.error('播放按鈕點擊處理錯誤:', error);
                updatePlayButtonState(sectionSelector, '重新播放', false);
            }
        };
    } else {
        playButton = buttonContainer.querySelector('.btn-play');
    }

    if (playButton) {
        playButton.textContent = text;
        playButton.disabled = disabled;
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
