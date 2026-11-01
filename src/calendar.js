// 일정 불러오기: 앱(iOS·안드로이드)에서는 기기 캘린더, 브라우저 테스트에서는 아티팩트 일정
import { Capacitor } from "@capacitor/core";
import { CapacitorCalendar, CalendarPermissionScope } from "@ebarooni/capacitor-calendar";
import { demoEvents } from "./demo-data.js";

export const native = Capacitor.isNativePlatform();
const DAY = 864e5;
const FALLBACK = "#4a5fc1";

// "granted" | "denied" | "prompt"
const norm = s => (s === "granted" ? "granted" : s === "denied" ? "denied" : "prompt");

export async function getAccess() {
  if (!native) return "granted";
  const { result } = await CapacitorCalendar.checkPermission({ scope: CalendarPermissionScope.READ_CALENDAR });
  return norm(result);
}

// 안드로이드는 읽기 권한만, iOS는 읽으려면 전체 접근이 필요함
export async function requestAccess() {
  if (!native) return "granted";
  const { result } = Capacitor.getPlatform() === "android"
    ? await CapacitorCalendar.requestReadOnlyCalendarAccess()
    : await CapacitorCalendar.requestFullCalendarAccess();
  return norm(result);
}

let demo = null;

// [start, end) 범위와 겹치는 일정
export async function fetchEvents(start, end) {
  if (!native) {
    demo = demo || demoEvents();
    return demo.filter(e => e.end > start && e.start < end);
  }
  const [{ result: cals }, { result: evs }] = await Promise.all([
    CapacitorCalendar.listCalendars(),
    CapacitorCalendar.listEventsInRange({ from: +start, to: +end }),
  ]);
  const byId = new Map(cals.map(c => [c.id, c]));
  return evs
    .filter(e => byId.get(e.calendarId)?.visible !== false) // 안드로이드에서 숨긴 캘린더는 빼기
    .map(e => toEvent(e, byId.get(e.calendarId)));
}

function toEvent(e, cal) {
  let start, end;
  if (e.isAllDay) {
    start = allDayStart(e.startDate);
    end = new Date(+allDayLast(e.endDate || e.startDate) + DAY);
    if (end <= start) end = new Date(+start + DAY);
  } else {
    start = new Date(e.startDate);
    end = new Date(Math.max(e.endDate || 0, e.startDate));
  }
  return {
    id: e.id,
    title: e.title || "(제목 없음)",
    start, end,
    allDay: !!e.isAllDay,
    color: hex(e.color) || hex(cal?.color) || FALLBACK,
    calendar: cal?.title || "",
    location: e.location || "",
    notes: e.description || "",
  };
}

// 하루 종일 일정: 안드로이드는 UTC 자정으로, iOS는 현지 자정으로 저장함
const ymd = (y, m, d) => new Date(y, m, d);
function allDayStart(ms) {
  const d = new Date(ms);
  return ms % DAY === 0 ? ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) : ymd(d.getFullYear(), d.getMonth(), d.getDate());
}
// 끝 시각은 '다음 날 자정'(안드로이드) 또는 '마지막 날 23:59'(iOS) → 마지막 날짜로 맞춤
function allDayLast(ms) {
  if (ms % DAY === 0) { const d = new Date(ms - DAY); return ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
  const d = new Date(ms - 1);
  return ymd(d.getFullYear(), d.getMonth(), d.getDate());
}

function hex(c) {
  return typeof c === "string" && /^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7) : null;
}
