// 語音識別相關變量
let recognition = null;
let isRecording = false;
let audioContext = null;
let currentAudio = null;
let currentAudioUrl = null;

// 添加全局變量來追踪播放按鈕
let topSectionPlayButton = null;
let bottomSectionPlayButton = null;

// 添加全局變量來追踪自動播放狀態和用戶交互
let autoplayEnabled = false;
let userInteracted = false;

// 添加全局變量
let isMuted = true;  // 默認靜音

// 初始化音頻上下文
async function initAudioContext() {
    try {
        if (!audioContext || audioContext.state === 'closed') {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        console.log('音頻上下文已初始化並解除暫停，狀態:', audioContext.state);
        return true;
    } catch (error) {
        console.error('音頻上下文初始化失敗:', error);
        return false;
    }
}

// 在用戶首次交互時初始化音頻
async function initOnUserInteraction(event) {
    console.log('用戶交互事件觸發:', event.type);
    userInteracted = true;
    isMuted = false;  // 用戶交互後取消靜音
    await initAudioContext();
    
    // 更新所有靜音按鈕的顯示
    document.querySelectorAll('.btn-mute').forEach(btn => {
        btn.textContent = isMuted ? '🔇' : '🔊';
    });
    
    // 移除所有事件監聽器
    document.removeEventListener('click', initOnUserInteraction);
    document.removeEventListener('touchstart', initOnUserInteraction);
    document.removeEventListener('keydown', initOnUserInteraction);
    
    console.log('音頻初始化完成，已取消靜音');
}

// 初始化語音識別
function initSpeechRecognition(targetLang) {
    try {
        if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
            console.error('瀏覽器不支持語音識別');
            alert('您的瀏覽器不支持語音識別功能，請使用 Chrome 瀏覽器。');
            return;
        }

        if (recognition) {
            recognition.stop();
            recognition = null;
        }

        // 使用標準 SpeechRecognition 或 webkitSpeechRecognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();

        recognition.continuous = false;  // 改為單次識別
        recognition.interimResults = true;
        recognition.lang = targetLang;
        recognition.maxAlternatives = 1;

        console.log('初始化語音識別:', { targetLang });

        recognition.onstart = () => {
            console.log('開始語音識別');
            isRecording = true;
        };

        recognition.onresult = (event) => {
            console.log('收到語音識別結果:', event);
            handleRecognitionResult(event);
        };
        
        recognition.onerror = (event) => {
            console.error('語音識別錯誤:', event.error);
            alert('語音識別錯誤: ' + event.error);
            stopRecording();
        };
        
        recognition.onend = () => {
            console.log('語音識別結束');
            stopRecording();
        };

        return recognition;

    } catch (error) {
        console.error('初始化語音識別失敗:', error);
        alert('初始化語音識別失敗: ' + error.message);
        stopRecording();
        return null;
    }
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

    console.log('語音識別結果:', { finalTranscript, interimTranscript });

    if (finalTranscript) {
        const activeSection = document.querySelector('.btn-record.recording').closest('.split-section');
        if (!activeSection) {
            console.error('找不到活動的錄音區域');
            return;
        }

        const targetLang = activeSection.querySelector('.language-select').value;
        const isTopSection = activeSection.classList.contains('top-section');
        
        console.log('準備翻譯:', { text: finalTranscript, targetLang, isTopSection });
        
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

// 創建一個短的靜音音頻
function createSilentAudio() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0;  // 完全靜音
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    setTimeout(() => {
        oscillator.stop();
        audioContext.close();
    }, 50);
}

// 更新按鈕狀態
function updateButtonState(button, state, isTopSection) {
    const statusIndicator = button.querySelector('.status-indicator');
    
    switch (state) {
        case 'ready':
            button.classList.remove('recording', 'playing', 'translating');
            statusIndicator.classList.remove('active', 'playing', 'translating');
            button.innerHTML = `
                <span class="status-indicator"></span>
                ${isTopSection ? 'Start Speaking' : '開始對話'}
            `;
            break;
            
        case 'recording':
            button.classList.add('recording');
            button.classList.remove('playing', 'translating');
            statusIndicator.classList.add('active');
            statusIndicator.classList.remove('playing', 'translating');
            button.innerHTML = `
                <span class="status-indicator active"></span>
                ${isTopSection ? 'Stop' : '停止對話'}
            `;
            break;
            
        case 'translating':
            button.classList.add('translating');
            button.classList.remove('recording', 'playing');
            statusIndicator.classList.add('translating');
            statusIndicator.classList.remove('active', 'playing');
            button.innerHTML = `
                <span class="status-indicator translating"></span>
                ${isTopSection ? 'Translating...' : '翻譯中...'}
            `;
            break;
            
        case 'playing':
            button.classList.add('playing');
            button.classList.remove('recording', 'translating');
            statusIndicator.classList.add('playing');
            statusIndicator.classList.remove('active', 'translating');
            button.innerHTML = `
                <span class="status-indicator playing"></span>
                ${isTopSection ? 'Playing...' : '播放中...'}
            `;
            break;
    }
}

// 修改開始錄音函數
async function startRecording(button) {
    try {
        const isTopSection = button.closest('.split-section').classList.contains('top-section');
        
        // 如果正在播放，停止播放
        if (button.classList.contains('playing')) {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }
            updateButtonState(button, 'ready', isTopSection);
            return;
        }
        
        // 如果正在錄音，停止錄音
        if (isRecording) {
            stopRecording();
            return;
        }

        // 如果是第一次點擊，初始化音頻
        if (!userInteracted) {
            console.log('首次用戶交互，初始化音頻...');
            userInteracted = true;
            await initAudioContext();
            createSilentAudio();
        }

        const section = button.closest('.split-section');
        const targetLang = section.querySelector('.language-select').value;
        
        console.log('開始錄音:', { targetLang });
        
        // 停止其他部分的錄音和播放
        document.querySelectorAll('.btn-record').forEach(btn => {
            if (btn !== button && (btn.classList.contains('recording') || btn.classList.contains('playing'))) {
                stopRecording(btn);
            }
        });

        const newRecognition = initSpeechRecognition(targetLang);
        
        if (!newRecognition) {
            console.error('語音識別未初始化');
            return;
        }
        
        updateButtonState(button, 'recording', isTopSection);
        
        newRecognition.start();
        console.log('語音識別已啟動');

    } catch (error) {
        console.error('開始錄音失敗:', error);
        alert('開始錄音失敗: ' + error.message);
        stopRecording();
    }
}

