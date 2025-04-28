/* ============================================================================
 * Skyscanner 外站票搜尋 – 簡化版
 * Author: PrismoChen (2025-04-28 02:30 +08)
 * 功能：根據使用者輸入自動產生 4 段外站票查詢網址，並檢查指定日是否有航班 
 * ============================================================================ */

/* ------------------------- ①　資料常數 ------------------------- */


/** A 區域選單 → 城市代碼 */
const AREA_CITIES = {
  japan:      ['NRT', 'KIX', 'CTS', 'NGO'],
  southeast:  ['BKK', 'CNX', 'KUL', 'DAD', 'HAN', 'SGN'],
  hkmo:       ['HKG', 'MFM']
};

/** 城市中文名稱 */
const CITY_NAMES = {NRT:'東京',KIX:'大阪',CTS:'札幌',NGO:'名古屋',BKK:'曼谷',CNX:'清邁',KUL:'吉隆坡',DAD:'峴港',HAN:'河內',SGN:'胡志明市',HKG:'香港',MFM:'澳門',TPE:'台北',KHH:'高雄',SEA:'西雅圖',SFO:'舊金山',LAX:'洛杉磯',JFK:'紐約',EWR:'紐瓦克',BOS:'波士頓',ORD:'芝加哥',LHR:'倫敦',CDG:'巴黎',AMS:'阿姆斯特丹',VIE:'維也納',FRA:'法蘭克福',MUC:'慕尼黑',ZRH:'蘇黎世',FCO:'羅馬',MXP:'米蘭',SYD:'雪梨',AKL:'奧克蘭',PRG:'布拉格',MAN:'曼徹斯特',BRU:'布魯塞爾',MAD:'馬德里',BCN:'巴塞隆納'};

/** 判斷同國家用 */
const CITY_COUNTRY = { BKK:'TH', CNX:'TH', KUL:'MY', DAD:'VN', HAN:'VN', SGN:'VN' };

/* ------------------------- ②　DOM 快取 ------------------------- */

const $ = (id) => document.getElementById(id);
const $area      = $('areaSelect');
const $hub       = $('hubSelect');
const $mid       = $('midSelect');
const $d1        = $('d1');  const $d2 = $('d2');  const $d3 = $('d3');  const $d4 = $('d4');
const $result    = $('resultArea');
const $scheduleM = $('scheduleModal');
const $scheduleT = $('scheduleText');

/* ------------------------- ③　公用工具 ------------------------- */

/** 傳回日期字串 + n 天 (yyyy-mm-dd) */
const addDays   = (d ,n) => { const t = new Date(d); t.setDate(t.getDate()+n); return t.toISOString().slice(0,10); };
/** 傳回日期字串 + n 月 */
const addMonths = (d ,n) => { const t = new Date(d); t.setMonth(t.getMonth()+n); return t.toISOString().slice(0,10); };

/** Skyscanner 多段票網址組裝 */
const skyscannerURL = (segment, cabin) =>
  `https://www.skyscanner.com.tw/transport/d/${segment}/?adults=1&cabinclass=${cabin}&children=0&infants=0`;

