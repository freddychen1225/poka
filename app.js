// 初始化 Supabase
// 請把下面的單引號內容換成你的，而且必須在同一行結束！
const SUPABASE_URL = 'https://kjpxpqxbtslvvmeruofo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqcHhwcXhidHNsdnZtZXJ1b2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDAxNjgsImV4cCI6MjA5MzAxNjE2OH0.JAGs-ziFbUsNwXxMkJiKwkiN9O4FVWdDDv5uNfhcPdI';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const msgEl = document.getElementById('system-msg');
const modal = document.getElementById('confirm-modal');
const modalTitle = document.getElementById('modal-title');
const btnConfirm = document.getElementById('btn-confirm');
const btnCancel = document.getElementById('btn-cancel');

// 儲存準備要送出的狀態
let pendingStatusCode = null;

// 狀態對應的中文，用於彈窗顯示
const statusLabels = {
  arrived: '我到了',
  delayed: '我晚一點',
  with_friend: '跟同學在一起',
  busy: '暫時不方便接',
  sos: 'SOS 緊急求助'
};

// ==========================================
// 1. 一般按鈕點擊：不直接送出，而是開啟確認彈窗
// ==========================================
function reportStatus(statusCode) {
  // 如果是 sos，不走這裡（因為 sos 綁了專屬的長按邏輯）
  if(statusCode === 'sos') return; 
  
  pendingStatusCode = statusCode;
  modalTitle.innerText = `傳送「${statusLabels[statusCode]}」？`;
  modal.style.display = 'flex'; // 顯示彈窗
}

// 彈窗的取消按鈕
btnCancel.onclick = () => {
  modal.style.display = 'none';
  pendingStatusCode = null;
};

// 彈窗的確認按鈕：正式觸發定位與資料庫寫入
btnConfirm.onclick = () => {
  modal.style.display = 'none'; // 隱藏彈窗
  if (pendingStatusCode) {
    executeLocationAndSend(pendingStatusCode);
  }
};

// ==========================================
// 2. SOS 專屬：長按 1.5 秒機制
// ==========================================
const btnSos = document.querySelector('.btn-red');
let pressTimer;

// 防止長按時跑出瀏覽器右鍵選單
btnSos.addEventListener('contextmenu', e => e.preventDefault());

// 手指按下去開始計時
btnSos.addEventListener('touchstart', (e) => {
  e.preventDefault(); // 防止預設點擊事件
  msgEl.innerText = "🚨 繼續按住以觸發 SOS...";
  btnSos.style.transform = "scale(0.9)"; // 視覺回饋
  
  pressTimer = setTimeout(() => {
    // 按滿 1.5 秒後觸發
    navigator.vibrate && navigator.vibrate(200); // 手機震動
    pendingStatusCode = 'sos';
    modalTitle.innerText = `確定要發出 SOS 嗎？`;
    modal.style.display = 'flex';
    btnSos.style.transform = "scale(1)";
    msgEl.innerText = "請點擊下方狀態回報";
  }, 1500); // 1500 毫秒 = 1.5 秒
}, { passive: false });

// 手指放開或滑走時取消計時
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
// 3. 核心發送邏輯 (跟原本一樣，只是抽成獨立函數)
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
      msgEl.innerText = "☁️ 定位成功，正在傳送給爸媽...";

      const { error } = await supabaseClient.from('status_logs').insert([
        { child_name: '兒子', status_code: statusCode, lat: lat, lng: lng }
      ]);

      if (error) {
        msgEl.innerText = "❌ 傳送失敗";
      } else {
        msgEl.innerText = "✅ 狀態已成功送出！";
        setTimeout(() => { msgEl.innerText = "請點擊下方狀態回報"; }, 3000);
      }
    },
    (error) => { msgEl.innerText = "❌ 無法取得定位"; },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}