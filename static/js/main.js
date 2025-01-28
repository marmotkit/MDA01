// 語音識別相關變量
let recognition = null;
let isRecording = false;
let audioContext = null;
let currentAudio = null;
let currentAudioUrl = null;

// 添加全局變量來追踪播放按鈕
let topSectionPlayButton = null;
let bottomSectionPlayButton = null;

// 添加全局變量來追踪自動播放狀態
let autoplayEnabled = false;

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
        // 獲取對方區域的語言設置
        const listenerSection = isTopSection ? '.bottom-section' : '.top-section';
        const listenerLang = document.querySelector(`${listenerSection} .language-select`).value;
        
        console.log('開始翻譯請求:', { text, sourceLang: targetLang, targetLang: listenerLang });
        const response = await fetch('/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                source_lang: targetLang,
                target_lang: listenerLang
            })
        });

        if (!response.ok) {
            throw new Error('翻譯請求失敗');
        }

        const data = await response.json();
        console.log('收到翻譯響應:', data);
        
        // 確定說話者和聽者的區域
        const speakerSection = isTopSection ? '.top-section' : '.bottom-section';
        
        // 在說話者的聊天框顯示原文
        addChatBubble(text, 'right', false, speakerSection);
        
        // 在聽者的聊天框顯示翻譯
        if (data.translated_text) {
            addChatBubble(data.translated_text, 'left', true, listenerSection);
            
            // 如果有音頻 URL，創建並預加載音頻
            if (data.audio_url) {
                try {
                    console.log('準備播放翻譯音頻:', data.audio_url);
                    currentAudioUrl = data.audio_url;
                    
                    // 確保播放按鈕存在並更新狀態
                    updatePlayButtonState(listenerSection, '載入中...', true);
                    
                    // 停止當前播放的音頻
                    if (currentAudio) {
                        currentAudio.pause();
                        currentAudio = null;
                    }

                    // 使用 fetch 先完整下載音頻文件
                    const response = await fetch(data.audio_url, {
                        headers: {
                            'Range': 'bytes=0-',  // 請求完整文件
                            'Cache-Control': 'no-cache'  // 禁用緩存
                        }
                    });
                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);

                    // 創建新的音頻對象
                    const audio = new Audio();
                    audio.preload = 'auto';
                    audio.volume = 0;  // 初始設置為靜音
                    audio.muted = true;  // 設置靜音屬性
                    currentAudio = audio;

                    // 設置音頻源
                    audio.src = audioUrl;

                    // 等待音頻加載完成
                    await new Promise((resolve, reject) => {
                        audio.addEventListener('canplaythrough', resolve, { once: true });
                        audio.addEventListener('error', reject, { once: true });
                        audio.load();
                    });

                    console.log('音頻完全加載完成，開始播放');
                    
                    // 先嘗試靜音播放
                    try {
                        await audio.play();
                        console.log('靜音播放成功，準備取消靜音');
                        
                        // 等待用戶交互後取消靜音
                        const unmuteAudio = async () => {
                            try {
                                audio.muted = false;
                                audio.volume = 1.0;
                                console.log('音頻已取消靜音');
                                updatePlayButtonState(listenerSection, '播放中...', true);
                                
                                // 移除事件監聽器
                                document.removeEventListener('click', unmuteAudio);
                                document.removeEventListener('touchstart', unmuteAudio);
                                document.removeEventListener('keydown', unmuteAudio);
                            } catch (error) {
                                console.error('取消靜音失敗:', error);
                            }
                        };

                        // 添加用戶交互事件監聽
                        document.addEventListener('click', unmuteAudio, { once: true });
                        document.addEventListener('touchstart', unmuteAudio, { once: true });
                        document.addEventListener('keydown', unmuteAudio, { once: true });

                        // 監聽播放結束事件
                        audio.addEventListener('ended', () => {
                            console.log('音頻播放結束');
                            updatePlayButtonState(listenerSection, '重新播放', false);
                            currentAudio = null;
                            URL.revokeObjectURL(audioUrl);  // 清理 URL
                        }, { once: true });

                    } catch (error) {
                        console.error('音頻播放失敗:', error);
                        updatePlayButtonState(listenerSection, '重新播放', false);
                        currentAudio = null;
                        URL.revokeObjectURL(audioUrl);  // 清理 URL
                    }

                } catch (error) {
                    console.error('音頻加載失敗:', error);
                    updatePlayButtonState(listenerSection, '重新播放', false);
                    currentAudio = null;
                }
            } else {
                console.error('未收到音頻 URL');
            }
        } else {
            console.error('未收到翻譯文本');
            return;
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
    let playButton, muteButton;

    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.className = 'play-button-container';
        
        // 創建播放按鈕
        playButton = document.createElement('button');
        playButton.className = 'btn btn-play';
        
        // 創建靜音按鈕
        muteButton = document.createElement('button');
        muteButton.className = 'btn btn-mute';
        muteButton.textContent = '🔇';  // 使用表情符號表示靜音狀態
        muteButton.style.marginLeft = '5px';
        
        // 添加按鈕到容器
        buttonContainer.appendChild(playButton);
        buttonContainer.appendChild(muteButton);
        
        // 將按鈕容器插入到語言選擇器之後
        const languageSelect = controlPanel.querySelector('.language-select');
        languageSelect.parentNode.insertBefore(buttonContainer, languageSelect.nextSibling);

        // 保存按鈕引用
        if (sectionSelector === '.top-section') {
            topSectionPlayButton = playButton;
        } else {
            bottomSectionPlayButton = playButton;
        }

        // 設置靜音按鈕點擊事件
        muteButton.onclick = () => {
            if (currentAudio) {
                currentAudio.muted = !currentAudio.muted;
                muteButton.textContent = currentAudio.muted ? '🔇' : '🔊';
                if (!currentAudio.muted) {
                    currentAudio.volume = 1.0;
                }
            }
        };

        // 設置播放按鈕點擊事件
        playButton.onclick = async () => {
            try {
                if (!currentAudioUrl) {
                    console.error('沒有可用的音頻');
                    return;
                }

                console.log('準備重新播放音頻:', currentAudioUrl);
                updatePlayButtonState(sectionSelector, '載入中...', true);

                // 停止當前播放的音頻
                if (currentAudio) {
                    currentAudio.pause();
                    currentAudio = null;
                }

                // 使用 fetch 先完整下載音頻文件
                const response = await fetch(currentAudioUrl, {
                    headers: {
                        'Range': 'bytes=0-',
                        'Cache-Control': 'no-cache'
                    }
                });
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);

                // 創建新的音頻對象
                const audio = new Audio();
                audio.preload = 'auto';
                audio.volume = 1.0;
                audio.muted = true;  // 默認靜音
                audio.src = audioUrl;
                currentAudio = audio;

                // 等待音頻加載完成
                await new Promise((resolve, reject) => {
                    audio.addEventListener('canplaythrough', resolve, { once: true });
                    audio.addEventListener('error', reject, { once: true });
                    audio.load();
                });

                // 播放音頻
                await audio.play();
                console.log('音頻開始播放（靜音狀態）');
                updatePlayButtonState(sectionSelector, '播放中...', true);
                
                // 更新靜音按鈕狀態
                const muteBtn = buttonContainer.querySelector('.btn-mute');
                if (muteBtn) {
                    muteBtn.textContent = '🔇';
                }

                // 監聽播放結束事件
                audio.addEventListener('ended', () => {
                    console.log('音頻播放結束');
                    updatePlayButtonState(sectionSelector, '重新播放', false);
                    currentAudio = null;
                    URL.revokeObjectURL(audioUrl);
                }, { once: true });

            } catch (error) {
                console.error('播放按鈕點擊處理錯誤:', error);
                updatePlayButtonState(sectionSelector, '重新播放', false);
                currentAudio = null;
            }
        };
    } else {
        playButton = buttonContainer.querySelector('.btn-play');
        muteButton = buttonContainer.querySelector('.btn-mute');
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
    // 初始化音頻上下文並解除自動播放限制
    const initAudioContext = async () => {
        try {
            if (!audioContext || audioContext.state === 'closed') {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            console.log('音頻上下文已初始化並解除暫停，狀態:', audioContext.state);

            // 創建一個靜音的音頻並播放，以解除自動播放限制
            const silentAudio = new Audio();
            silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
            try {
                await silentAudio.play();
                console.log('成功解除自動播放限制');
            } catch (error) {
                console.warn('無法解除自動播放限制:', error);
            }
        } catch (error) {
            console.error('音頻上下文初始化失敗:', error);
        }
    };

    // 在用戶首次點擊或觸摸時初始化音頻
    const initOnUserInteraction = async (event) => {
        await initAudioContext();
        // 移除所有事件監聽器
        document.removeEventListener('click', initOnUserInteraction);
        document.removeEventListener('touchstart', initOnUserInteraction);
        document.removeEventListener('keydown', initOnUserInteraction);
    };

    // 添加多種用戶交互事件監聽
    document.addEventListener('click', initOnUserInteraction);
    document.addEventListener('touchstart', initOnUserInteraction);
    document.addEventListener('keydown', initOnUserInteraction);

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

// 修改音頻播放邏輯
async function playAudio(audio, listenerSection) {
    try {
        if (!autoplayEnabled) {
            // 嘗試播放一個靜音的音頻來解除限制
            const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
            try {
                await silentAudio.play();
                autoplayEnabled = true;
                console.log('成功解除自動播放限制');
            } catch (error) {
                console.warn('無法解除自動播放限制:', error);
            }
        }

        await audio.play();
        console.log('音頻開始播放');
        updatePlayButtonState(listenerSection, '播放中...', true);
    } catch (error) {
        console.error('音頻播放失敗:', error);
        updatePlayButtonState(listenerSection, '重新播放', false);
        currentAudio = null;
    }
}
