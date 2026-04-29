// 初始化 Supabase
const SUPABASE_URL = 'https://kjpxpqxbtslvvmeruofo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqcHhwcXhidHNsdnZtZXJ1b2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDAxNjgsImV4cCI6MjA5MzAxNjE2OH0.JAGs-ziFbUsNwXxMkJiKwkiN9O4FVWdDDv5uNfhcPdI';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 狀態碼與中文/圖示的對應表
const statusConfig = {
  arrived:     { text: '我到了', icon: '🟢' },
  delayed:     { text: '我晚一點', icon: '🔵' },
  with_friend: { text: '跟同學在一起', icon: '🟡' },
  busy:        { text: '暫時不方便接', icon: '🟠' },
  sos:         { text: 'SOS 緊急求助', icon: '🚨' }
};

// 抓取畫面上要更新的 HTML 元素
const iconEl = document.getElementById('status-icon');
const textEl = document.getElementById('status-text');
const timeEl = document.getElementById('time-text');
const mapLinkEl = document.getElementById('map-link');

// 將資料更新到畫面上
function updateDashboard(record) {
  if (!record) {
    textEl.innerText = "目前沒有任何紀錄";
    iconEl.innerText = "📭";
    return;
  }

  // 取得對應的文字與圖示
  const config = statusConfig[record.status_code] || { text: '未知狀態', icon: '❓' };
  
  // 更新文字與圖示
  iconEl.innerText = config.icon;
  textEl.innerText = config.text;

  // 計算並顯示「多久以前」
  const date = new Date(record.created_at);
  timeEl.innerText = `更新時間：${date.toLocaleTimeString('zh-TW')} (${timeAgo(date)})`;

  // 更新 Google Maps 連結
  if (record.lat && record.lng) {
    mapLinkEl.href = `https://www.google.com/maps/search/?api=1&query=${record.lat},${record.lng}`;
    mapLinkEl.classList.remove('disabled');
  }
}

// 首次載入：抓取最新一筆紀錄
async function fetchLatestStatus() {
  const { data, error } = await supabaseClient
    .from('status_logs')
    .select('*')
    .order('created_at', { ascending: false }) // 依時間倒序
    .limit(1); // 只抓最新 1 筆

  if (error) {
    console.error("讀取失敗:", error);
    textEl.innerText = "資料讀取失敗";
    return;
  }

  updateDashboard(data[0]);
}

// 啟用即時監聽 (當孩子端有新打卡時，家長端瞬間更新)
function subscribeToChanges() {
  supabaseClient
    .channel('public:status_logs')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'status_logs' }, payload => {
      console.log('收到新狀態！', payload.new);
      updateDashboard(payload.new);
    })
    .subscribe();
}

// 一個簡單的「幾分鐘前」計算函數
function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return '剛剛';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  return `${Math.floor(hours / 24)} 天前`;
}

// 啟動程式
fetchLatestStatus();
subscribeToChanges();