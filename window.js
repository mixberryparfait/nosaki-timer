const timeEl = document.getElementById('nozaki-time');
const resetButton = document.getElementById('nozaki-reset');
const voiceButton = document.getElementById('nozaki-voice');

let voiceEnabled = true;
let isRunning = false;
let startTime = null;
let duration = 15 * 60 * 1000;
let tickTimeoutId = null;

function formatRemainingTime(remainingSeconds) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function updateVoiceButton() {
  voiceButton.textContent = voiceEnabled ? 'ボイスON' : 'ボイスOFF';
  voiceButton.dataset.state = voiceEnabled ? 'on' : 'off';
}

function updateTimerDisplay() {
  const remainingSeconds = getRemainingSeconds();
  timeEl.textContent = formatRemainingTime(remainingSeconds);
}

function getRemainingSeconds() {
  if (!isRunning || !startTime) {
    return 0;
  }

  const elapsed = Date.now() - startTime;
  const remaining = duration - elapsed;
  return Math.max(0, Math.floor(remaining / 1000));
}

function scheduleNextTick() {
  if (!isRunning || !startTime) {
    clearTick();
    return;
  }

  clearTick();
  updateTimerDisplay();

  const elapsed = Date.now() - startTime;
  const msIntoSecond = elapsed % 1000;
  const delay = msIntoSecond === 0 ? 1000 : 1000 - msIntoSecond;

  tickTimeoutId = setTimeout(() => {
    scheduleNextTick();
  }, delay);
}

function clearTick() {
  if (tickTimeoutId) {
    clearTimeout(tickTimeoutId);
    tickTimeoutId = null;
  }
}

function applyTimerState(state) {
  if (!state) {
    return;
  }

  if (typeof state.startTime === 'number') {
    startTime = state.startTime;
  }
  if (typeof state.duration === 'number') {
    duration = state.duration;
  }
  if (typeof state.isRunning === 'boolean') {
    isRunning = state.isRunning;
  }
  if (typeof state.voiceEnabled === 'boolean') {
    voiceEnabled = state.voiceEnabled;
    updateVoiceButton();
  }

  updateTimerDisplay();
  scheduleNextTick();
}

function speak(text) {
  if (!voiceEnabled) {
    return;
  }

  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    speechSynthesis.speak(utterance);
  }
}

resetButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'RESET_TIMER' }, (response) => {
    if (chrome.runtime.lastError) {
      return;
    }
    if (response) {
      applyTimerState(response);
      return;
    }
    startTime = Date.now();
    isRunning = true;
    updateTimerDisplay();
    scheduleNextTick();
  });
});

voiceButton.addEventListener('click', () => {
  voiceEnabled = !voiceEnabled;
  updateVoiceButton();
  chrome.runtime.sendMessage({ type: 'SET_VOICE_ENABLED', enabled: voiceEnabled });
});

chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case 'TIMER_UPDATE':
      applyTimerState(message);
      break;
    case 'SPEAK':
      speak(message.text);
      break;
  }
});

chrome.runtime.sendMessage({ type: 'GET_TIMER_STATE' }, (response) => {
  if (chrome.runtime.lastError) {
    return;
  }
  applyTimerState(response);
});

updateVoiceButton();
updateTimerDisplay();

function fitWindowToContent() {
  requestAnimationFrame(() => {
    const root = document.documentElement;
    const targetWidth = Math.ceil(root.scrollWidth);
    const targetHeight = Math.ceil(root.scrollHeight);
    const deltaW = window.outerWidth - window.innerWidth;
    const deltaH = window.outerHeight - window.innerHeight;
    const width = Math.max(100, targetWidth + deltaW);
    const height = Math.max(80, targetHeight + deltaH);

    chrome.windows.getCurrent((win) => {
      if (chrome.runtime.lastError || !win) {
        return;
      }
      const needsResize =
        Math.abs(win.width - width) > 1 || Math.abs(win.height - height) > 1;
      if (needsResize) {
        chrome.windows.update(win.id, { width, height });
      }
    });
  });
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    fitWindowToContent();
  });
} else {
  window.addEventListener('load', () => {
    fitWindowToContent();
  });
}
