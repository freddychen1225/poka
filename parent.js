const SUPABASE_URL = 'https://kjpxpqxbtslvvmeruofo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqcHhwcXhidHNsdnZtZXJ1b2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDAxNjgsImV4cCI6MjA5MzAxNjE2OH0.JAGs-ziFbUsNwXxMkJiKwkiN9O4FVWdDDv5uNfhcPdI';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const statusConfig = {
  arrived: { text: '我到了', icon: '🟢' },
  delayed: { text: '我晚一點', icon: '🔵' },
  with_friend: { text: '跟同學在一起', icon: '🟡' },
  busy: { text: '暫時不方便接', icon: '🟠' },
  sos: { text: 'SOS 緊急求助', icon: '🚨' }
};

const iconEl = document.getElementById('status-icon');
const textEl = document.getElementById('status-text');
const timeEl = document.getElementById('time-text');
const detailEl = document.getElementById('detail-text');
const mapLinkEl = document.getElementById('map-link');
const lastUpdatedEl = document.getElementById('last-updated-text');
const historyListEl = document.getElementById('history-list');

function getStatusKey(record) {
  return record?.status_code || record?.status_type || '';
}

function getRawStatusMessage(record) {
  const raw = record?.message || record?.note || '';
  return String(raw).trim();
}

function getStatusDisplay(record) {
  const key = getStatusKey(record);
  return statusConfig[key] || { text: '未知狀態', icon: '❓' };
}

function updateDashboard(record) {
  if (!record) {
    iconEl.innerText = '📭';
    textEl.innerText = '目前沒有任何紀錄';
    timeEl.innerText = '--';
    detailEl.style.display = 'none';
    detailEl.innerText = '';
    mapLinkEl.href = '#';
    mapLinkEl.classList.add('disabled');
    return;
  }

  const config = getStatusDisplay(record);
  const createdAt = new Date(record.created_at);
  const message = getRawStatusMessage(record);

  iconEl.innerText = config.icon;
  textEl.innerText = config.text;
  timeEl.innerText = `更新時間：${formatDateTime(createdAt)} (${timeAgo(createdAt)})`;

  if (message) {
    detailEl.style.display = 'block';
    detailEl.innerText = message;
  } else {
    detailEl.style.display = 'none';
    detailEl.innerText = '';
  }

  if (record.lat && record.lng) {
    mapLinkEl.href = `https://www.google.com/maps/search/?api=1&query=${record.lat},${record.lng}`;
    mapLinkEl.classList.remove('disabled');
  } else {
    mapLinkEl.href = '#';
    mapLinkEl.classList.add('disabled');
  }
}

function renderHistory(records) {
  if (!records || records.length === 0) {
    historyListEl.innerHTML = `<div class="empty-text">目前沒有任何回報紀錄</div>`;
    return;
  }

  historyListEl.innerHTML = records.map((record) => {
    const config = getStatusDisplay(record);
    const createdAt = new Date(record.created_at);
    const message = getRawStatusMessage(record);
    const safeMessage = escapeHtml(message);

    const messageHtml = message
      ? `<div class="history-message">${safeMessage}</div>`
      : '';

    const hasMap = record.lat && record.lng;
    const mapHtml = hasMap
      ? `<div class="history-actions">
           <a
             class="history-map-link"
             href="https://www.google.com/maps/search/?api=1&query=${record.lat},${record.lng}"
             target="_blank"
             rel="noopener noreferrer"
           >
             📍 在地圖上查看
           </a>
         </div>`
      : '';

    return `
      <div class="history-item">
        <div class="history-top">
          <div class="history-status">${config.icon} ${config.text}</div>
          <div class="history-time">${formatDateTime(createdAt)}</div>
        </div>
        ${messageHtml}
        ${mapHtml}
      </div>
    `;
  }).join('');
}

async function fetchDashboardData() {
  const { data, error } = await supabaseClient
    .from('status_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('讀取失敗:', error);
    textEl.innerText = '資料讀取失敗';
    timeEl.innerText = '--';
    detailEl.style.display = 'none';
    detailEl.innerText = '';
    historyListEl.innerHTML = `<div class="empty-text">讀取紀錄失敗</div>`;
    lastUpdatedEl.innerText = '同步失敗';
    return;
  }

  const records = data || [];
  const latest = records[0] || null;

  updateDashboard(latest);
  renderHistory(records);
  lastUpdatedEl.innerText = latest
    ? `${formatDateTime(new Date(latest.created_at))}（${timeAgo(new Date(latest.created_at))}）`
    : '尚未有任何資料';
}

function subscribeToChanges() {
  supabaseClient
    .channel('public:status_logs')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'status_logs' },
      async () => {
        await fetchDashboardData();
      }
    )
    .subscribe();
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return '剛剛';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分鐘前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;

  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

function formatDateTime(date) {
  return date.toLocaleString('zh-TW', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (char) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return map[char];
  });
}

fetchDashboardData();
subscribeToChanges();