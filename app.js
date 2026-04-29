// ==========================================
// 初始化 Supabase 與 API Keys
// ==========================================
const SUPABASE_URL = 'https://kjpxpqxbtslvvmeruofo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqcHhwcXhidHNsdnZtZXJ1b2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDAxNjgsImV4cCI6MjA5MzAxNjE2OH0.JAGs-ziFbUsNwXxMkJiKwkiN9O4FVWdDDv5uNfhcPdI';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Telegram Bot 設定
const TG_BOT_TOKEN = '8619455506:AAEDQD8rNc62JmfC_y-9r1lcSU1n4dNJThM';
const TG_CHAT_ID = '-5247063438';

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

// 儲存準備要送出的狀態
let pendingStatusCode = null;


// ==========================================
// 1. 一般按鈕點擊：開啟確認彈窗
// ==========================================
function reportStatus(statusCode) {
  // 如果是 sos，不走這裡（因為 sos 綁了專屬的長按邏輯）
  if (statusCode === 'sos') return; 
  
  pendingStatusCode = statusCode;
  const config = statusConfig[statusCode];
  modalTitle.innerText = `傳送「${config.text}」？`;
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
    if (navigator.vibrate) navigator.vibrate(200); // 手機震動
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
// 3. 核心發送邏輯：打 Supabase + 打 Telegram
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

      // 寫入 Supabase
      const { error } = await supabaseClient.from('status_logs').insert([
        { child_name: '兒子', status_code: statusCode, lat: lat, lng: lng }
      ]);

      if (error) {
        msgEl.innerText = "❌ 傳送失敗";
        console.error("Supabase Error:", error);
      } else {
        msgEl.innerText = "✅ 狀態已成功送出！";
        setTimeout(() => { msgEl.innerText = "請點擊下方狀態回報"; }, 3000);
        
        // 👉 資料庫寫入成功後，觸發 Telegram 通知！
        sendTelegramMessage(statusCode, lat, lng);
      }
    },
    (error) => { 
      msgEl.innerText = "❌ 無法取得定位，請確認已開啟 GPS 權限"; 
      console.error("Location Error:", error);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// ==========================================
// 4. Telegram 推播函數
// ==========================================
async function sendTelegramMessage(statusCode, lat, lng) {
  const config = statusConfig[statusCode];
  const timeString = new Date().toLocaleTimeString('zh-TW', { hour12: false });
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  
  // 組合漂亮的訊息內容 (支援 HTML 語法)
  const messageText = `
<b>${config.icon} Poka 回報</b>
狀態：<b>${config.text}</b>
時間：${timeString}

<a href="${mapUrl}">📍 點我查看目前位置</a>
  `;

  const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
  
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text: messageText,
        parse_mode: "HTML",
        disable_web_page_preview: false
      })
    });
    console.log("Telegram 通知發送成功！");
  } catch (error) {
    console.error("Telegram 發送失敗:", error);
  }
}