/** 顯示 Toast（type = error｜success｜info） */
const showToast = (msg, type='error') => {
  const bg = {error:'bg-red-500', success:'bg-green-500', info:'bg-blue-500'}[type];
  const el = document.createElement('div');
  el.className = `fixed top-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg text-white text-sm z-50 toast ${bg}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('opacity-0','transition-opacity','duration-500'); 
                     setTimeout(() => el.remove(), 500); }, 2000);
};

/* ------------------------- ④　驗證 / 班表 ------------------------- */

/** 日期必須嚴格遞增 */
function validateDates () {
  const arr = [$d1,$d2,$d3,$d4], dates = arr.map(i => new Date(i.value));
  arr.forEach(i => i.classList.remove('border-red-500'));
  for (let i=0;i<3;i++) {
    if (dates[i] >= dates[i+1]) {
      showToast(`第 ${i+1} 個日期必須早於第 ${i+2} 個日期！`);
      arr[i].classList.add('border-red-500'); arr[i].focus();
      return false;
    }
  }
  return true;
}

/** 驗證該城市在所選日期是否有班機 */
function checkFlight (inputEl) {
  const city = $mid.value;
  const weekday = [7,1,2,3,4,5,6][new Date(inputEl.value).getDay()]; // Sunday→7 其餘照原
  // 所有被勾選的航空公司
  document.querySelectorAll('[data-airline]:checked').forEach(cb => {
    const code = cb.dataset.airline;
    const list = FLIGHT_SCHEDULES[code][city];
    if (list && !list.includes(weekday))
      showToast(`${code} 在這天沒有飛 ${city}`, 'info');
  });
}

/** 以表格方式顯示所有班表（純前端 Modal） */
function showFlightSchedules () {
  let html = '';
  for (const [air, map] of Object.entries(FLIGHT_SCHEDULES)) {
    html += `<h3 class="font-bold text-indigo-700 mb-1">【${air}】</h3>
             <table class="w-full text-sm mb-4 border">
             <thead><tr class="bg-indigo-100"><th class="border px-2 py-1">航點</th>
             <th class="border px-2 py-1">每週飛行日</th></tr></thead><tbody>`;
    html += Object.entries(map).map(([city,days]) =>
      `<tr><td class="border px-2 py-1 text-center">${city}</td>
           <td class="border px-2 py-1">${days.map(d=>'一二三四五六日'[d-1]).join('、')}</td></tr>`
    ).join('');
    html += '</tbody></table>';
  }
  $scheduleT.innerHTML = html;
  $scheduleM.classList.remove('hidden');
}

/* ------------------------- ⑤　核心：產生行程 ------------------------- */

/** 產生 a‧b‧c‧d 段組合的查票 table（回傳 DOM）＋帶 LOGO */
function buildTable (from, toList, hub, mid, d) {
  const seg = (a1,a4,b,c) => `${a1}/${d[0]}/${b}/${b}/${d[1]}/${c}/${c}/${d[2]}/${b}/${b}/${d[3]}/${a4}`.toLowerCase();

  const rows = toList.map((to,i) => {
    // 這裡開始處理LOGO
    const logos = [];
    const checkedAirlines = document.querySelectorAll('[data-airline]:checked');
    const dayOfWeek = [7,1,2,3,4,5,6][new Date(d[1]).getDay()]; // 取 date2 的星期
    checkedAirlines.forEach(cb => {
      const code = cb.dataset.airline;   // EVA / STARLUX / CI / CX
      let shortCode = code;
      if (code === 'EVA') shortCode = 'BR';
      if (code === 'STARLUX') shortCode = 'JX';
      // 檢查該航空在 FLIGHT_SCHEDULES 裡，TPE->mid城市，該天是否有班機
      const list = FLIGHT_SCHEDULES[code]?.[mid];
      if (list && list.includes(dayOfWeek)) {
        logos.push(`<img src="./${shortCode}.jpeg" alt="${shortCode}" class="inline h-6 mx-1">`);
      }
    });

    return `
    <tr>
      <td class="border px-4 py-2 text-sm flex items-center gap-2">
        ${CITY_NAMES[from]} 出發，回到 ${CITY_NAMES[to]}，${CITY_NAMES[mid]} 來回
        ${logos.join('')}
      </td>
      <td class="border px-4 py-2">
         <a href="${skyscannerURL(seg(from,to,hub,mid),'economy')}" target="_blank" 
            id="${from}-eco-${i}" class="text-blue-600 hover:underline">經濟艙</a></td>
      <td class="border px-4 py-2">
         <a href="${skyscannerURL(seg(from,to,hub,mid),'business')}" target="_blank" 
            id="${from}-biz-${i}" class="text-blue-600 hover:underline">商務艙</a></td>
    </tr>`;
  }).join('');

  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-2';
  wrapper.innerHTML = `<h3 class="text-2xl font-semibold text-indigo-800">${CITY_NAMES[from]} 出發</h3>
                       <table class="min-w-full table-auto border text-center rounded-xl shadow">
                       <thead><tr class="bg-indigo-100 text-sm">
                       <th class="py-2 px-4 border">行程內容</th>
                       <th class="py-2 px-4 border cursor-pointer text-indigo-600 hover:underline"
                           onclick="batchOpen('${from}','eco')">全部經濟艙</th>
                       <th class="py-2 px-4 border cursor-pointer text-indigo-600 hover:underline"
                           onclick="batchOpen('${from}','biz')">全部商務艙</th></tr></thead>
                       <tbody>${rows}</tbody></table>`;
  return wrapper;
}

/** 依使用者選項產生所有 table */
function generate () {
  if (!validateDates()) return;

  const area   = $area.value;
  const hub    = $hub.value;
  const mid    = $mid.value;
  const dates  = [$d1.value, $d2.value, $d3.value, $d4.value];

  $result.innerHTML = '';  // 清除舊結果
  AREA_CITIES[area].forEach(from => {
    // 只保留同一國家的目的地
    const list = AREA_CITIES[area].filter(to => CITY_COUNTRY[to] === CITY_COUNTRY[from])
                                   .sort((a,b) => (a===from ? -1 : b===from ? 1 : 0));
    $result.appendChild(buildTable(from, list, hub, mid, dates));
  });
  showToast('行程產生成功！', 'success');
}

/* ------------------------- ⑥　批次開窗（每秒一個避免被瀏覽器擋掉） ------------------------- */
function batchOpen (from, cabin) {
  const links = [...document.querySelectorAll(`a[id^='${from}-${cabin}-']`)];
  let i = 0;
  const timer = setInterval(() => {
    if (i >= links.length) return clearInterval(timer);
    window.open(links[i++].href, '_blank');
  }, 1000);
}

/* ------------------------- ⑦　初始化 ------------------------- */

function initDates () {
  const base = addDays(new Date(), 15);
  $d1.value = base;
  $d2.value = addMonths(base,1);
  $d3.value = addMonths(base,2);
  $d4.value = addMonths(base,3);
}

function setupEvents () {
  [$d1,$d2,$d3,$d4].forEach(el => el.addEventListener('change', () => checkFlight(el)));
  $('genBtn').addEventListener('click', generate);
  $('clearBtn').addEventListener('click', () => $result.innerHTML = '');
  $('showScheduleBtn').addEventListener('click', showFlightSchedules);
  $('closeModalBtn').addEventListener('click', () => $scheduleM.classList.add('hidden'));
}

window.addEventListener('DOMContentLoaded', () => { initDates(); setupEvents(); });

function updateLabels() {
  const areaText = document.querySelector('#areaSelect option:checked').textContent;
  const hubText = document.querySelector('#hubSelect option:checked').textContent;
  const midText = document.querySelector('#midSelect option:checked').textContent;

  document.getElementById('label1').textContent = `${areaText} A→B ${hubText}`;
  document.getElementById('label2').textContent = `${hubText} B→C ${midText}`;
  document.getElementById('label3').textContent = `${midText} C→B ${hubText}`;
  document.getElementById('label4').textContent = `${hubText} B→A ${areaText}`;
}

// 每次選單改變時更新
document.getElementById('areaSelect').addEventListener('change', updateLabels);
document.getElementById('hubSelect').addEventListener('change', updateLabels);
document.getElementById('midSelect').addEventListener('change', updateLabels);

// 頁面一開始載入時更新
document.addEventListener('DOMContentLoaded', updateLabels);

function extractChinese(text) {
  const match = text.match(/\((.*?)\)/);
  return match ? match[1] : text;
}

function updateLabels() {
  const areaText = document.querySelector('#areaSelect option:checked').textContent;
  const hubText = document.querySelector('#hubSelect option:checked').textContent;
  const midText = document.querySelector('#midSelect option:checked').textContent;

  const areaName = extractChinese(areaText);
  const hubName = extractChinese(hubText);
  const midName = extractChinese(midText);

  document.getElementById('label1').textContent = `${areaName} A→B ${hubName}`;
  document.getElementById('label2').textContent = `${hubName} B→C ${midName}`;
  document.getElementById('label3').textContent = `${midName} C→B ${hubName}`;
  document.getElementById('label4').textContent = `${hubName} B→A ${areaName}`;
}

document.getElementById('areaSelect').addEventListener('change', updateLabels);
document.getElementById('hubSelect').addEventListener('change', updateLabels);
document.getElementById('midSelect').addEventListener('change', updateLabels);
document.addEventListener('DOMContentLoaded', updateLabels);
