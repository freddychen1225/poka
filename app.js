// ==========================================
// 初始化 Supabase
// ==========================================
const SUPABASE_URL = 'https://kjpxpqxbtslvvmeruofo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqcHhwcXhidHNsdnZtZXJ1b2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDAxNjgsImV4cCI6MjA5MzAxNjE2OH0.JAGs-ziFbUsNwXxMkJiKwkiN9O4FVWdDDv5uNfhcPdI';
const FAMILY_ID = 'a3b8e782-ea47-4fc3-842d-dd2e8f7c1ecd';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// ==========================================
// 狀態對應與 DOM 元素
// ==========================================
const statusConfig = {
  arrived: { text: '我到了', icon: '🟢' },
  delayed: { text: '我晚一點', icon: '🔵' },
  with_friend: { text: '跟同學在一起', icon: '🟡' },
  busy: { text: '暫時不方便接', icon: '🟠' },
  sos: { text: 'SOS 緊急求助', icon: '🚨' }
};

const msgEl = document.getElementById('system-msg');
const modal = document.getElementById('confirm-modal');
const modalTitle = document.getElementById('modal-title');
const btnConfirm = document.getElementById('btn-confirm');
const btnCancel = document.getElementById('btn-cancel');
const btnSos = document.querySelector('.btn-red');

let pendingStatusCode = null;
let pressTimer = null;
let isSubmitting = false;


// ==========================================
// 共用 UI helper
// ==========================================
function setSystemMessage(text) {
  msgEl.innerText = text;
}

function openConfirmModal(statusCode, titleText) {
  pendingStatusCode = statusCode;
  modalTitle.innerText = titleText;
  modal.style.display = 'flex';
}

function closeConfirmModal() {
  modal.style.display = 'none';
}

function resetPendingStatus() {
  pendingStatusCode = null;
}

function resetIdleMessage(delay = 3000) {
  setTimeout(() => {
    setSystemMessage('請點擊下方狀態回報');
  }, delay);
}

function setButtonsDisabled(disabled) {
  const buttons = document.querySelectorAll('.status-btn, .btn-red, button');
  buttons.forEach((btn) => {
    if (btn.id === 'btn-cancel' || btn.id === 'btn-confirm') return;
    btn.disabled = disabled;
    btn.style.opacity = disabled ? '0.75' : '1';
    btn.style.pointerEvents = disabled ? 'none' : 'auto';
  });
}


// ==========================================
// 一般按鈕
// ==========================================
function reportStatus(statusCode) {
  if (isSubmitting) return;
  if (statusCode === 'sos') return;
  if (!statusConfig[statusCode]) return;

  openConfirmModal(
    statusCode,
    `傳送「${statusConfig[statusCode].text}」？`
  );
}

btnCancel.onclick = () => {
  closeConfirmModal();
  resetPendingStatus();
  setSystemMessage('請點擊下方狀態回報');
};

btnConfirm.onclick = () => {
  closeConfirmModal();

  if (pendingStatusCode) {
    const statusToSend = pendingStatusCode;
    resetPendingStatus();
    executeLocationAndSend(statusToSend);
  }
};


// ==========================================
// SOS 長按
// ==========================================
if (btnSos) {
  btnSos.addEventListener('contextmenu', (e) => e.preventDefault());

  btnSos.addEventListener(
    'touchstart',
    (e) => {
      if (isSubmitting) return;

      e.preventDefault();
      setSystemMessage('🚨 繼續按住以觸發 SOS...');
      btnSos.style.transform = 'scale(0.94)';

      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(200);

        btnSos.style.transform = 'scale(1)';
        openConfirmModal('sos', '確定要發出 SOS 嗎？');
        setSystemMessage('請確認是否送出 SOS');
      }, 1500);
    },
    { passive: false }
  );

  function cancelPress() {
    clearTimeout(pressTimer);
    btnSos.style.transform = 'scale(1)';

    if (modal.style.display !== 'flex' && !isSubmitting) {
      setSystemMessage('請點擊下方狀態回報');
    }
  }

  btnSos.addEventListener('touchend', cancelPress);
  btnSos.addEventListener('touchcancel', cancelPress);
  btnSos.addEventListener('touchmove', cancelPress);
}


// ==========================================
// 核心發送：寫入 Supabase status_logs
// ==========================================
function executeLocationAndSend(statusCode) {
  if (isSubmitting) return;

  isSubmitting = true;
  setButtonsDisabled(true);
  setSystemMessage('📍 正在取得定位...');

  if (!navigator.geolocation) {
    setSystemMessage('❌ 你的手機不支援定位功能');
    isSubmitting = false;
    setButtonsDisabled(false);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy || null;

        setSystemMessage('☁️ 定位成功，正在傳送給爸媽...');

        const payload = {
          child_name: '樂樂',
          status_code: statusCode,
          lat,
          lng,
          accuracy,
          family_id: FAMILY_ID
        };

        console.log('準備送出 status_logs:', payload);

        const { data, error } = await supabaseClient
          .from('status_logs')
          .insert([payload])
          .select();

        if (error) {
          setSystemMessage('❌ 傳送失敗，請再試一次');
          console.error('Supabase Error:', error);
        } else {
          console.log('status_logs 寫入成功:', data);
          setSystemMessage('✅ 狀態已成功送出！');
          resetIdleMessage(3000);
        }
      } catch (err) {
        setSystemMessage('❌ 傳送失敗，請再試一次');
        console.error('Unexpected Error:', err);
      } finally {
        isSubmitting = false;
        setButtonsDisabled(false);
      }
    },
    (error) => {
      setSystemMessage('❌ 無法取得定位，請確認已開啟 GPS 權限');
      console.error('Location Error:', error);
      isSubmitting = false;
      setButtonsDisabled(false);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}