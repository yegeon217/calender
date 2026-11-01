// 월·주 달력 그리기와 날짜 상세 시트
const WD = "일월화수목금토";
const DAY = 864e5;
const p2 = n => String(n).padStart(2, "0");
export const isoOf = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const dayOf = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// 화면에 보이는 날짜 범위 [start, end)
export function monthRange(cur) {
  const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const days = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((first.getDay() + days) / 7);
  const start = addDays(first, -first.getDay());
  return { start, end: addDays(start, weeks * 7), weeks };
}
export function weekRange(cur) {
  const start = addDays(dayOf(cur), -cur.getDay());
  return { start, end: addDays(start, 7) };
}

export function titleFor(view, cur) {
  if (view === "month") return `${cur.getFullYear()}년 ${cur.getMonth() + 1}월`;
  const { start } = weekRange(cur), last = addDays(start, 6);
  const tail = last.getMonth() === start.getMonth() ? `${last.getDate()}일` : `${last.getMonth() + 1}월 ${last.getDate()}일`;
  return `${start.getMonth() + 1}월 ${start.getDate()}일 – ${tail}`;
}

// 날짜별 일정 목록. 하루 종일·24시간 넘는 일정은 걸친 날마다, 짧은 일정은 시작한 날에만 보여줌
export function byDay(events, start, end) {
  const map = new Map();
  for (const e of events) {
    const a = dayOf(e.start);
    const b = e.allDay || e.end - e.start >= DAY ? dayOf(new Date(e.end - 1)) : a;
    for (let d = a < start ? start : a; d <= b && d < end; d = addDays(d, 1)) {
      const k = isoOf(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    }
  }
  map.forEach(a => a.sort((x, y) => (y.allDay - x.allDay) || (x.start - y.start) || x.title.localeCompare(y.title)));
  return map;
}

const hm = d => (d.getMinutes() ? `${d.getHours()}:${p2(d.getMinutes())}` : `${d.getHours()}`);
const multi = e => e.allDay || e.end - e.start >= DAY;
// 배경색에 맞춰 글자색 고르기
function fg(c) {
  const n = parseInt(c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? "#10131a" : "#fff";
}
const chip = e =>
  `<div class="chip" style="background:${e.color};color:${fg(e.color)}"><b>${esc(e.title)}</b>${multi(e) ? "" : `<span>${hm(e.start)}–<wbr>${hm(e.end)}</span>`}</div>`;

function dayClass(d, today, extra) {
  const k = isoOf(d), c = [extra];
  if (d.getDay() === 0) c.push("sun");
  if (d.getDay() === 6) c.push("sat");
  if (k < today) c.push("past");
  if (k === today) c.push("today");
  return c.join(" ");
}

export function renderMonth(root, cur, map) {
  const { start, weeks } = monthRange(cur), today = isoOf(new Date());
  let h = `<div class="dows">` + [...WD].map((w, i) => `<div class="dow${i === 0 ? " sun" : i === 6 ? " sat" : ""}">${w}</div>`).join("") + `</div>`;
  h += `<div class="mgrid" style="grid-template-rows:repeat(${weeks},minmax(0,1fr))">`;
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i), k = isoOf(d);
    const out = d.getMonth() !== cur.getMonth() ? " out" : "";
    h += `<button class="${dayClass(d, today, "day" + out)}" data-iso="${k}"><span class="dn">${d.getDate()}</span>${(map.get(k) || []).map(chip).join("")}</button>`;
  }
  root.className = "stage month-view";
  root.innerHTML = h + `</div>`;
  root.querySelectorAll(".day").forEach(fit);
}

export function renderWeek(root, cur, map) {
  const { start } = weekRange(cur), today = isoOf(new Date());
  let h = "";
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i), k = isoOf(d);
    h += `<div class="${dayClass(d, today, "wrow")}" data-iso="${k}"><div class="wd"><b>${WD[i]}</b><span>${d.getDate()}</span></div>` +
      `<div class="wev">${(map.get(k) || []).map(chip).join("")}</div></div>`;
  }
  root.className = "stage week-view";
  root.innerHTML = h;
  root.querySelectorAll(".wev").forEach(fit);
}

// 칸에 다 안 들어가는 일정은 빼고 "+n"으로 표시
function fit(box) {
  if (box.scrollHeight > box.clientHeight + 1) {
    const chips = [...box.querySelectorAll(".chip")];
    const more = document.createElement("span");
    more.className = "more";
    box.appendChild(more);
    let n = 0;
    while (chips.length && box.scrollHeight > box.clientHeight + 1) {
      chips.pop().remove();
      more.textContent = `+${++n}`;
    }
  }
  box.classList.add("fit");
}

const ampm = d => `${d.getHours() < 12 ? "오전" : "오후"} ${d.getHours() % 12 || 12}:${p2(d.getMinutes())}`;
const md = d => `${d.getMonth() + 1}/${d.getDate()}`;
function when(e) {
  if (e.allDay) {
    const last = dayOf(new Date(e.end - 1));
    return isoOf(last) === isoOf(e.start) ? "하루 종일" : `${md(e.start)} – ${md(last)} 하루 종일`;
  }
  if (isoOf(e.start) === isoOf(e.end) || e.end - e.start < DAY) return `${ampm(e.start)} – ${ampm(e.end)}`;
  return `${md(e.start)} ${ampm(e.start)} – ${md(e.end)} ${ampm(e.end)}`;
}

export function openDay(iso, evs) {
  const [y, m, d] = iso.split("-").map(Number);
  let h = `<h3>${m}월 ${d}일 (${WD[new Date(y, m - 1, d).getDay()]}) <button id="closeSheet">닫기</button></h3>`;
  if (!evs.length) h += `<p class="ev-none">이날은 일정이 없어요.</p>`;
  for (const e of evs) {
    h += `<div class="ev"><div class="bar" style="background:${e.color}"></div><div>` +
      `<div class="t">${when(e)}</div><div class="n">${esc(e.title)}</div>` +
      (e.calendar ? `<div class="d">${esc(e.calendar)}</div>` : "") +
      (e.location ? `<div class="d">장소 · ${esc(e.location)}</div>` : "") +
      (e.notes ? `<div class="d notes">${esc(e.notes)}</div>` : "") +
      `</div></div>`;
  }
  document.getElementById("sheetIn").innerHTML = h;
  const sh = document.getElementById("sheet");
  sh.hidden = false;
  document.getElementById("closeSheet").onclick = () => (sh.hidden = true);
}