// 修改停止錄音函數
function stopRecording(button) {
    try {
        if (!button) {
            button = document.querySelector('.btn-record.recording');
        }
        
        if (!button) return;
        
        if (recognition) {
            recognition.stop();
            recognition = null;
        }
        
        isRecording = false;
        const isTopSection = button.closest('.split-section').classList.contains('top-section');
        updateButtonState(button, 'ready', isTopSection);
        
    } catch (error) {
        console.error('停止錄音失敗:', error);
        alert('停止錄音失敗: ' + error.message);
    }
}

// 修改翻譯和播放函數
async function translateAndSpeak(text, targetLang, isTopSection) {
    try {
        const speakerSection = isTopSection ? '.top-section' : '.bottom-section';
        const listenerSection = isTopSection ? '.bottom-section' : '.top-section';
        const listenerLang = document.querySelector(`${listenerSection} .language-select`).value;
        
        // 更新按鈕狀態為翻譯中
        const button = document.querySelector(`${speakerSection} .btn-record`);
        const isTopSectionButton = button.closest('.split-section').classList.contains('top-section');
        updateButtonState(button, 'translating', isTopSectionButton);
        
        // 在說話者的聊天框顯示原文
        addChatBubble(text, 'right', false, speakerSection);

        const response = await fetch('/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                source_lang: targetLang,
                target_lang: listenerLang
            })
        });

        if (!response.ok) {
            throw new Error(`翻譯請求失敗: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(`翻譯錯誤: ${data.error}`);
        }
        
        if (data.translated_text) {
            addChatBubble(data.translated_text, 'left', true, listenerSection);
            
            if (data.audio_url) {
                try {
                    console.log('準備播放翻譯音頻:', data.audio_url);
                    
                    // 停止當前播放的音頻
                    if (currentAudio) {
                        currentAudio.pause();
                        currentAudio = null;
                    }

                    // 創建新的音頻對象
                    const audio = new Audio(data.audio_url);
                    currentAudio = audio;
                    currentAudioUrl = data.audio_url;

                    // 設置音頻事件
                    audio.addEventListener('ended', () => {
                        console.log('音頻播放結束');
                        updateButtonState(button, 'ready', isTopSectionButton);
                        currentAudio = null;
                    });

                    audio.addEventListener('error', (e) => {
                        console.error('音頻播放錯誤:', e);
                        updateButtonState(button, 'ready', isTopSectionButton);
                        currentAudio = null;
                    });

                    // 播放音頻前先更新按鈕狀態
                    updateButtonState(button, 'playing', isTopSectionButton);
                    
                    // 播放音頻
                    await audio.play();
                    console.log('音頻開始播放');

                } catch (error) {
                    console.error('音頻處理失敗:', error);
                    updateButtonState(button, 'ready', isTopSectionButton);
                }
            }
        }

    } catch (error) {
        console.error('翻譯或播放錯誤:', error);
        alert('翻譯或播放過程中發生錯誤：' + error.message);
        const button = document.querySelector(`${speakerSection} .btn-record`);
        const isTopSectionButton = button.closest('.split-section').classList.contains('top-section');
        updateButtonState(button, 'ready', isTopSectionButton);
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
    // 設置默認語言
    document.querySelectorAll('.language-select').forEach(select => {
        const isTopSection = select.closest('.split-section').classList.contains('top-section');
        select.value = isTopSection ? 'en-US' : 'zh-TW';
    });

    // 添加多種用戶交互事件監聽
    document.addEventListener('click', initOnUserInteraction);
    document.addEventListener('touchstart', initOnUserInteraction);
    document.addEventListener('keydown', initOnUserInteraction);

    // 綁定錄音按鈕事件
    document.querySelectorAll('.btn-record').forEach(button => {
        const isTopSection = button.closest('.split-section').classList.contains('top-section');
        updateButtonState(button, 'ready', isTopSection);
        
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

    // 添加靜音按鈕到每個控制面板
    document.querySelectorAll('.control-panel').forEach(panel => {
        const muteButton = document.createElement('button');
        muteButton.className = 'btn btn-mute';
        muteButton.textContent = isMuted ? '🔇' : '🔊';
        muteButton.onclick = toggleMute;
        panel.insertBefore(muteButton, panel.querySelector('.btn-record'));
    });
});

// 切換靜音狀態
function toggleMute() {
    isMuted = !isMuted;
    // 更新所有靜音按鈕的顯示
    document.querySelectorAll('.btn-mute').forEach(btn => {
        btn.textContent = isMuted ? '🔇' : '🔊';
    });
    
    // 如果當前有音頻在播放，更新其靜音狀態
    if (currentAudio) {
        currentAudio.muted = isMuted;
        currentAudio.volume = isMuted ? 0 : 1.0;
    }
}
