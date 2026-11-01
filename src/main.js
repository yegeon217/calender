import "./style.css";
import { native, getAccess, requestAccess, fetchEvents } from "./calendar.js";
import { monthRange, weekRange, titleFor, byDay, renderMonth, renderWeek, openDay } from "./views.js";
import { startSmash, stopSmash } from "./smash.js";

const $ = id => document.getElementById(id);
const stage = $("stage");
const read = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

const st = { view: read("smash-view", "month"), cur: new Date(), events: [], sig: "", map: new Map(), first: true, size: "" };
const range = () => (st.view === "month" ? monthRange(st.cur) : weekRange(st.cur));
const sig = evs => evs.map(e => `${e.id}|${+e.start}|${+e.end}|${e.title}|${e.color}`).join("\n");
const nextFrame = () => new Promise(r => requestAnimationFrame(r));

// 달력을 새로 그리고 부수기 상태로 시작 (되돌리기·이동할 때마다 처음 모습으로)
let gen = 0;
async function show(refetch = true) {
  const my = ++gen;
  const r = range();
  if (refetch) {
    let evs = [];
    try { evs = await fetchEvents(r.start, r.end); } catch (err) { console.error(err); }
    if (my !== gen) return;
    st.events = evs;
    st.sig = sig(evs);
  }
  stopSmash();
  $("sheet").hidden = true;
  $("title").textContent = titleFor(st.view, st.cur);
  $("vMonth").setAttribute("aria-pressed", st.view === "month");
  $("vWeek").setAttribute("aria-pressed", st.view === "week");
  st.map = byDay(st.events, r.start, r.end);
  (st.view === "month" ? renderMonth : renderWeek)(stage, st.cur, st.map);
  await nextFrame();
  if (my !== gen) return;
  startSmash({
    stage,
    selector: st.view === "month" ? ".dow,.day" : ".wrow",
    top: $("chrome").getBoundingClientRect().bottom,
    onTap: el => { const k = el.dataset.iso; if (k) openDay(k, st.map.get(k) || []); },
    onReset: () => show(false),
    hint: st.first,
  });
  st.first = false;
  st.size = `${innerWidth}x${innerHeight}`;
}

function go(n) {
  const c = st.cur;
  st.cur = st.view === "month" ? new Date(c.getFullYear(), c.getMonth() + n, 1) : new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7 * n);
  show();
}
function setView(v) {
  if (v === st.view) return;
  // 이번 달을 보다가 주 단위로 바꾸면 오늘이 있는 주로
  const t = new Date();
  if (v === "week" && st.cur.getFullYear() === t.getFullYear() && st.cur.getMonth() === t.getMonth()) st.cur = t;
  st.view = v;
  save("smash-view", v);
  show();
}
$("prev").onclick = () => go(-1);
$("next").onclick = () => go(1);
$("today").onclick = () => { st.cur = new Date(); show(); };
$("vMonth").onclick = () => setView("month");
$("vWeek").onclick = () => setView("week");

// ── 캘린더 권한 ──
function gate(kind) {
  const g = $("gate");
  g.hidden = !kind;
  if (kind === "ask") {
    $("gateT").textContent = "캘린더를 불러올게요";
    $("gateP").textContent = "휴대폰 캘린더에 있는 일정을 그대로 가져와 달력에 보여주려면 캘린더 접근 권한이 필요해요.";
    $("gateB").textContent = "권한 허용하기";
  } else if (kind === "denied") {
    $("gateT").textContent = "캘린더 접근이 꺼져 있어요";
    $("gateP").textContent = "설정 앱에서 ‘캘린더 부수기’의 캘린더 권한을 켜면 일정을 불러올 수 있어요.";
    $("gateB").textContent = "다시 시도";
  }
}
async function askAccess() {
  let s = "denied";
  try { s = await requestAccess(); } catch (err) { console.error(err); }
  if (s === "granted") { gate(null); show(); } else gate("denied");
}
$("gateB").onclick = askAccess;

async function boot() {
  if (!native) return show(); // 브라우저 테스트: 아티팩트 일정으로 바로 시작
  let s = "prompt";
  try { s = await getAccess(); } catch (err) { console.error(err); }
  if (s === "granted") return show();
  gate("ask");
  await askAccess(); // 처음 실행하면 바로 권한 요청
}

// 앱으로 돌아왔을 때: 설정에서 권한을 켰으면 불러오고, 다른 앱에서 일정이 바뀌었으면 다시 그림
const crushOn = () => document.documentElement.classList.contains("crush-on");   // 짓누르기 장면 중에는 다시 그리지 않음
document.addEventListener("visibilitychange", async () => {
  if (document.hidden || !native || crushOn()) return;
  if (!$("gate").hidden) {
    if ((await getAccess().catch(() => "denied")) === "granted") { gate(null); show(); }
    return;
  }
  const r = range();
  const evs = await fetchEvents(r.start, r.end).catch(() => null);
  if (evs && sig(evs) !== st.sig) { st.events = evs; st.sig = sig(evs); show(false); }
});

// 화면 크기가 바뀌면(회전 등) 달력을 다시 배치
let rz = 0;
addEventListener("resize", () => {
  clearTimeout(rz);
  rz = setTimeout(() => { if (st.size && `${innerWidth}x${innerHeight}` !== st.size && $("gate").hidden && !crushOn()) show(false); }, 250);
});

boot();
