// タイマー表示パネルの作成
let timerPanel = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let voiceEnabled = true;
let debugTick = 0;
let dragPointerId = null;

function logDebug(message, data = null) {
  if (data) {
    console.log(`[野崎タイマー] ${message}`, data);
  } else {
    console.log(`[野崎タイマー] ${message}`);
  }
}

function logPanelState(context) {
  if (!timerPanel) {
    logDebug(`${context}: panel is null`);
    return;
  }

  const rect = timerPanel.getBoundingClientRect();
  const style = window.getComputedStyle(timerPanel);
  logDebug(`${context}: panel state`, {
    className: timerPanel.className,
    dataset: { ...timerPanel.dataset },
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height)
    },
    style: {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      zIndex: style.zIndex,
      position: style.position,
      top: style.top,
      right: style.right,
      left: style.left
    }
  });
}

// パネルを作成
function createTimerPanel() {
  if (timerPanel) return;
  
  timerPanel = document.createElement('div');
  timerPanel.id = 'nozaki-timer-panel';
  timerPanel.className = 'nozaki-timer-hidden';
  timerPanel.innerHTML = `
    <div class="nozaki-timer-body">
      <div class="nozaki-timer-content">
        <span id="nozaki-timer-value">0</span>秒
      </div>
      <div class="nozaki-timer-controls">
        <button id="nozaki-timer-reset" class="nozaki-timer-reset" type="button">リセット</button>
        <button id="nozaki-timer-voice" class="nozaki-timer-voice" type="button">ボイスON</button>
      </div>
    </div>
  `;
  
  // 初期位置を設定（右上）
  timerPanel.style.top = '20px';
  timerPanel.style.right = '20px';
  
  document.body.appendChild(timerPanel);
  logDebug('timerPanel appended to body');
  logPanelState('after append');
  
  // ドラッグイベントの設定
  setupDragEvents();

  const resetButton = timerPanel.querySelector('#nozaki-timer-reset');
  const voiceButton = timerPanel.querySelector('#nozaki-timer-voice');

  resetButton.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  resetButton.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'RESET_TIMER' });
  });

  voiceButton.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  voiceButton.addEventListener('click', (e) => {
    e.stopPropagation();
    voiceEnabled = !voiceEnabled;
    updateVoiceButton();
    chrome.runtime.sendMessage({ type: 'SET_VOICE_ENABLED', enabled: voiceEnabled });
  });

  updateVoiceButton();
  
  logDebug('タイマーパネル作成完了');
}

// ドラッグ機能の設定
function setupDragEvents() {
  timerPanel.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return;

    isDragging = true;
    dragPointerId = e.pointerId;

    // パネルの現在位置を取得
    const rect = timerPanel.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;

    timerPanel.setPointerCapture(e.pointerId);
    timerPanel.classList.add('nozaki-timer-dragging');
    e.preventDefault();
  });

  timerPanel.addEventListener('pointermove', (e) => {
    if (!isDragging || e.pointerId !== dragPointerId) return;

    // 新しい位置を計算
    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;

    // 画面外に出ないように制限
    const maxX = window.innerWidth - timerPanel.offsetWidth;
    const maxY = window.innerHeight - timerPanel.offsetHeight;

    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    // 位置を更新（right/topではなくleft/topを使用）
    timerPanel.style.left = newX + 'px';
    timerPanel.style.top = newY + 'px';
    timerPanel.style.right = 'auto';

    e.preventDefault();
  });

  const endDrag = (e) => {
    if (!isDragging) return;
    if (dragPointerId !== null && e.pointerId !== undefined && e.pointerId !== dragPointerId) {
      return;
    }
    isDragging = false;
    dragPointerId = null;
    timerPanel.classList.remove('nozaki-timer-dragging');
  };

  timerPanel.addEventListener('pointerup', endDrag);
  timerPanel.addEventListener('pointercancel', endDrag);
  timerPanel.addEventListener('lostpointercapture', endDrag);
}

// タイマー表示を更新
function updateTimerDisplay(isRunning, remainingSeconds) {
  if (!timerPanel) {
    createTimerPanel();
  }
  
  const timerValue = document.getElementById('nozaki-timer-value');

  // 常時表示（未開始時は0のまま）
  timerPanel.classList.remove('nozaki-timer-hidden');
  timerPanel.dataset.running = isRunning ? 'true' : 'false';
  timerValue.textContent = formatRemainingTime(remainingSeconds);

  if (debugTick < 3) {
    logPanelState(`updateTimerDisplay #${debugTick + 1}`);
    debugTick += 1;
  }
}

function formatRemainingTime(remainingSeconds) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// ボイスボタン表示を更新
function updateVoiceButton() {
  if (!timerPanel) {
    return;
  }

  const voiceButton = timerPanel.querySelector('#nozaki-timer-voice');
  if (!voiceButton) {
    return;
  }

  voiceButton.textContent = voiceEnabled ? 'ボイスON' : 'ボイスOFF';
  voiceButton.dataset.state = voiceEnabled ? 'on' : 'off';
}

// 音声読み上げ
function speak(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    speechSynthesis.speak(utterance);
    console.log('音声読み上げ:', text);
  } else {
    console.log('Web Speech API がサポートされていません');
  }
}

// Background scriptからのメッセージを受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'TIMER_UPDATE':
      updateTimerDisplay(message.isRunning, message.remainingSeconds);
      break;
      
    case 'SPEAK':
      speak(message.text);
      break;
  }
});

// ページ読み込み時に初期状態を取得
function initializeTimer() {
  logDebug('initializeTimer start');
  chrome.runtime.sendMessage({ type: 'GET_TIMER_STATE' }, (response) => {
    if (chrome.runtime.lastError) {
      logDebug('GET_TIMER_STATE error', chrome.runtime.lastError.message);
    }
    if (response) {
      logDebug('GET_TIMER_STATE response', response);
      updateTimerDisplay(response.isRunning, response.remainingSeconds);
      if (typeof response.voiceEnabled === 'boolean') {
        voiceEnabled = response.voiceEnabled;
        updateVoiceButton();
      }
    } else {
      logDebug('GET_TIMER_STATE response is empty');
      if (!timerPanel) {
        createTimerPanel();
      }
      updateTimerDisplay(false, 0);
    }
  });
}

// 初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTimer);
} else {
  initializeTimer();
}

logDebug('content script 読み込み完了');
