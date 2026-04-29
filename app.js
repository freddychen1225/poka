// 初始化 Supabase
const SUPABASE_URL = 'https://kjpxpqxbtslvvmeruofo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqcHhwcXhidHNsdnZtZXJ1b2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDAxNjgsImV4cCI6MjA5MzAxNjE2OH0.JAGs-ziFbUsNwXxMkJiKwkiN9O4FVWdDDv5uNfhcPdI';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const msgEl = document.getElementById('system-msg');

// 當孩子按下任何一個狀態按鈕
async function reportStatus(statusCode) {
  msgEl.innerText = "📍 正在取得定位...";
  
  // 檢查瀏覽器是否支援定位
  if (!navigator.geolocation) {
    msgEl.innerText = "❌ 你的手機不支援定位功能";
    return;
  }

  // 取得 GPS 座標
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;
      
      msgEl.innerText = "☁️ 定位成功，正在傳送給爸媽...";

      // 將資料寫入 Supabase
      const { data, error } = await supabase
        .from('status_logs')
        .insert([
          { 
            child_name: '兒子', // MVP 寫死，之後可做登入機制
            status_code: statusCode, 
            lat: lat, 
            lng: lng, 
            accuracy: accuracy 
          }
        ]);

      if (error) {
        console.error(error);
        msgEl.innerText = "❌ 傳送失敗，請檢查網路";
      } else {
        msgEl.innerText = "✅ 狀態已成功送出！";
        // 3秒後恢復原狀
        setTimeout(() => { msgEl.innerText = "請點擊下方狀態回報"; }, 3000);
      }
    },
    (error) => {
      console.error(error);
      msgEl.innerText = "❌ 無法取得定位，請確認是否開啟 GPS 權限";
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // 強制抓取最新高精度定位
  );
}