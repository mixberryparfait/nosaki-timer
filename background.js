// タイマーの状態管理
let timerState = {
  isRunning: false,
  startTime: null,
  duration: 15 * 60 * 1000, // 15分（ミリ秒）
  voiceEnabled: true
};

const WINDOW_URL = chrome.runtime.getURL('window.html');

// タイマー開始/リセット
function resetTimer() {
  timerState.isRunning = true;
  timerState.startTime = Date.now();

  // UIに通知
  notifyContentScript();

  console.log('タイマー開始/リセット: 15分');
}

// 残り時間を取得（秒）
function getRemainingSeconds() {
  if (!timerState.isRunning || !timerState.startTime) {
    return 0;
  }
  
  const elapsed = Date.now() - timerState.startTime;
  const remaining = timerState.duration - elapsed;
  return Math.max(0, Math.floor(remaining / 1000));
}

// 残り時間を取得（分）
function getRemainingMinutes() {
  const seconds = getRemainingSeconds();
  return Math.ceil(seconds / 60);
}

// 15分を超えたか判定
function hasExceededDuration() {
  if (!timerState.isRunning || !timerState.startTime) {
    return false;
  }

  const elapsed = Date.now() - timerState.startTime;
  return elapsed >= timerState.duration;
}

// Content scriptに状態を通知
function notifyContentScript() {
  const message = {
    type: 'TIMER_UPDATE',
    isRunning: timerState.isRunning,
    startTime: timerState.startTime,
    duration: timerState.duration
  };

  chrome.runtime.sendMessage(message, () => {
    if (chrome.runtime.lastError) {
      // 受信側がいない場合は無視
    }
  });
}

// 音声読み上げ
function speakText(text) {
  if (!timerState.voiceEnabled) {
    return;
  }

  chrome.runtime.sendMessage({ type: 'SPEAK', text }, () => {
    if (chrome.runtime.lastError) {
      // 受信側がいない場合は無視
    }
  });

  console.log(`音声読み上げ: ${text}`);
}

function speakRemainingTime() {
  const minutes = getRemainingMinutes();
  speakText(`残り${minutes}分`);
}

// APIリクエストを監視
chrome.webRequest.onCompleted.addListener(
  function(details) {
    // kcsapiへのリクエストのみ処理
    if (!details.url.includes('kcsapi')) return;
    
    try {
      const endpoint = details.url.split('kcsapi/')[1];
      if (!endpoint) return;
      
      console.log('API呼び出し:', endpoint);
      
      const endpointPath = endpoint.split('?')[0];
      if (endpointPath !== 'port' && !endpointPath.endsWith('/port')) {
        return;
      }

      // 15分超過ならリセット、未満なら残り分数を読み上げ
      if (!timerState.isRunning || !timerState.startTime) {
        return;
      }

      if (hasExceededDuration()) {
        speakText('リセット');
        resetTimer();
      } else {
        speakRemainingTime();
      }
    } catch (error) {
      console.error('エラー:', error);
    }
  },
  { urls: ["http://*/kcsapi/*", "https://*/kcsapi/*"] }
);

function openOrFocusWindow() {
  chrome.storage.local.get(['nozakiWindowId'], (result) => {
    const windowId = result.nozakiWindowId;
    if (windowId) {
      chrome.windows.get(windowId, (win) => {
        if (chrome.runtime.lastError || !win) {
          createWindow();
          return;
        }
        chrome.windows.update(windowId, { focused: true });
      });
      return;
    }

    createWindow();
  });
}

function createWindow() {
  chrome.windows.create(
    {
      url: WINDOW_URL,
      type: 'popup',
      width: 320,
      height: 120
    },
    (win) => {
      if (win && typeof win.id === 'number') {
        chrome.storage.local.set({ nozakiWindowId: win.id });
      }
    }
  );
}

chrome.windows.onRemoved.addListener((windowId) => {
  chrome.storage.local.get(['nozakiWindowId'], (result) => {
    if (result.nozakiWindowId === windowId) {
      chrome.storage.local.remove(['nozakiWindowId']);
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  openOrFocusWindow();
});

chrome.runtime.onStartup.addListener(() => {
  openOrFocusWindow();
});

chrome.action.onClicked.addListener(() => {
  openOrFocusWindow();
});

// Content scriptからのメッセージ処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TIMER_STATE') {
    console.log('GET_TIMER_STATE request', {
      isRunning: timerState.isRunning,
      remainingSeconds: getRemainingSeconds(),
      voiceEnabled: timerState.voiceEnabled
    });
    sendResponse({
      isRunning: timerState.isRunning,
      remainingSeconds: getRemainingSeconds(),
      startTime: timerState.startTime,
      duration: timerState.duration,
      voiceEnabled: timerState.voiceEnabled
    });
    return;
  }

  if (message.type === 'RESET_TIMER') {
    console.log('RESET_TIMER request');
    resetTimer();
    sendResponse({
      isRunning: timerState.isRunning,
      startTime: timerState.startTime,
      duration: timerState.duration,
      voiceEnabled: timerState.voiceEnabled
    });
    return;
  }

  if (message.type === 'SET_VOICE_ENABLED') {
    console.log('SET_VOICE_ENABLED request', message.enabled);
    timerState.voiceEnabled = !!message.enabled;
  }
});

console.log('野崎タイマー拡張機能が起動しました');
