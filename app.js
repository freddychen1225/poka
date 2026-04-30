// ==========================================
// 初始化 Supabase
// ==========================================
const SUPABASE_URL = 'https://kjpxpqxbtslvvmeruofo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqcHhwcXhidHNsdnZtZXJ1b2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDAxNjgsImV4cCI6MjA5MzAxNjE2OH0.JAGs-ziFbUsNwXxMkJiKwkiN9O4FVWdDDv5uNfhcPdI';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 狀態對應與 DOM 元素
// ==========================================
const statusConfig = {
  arrived:     { text: '我到了', icon: '🟢' },
  delayed:     { text: '我晚一點', icon: '🔵' },
  with_friend: { text: '跟同學在一起', icon: '🟡' },
  busy:        { text: '暫時不方便接', icon: '🟠' },
  sos:         { text: 'SOS 緊急求助', icon: '🚨' }
};

const msgEl = document.getElementById('system-msg');
const modal = document.getElementById('confirm-modal');
const modalTitle = document.getElementById('modal-title');
const btnConfirm = document.getElementById('btn-confirm');
const btnCancel = document.getElementById('btn-cancel');

let pendingStatusCode = null;

// ==========================================
// 一般按鈕
// ==========================================
function reportStatus(statusCode) {
  if (statusCode === 'sos') return;

  pendingStatusCode = statusCode;
  modalTitle.innerText = `傳送「${statusConfig[statusCode].text}」？`;
  modal.style.display = 'flex';
}

btnCancel.onclick = () => {
  modal.style.display = 'none';
  pendingStatusCode = null;
};

btnConfirm.onclick = () => {
  modal.style.display = 'none';
  if (pendingStatusCode) {
    executeLocationAndSend(pendingStatusCode);
  }
};

// ==========================================
// SOS 長按
// ==========================================
const btnSos = document.querySelector('.btn-red');
let pressTimer;

btnSos.addEventListener('contextmenu', e => e.preventDefault());

btnSos.addEventListener('touchstart', (e) => {
  e.preventDefault();
  msgEl.innerText = "🚨 繼續按住以觸發 SOS...";
  btnSos.style.transform = "scale(0.9)";

  pressTimer = setTimeout(() => {
    if (navigator.vibrate) navigator.vibrate(200);
    pendingStatusCode = 'sos';
    modalTitle.innerText = '確定要發出 SOS 嗎？';
    modal.style.display = 'flex';
    btnSos.style.transform = "scale(1)";
    msgEl.innerText = "請點擊下方狀態回報";
  }, 1500);
}, { passive: false });

function cancelPress() {
  clearTimeout(pressTimer);
  btnSos.style.transform = "scale(1)";
  if (pendingStatusCode !== 'sos') {
    msgEl.innerText = "請點擊下方狀態回報";
  }
}

btnSos.addEventListener('touchend', cancelPress);
btnSos.addEventListener('touchcancel', cancelPress);
btnSos.addEventListener('touchmove', cancelPress);

// ==========================================
// 核心發送：只寫入 Supabase
// ==========================================
function executeLocationAndSend(statusCode) {
  msgEl.innerText = "📍 正在取得定位...";

  if (!navigator.geolocation) {
    msgEl.innerText = "❌ 你的手機不支援定位功能";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy || null;

      msgEl.innerText = "☁️ 定位成功，正在傳送給爸媽...";

      const { error } = await supabaseClient.from('status_logs').insert([
        {
          child_name: '樂樂',
          status_code: statusCode,
          lat,
          lng,
          accuracy
        }
      ]);

      if (error) {
        msgEl.innerText = "❌ 傳送失敗";
        console.error("Supabase Error:", error);
      } else {
        msgEl.innerText = "✅ 狀態已成功送出！";
        setTimeout(() => {
          msgEl.innerText = "請點擊下方狀態回報";
        }, 3000);
      }
    },
    (error) => {
      msgEl.innerText = "❌ 無法取得定位，請確認已開啟 GPS 權限";
      console.error("Location Error:", error);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
