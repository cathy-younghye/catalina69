(() => {
  const STORAGE_KEY = "amway-10core-notes-v1";
  const CORES = [
    "운동", "책 읽기", "음원듣기", "미팅 참석", "제품 애용",
    "소비자관리", "사업설명", "상담", "신뢰 쌓기", "E-Com",
  ];
  // 각 항목 입력칸에 흐리게 보이는 안내 문구 (CORES 순서와 같음)
  const HINTS = [
    "매일 30분 이상 운동 — 사업을 지속할 수 있는 건강 관리",
    "매일 30분씩",
    "매일 1개 이상",
    "오픈 미팅(OM), 세미나, 랠리 등 공식 행사에 빠짐없이 참석",
    "100% 제품 애용 — 암웨이 전 제품을 직접 써보고 애용하기",
    "꾸준히 제품을 사용하는 고정 소비자 30명 만들기",
    "STP(Show The Plan) 주 3회 이상",
    "업라인 스폰서와 매일 상담",
    "약속 준수, 금전 거래 주의, 높은 도덕성 유지",
    "온라인 시스템 및 단체 커뮤니케이션 적극 활용",
  ];
  const WEEKDAYS =["일", "월", "화", "수", "목", "금", "토"];

  const $ = (id) => document.getElementById(id);

  // ---------- 날짜 유틸 (로컬 시간 기준) ----------
  const pad = (n) => String(n).padStart(2, "0");
  const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  // 사업연도: 9월 1일 ~ 다음해 8월 31일
  const businessYearOf = (d) => (d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1);
  const yearStart = (y) => new Date(y, 8, 1);
  const yearEnd = (y) => new Date(y + 1, 7, 31);
  // 일요일·공휴일은 빨간색, 토요일은 파란색
  const dayColor = (d) =>
    d.getDay() === 0 || KoreanHolidays.get(toKey(d)) ? "red" : d.getDay() === 6 ? "blue" : "";

  // ---------- 저장소 ----------
  let notes = {};
  try { notes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { notes = {}; }

  const emptyNote = () => ({ items: CORES.map(() => ({ done: false, text: "" })), thanks: "", schedule: "", events: [] });
  const getNote = (key) => notes[key] || emptyNote();
  const ensureNote = (key) => {
    const note = notes[key] || (notes[key] = emptyNote());
    if (!note.events) note.events = []; // 일정 기능 이전에 저장된 노트
    return note;
  };
  const eventsOf = (n) => (n && n.events ? n.events.filter((ev) => ev.time || ev.text) : []);
  const hasCore = (n) => !!n && (n.thanks || n.schedule || n.items.some((i) => i.done || i.text));
  const isEmpty = (n) => !hasCore(n) && eventsOf(n).length === 0;
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const byTime = (a, b) => (a.time || "99:99").localeCompare(b.time || "99:99");
  const doneCount = (n) => n.items.filter((i) => i.done).length;

  let saveTimer;
  function persist() {
    try {
      // 빈 노트는 저장하지 않음 (화면에서 편집 중인 빈 칸은 메모리에만 유지)
      const clean = Object.fromEntries(Object.entries(notes).filter(([, n]) => !isEmpty(n)));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      $("saveStatus").textContent = "자동 저장됨 · " + new Date().toLocaleTimeString("ko-KR");
    } catch {
      $("saveStatus").textContent = "저장 실패 — 백업 저장을 눌러 파일로 보관하세요";
    }
  }
  function scheduleSave() {
    $("saveStatus").textContent = "저장 중…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  }

  // ---------- 상태 ----------
  const today = new Date();
  let current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let viewYear = businessYearOf(current);
  let viewMonth = current.getMonth(); // 달력에 보이는 달

  // 내용 양에 맞춰 입력칸 높이 자동 조절
  function autosize(t) {
    t.style.height = "auto";
    t.style.height = t.scrollHeight + 2 + "px";
  }

  // ---------- 10코아 표 생성 ----------
  const table = $("coreTable");
  CORES.forEach((name, i) => {
    const row = document.createElement("div");
    row.className = "core-row";
    row.innerHTML = `
      <div class="num">${i + 1}</div>
      <label class="name"><input type="checkbox" data-i="${i}"> ${name}</label>
      <textarea data-i="${i}" rows="2" placeholder="${HINTS[i]}"></textarea>`;
    table.appendChild(row);
  });

  table.addEventListener("input", (e) => {
    const i = Number(e.target.dataset.i);
    if (Number.isNaN(i)) return;
    const key = toKey(current);
    const note = ensureNote(key);
    if (e.target.type === "checkbox") note.items[i].done = e.target.checked;
    else { note.items[i].text = e.target.value; autosize(e.target); }
    afterEdit(key);
  });

  ["thanks", "schedule"].forEach((field) => {
    $(field).addEventListener("input", (e) => {
      const key = toKey(current);
      const note = ensureNote(key);
      note[field] = e.target.value;
      autosize(e.target);
      afterEdit(key);
    });
  });

  // ---------- 날짜별 일정 ----------
  const eventList = $("eventList");

  // 시간 선택: 15분 단위 (00:00 ~ 23:45)
  const TIME_SLOTS = [];
  for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 15) TIME_SLOTS.push(`${pad(h)}:${pad(m)}`);
  const timeLabel = (t) => {
    const [h, m] = t.split(":").map(Number);
    return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${pad(m)}`;
  };
  const timeOptions = (selected = "") => {
    const slots = selected && !TIME_SLOTS.includes(selected) ? [...TIME_SLOTS, selected].sort() : TIME_SLOTS;
    return `<option value="">시간 없음</option>` +
      slots.map((t) => `<option value="${t}"${t === selected ? " selected" : ""}>${timeLabel(t)}</option>`).join("");
  };
  $("evTime").innerHTML = timeOptions();

  function renderEvents() {
    const note = notes[toKey(current)];
    const events = note && note.events ? note.events : [];
    events.sort(byTime);
    eventList.innerHTML = events.length
      ? events.map((ev, i) => `
        <div class="event-row">
          <select data-ei="${i}" data-f="time" aria-label="시간">${timeOptions(ev.time)}</select>
          <input type="text" data-ei="${i}" data-f="text" value="${esc(ev.text)}" placeholder="일정 내용 (예: 김OO님 상담, 세미나)">
          <button type="button" class="ghost" data-del="${i}" aria-label="일정 삭제">✕</button>
        </div>`).join("")
      : '<p class="empty">등록된 일정이 없습니다.</p>';
  }

  // 일정 추가: 입력 후 [확인]을 눌러야 추가됨
  const eventForm = $("eventForm");

  function closeEventForm() {
    eventForm.reset();
    eventForm.hidden = true;
    $("addEvent").hidden = false;
  }

  $("addEvent").addEventListener("click", () => {
    eventForm.hidden = false;
    $("addEvent").hidden = true;
    $("evText").focus();
  });

  $("evCancel").addEventListener("click", closeEventForm);

  eventForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("evText").value.trim();
    if (!text) { $("evText").focus(); return; }
    const key = toKey(current);
    ensureNote(key).events.push({ time: $("evTime").value, text });
    closeEventForm();
    renderEvents();
    afterEdit(key);
  });

  eventList.addEventListener("input", (e) => {
    const i = e.target.dataset.ei;
    if (i === undefined) return;
    const key = toKey(current);
    ensureNote(key).events[i][e.target.dataset.f] = e.target.value;
    afterEdit(key);
  });

  // 시간을 바꾸면 시간순으로 다시 정렬
  eventList.addEventListener("change", (e) => {
    if (e.target.dataset.f === "time") renderEvents();
  });

  eventList.addEventListener("click", (e) => {
    const i = e.target.dataset.del;
    if (i === undefined) return;
    const key = toKey(current);
    ensureNote(key).events.splice(Number(i), 1);
    renderEvents();
    afterEdit(key);
  });

  function afterEdit(key) {
    updateProgress();
    renderCalendar();
    scheduleSave();
  }

  // ---------- 렌더링 ----------
  function renderNote() {
    const key = toKey(current);
    const note = getNote(key);
    const holiday = KoreanHolidays.get(key);
    const title = $("dateTitle");
    title.className = "date-title " + dayColor(current);
    title.textContent =
      `${current.getFullYear()}년 ${current.getMonth() + 1}월 ${current.getDate()}일 (${WEEKDAYS[current.getDay()]})` +
      (holiday ? ` · ${holiday}` : "");
    const picker = $("datePicker");
    picker.min = toKey(yearStart(viewYear));
    picker.max = toKey(yearEnd(viewYear));
    picker.value = key;

    table.querySelectorAll(".core-row").forEach((row, i) => {
      row.querySelector("input").checked = note.items[i].done;
      row.querySelector("textarea").value = note.items[i].text;
    });
    closeEventForm();
    renderEvents();
    $("thanks").value = note.thanks;
    $("schedule").value = note.schedule;
    document.querySelectorAll("textarea").forEach(autosize);

    $("prevDay").disabled = toKey(current) === toKey(yearStart(viewYear));
    $("nextDay").disabled = toKey(current) === toKey(yearEnd(viewYear));
    updateProgress();
  }

  function updateProgress() {
    const note = getNote(toKey(current));
    const n = doneCount(note);
    $("progressFill").style.width = n * 10 + "%";
    $("progressText").textContent = `${n} / 10`;
    table.querySelectorAll(".core-row").forEach((row, i) => row.classList.toggle("done", note.items[i].done));
  }

  function renderYearSelect() {
    const years = new Set();
    const base = businessYearOf(today);
    for (let y = base - 2; y <= base + 3; y++) years.add(y);
    Object.keys(notes).forEach((k) => years.add(businessYearOf(fromKey(k))));
    years.add(viewYear);
    const sel = $("yearSelect");
    sel.innerHTML = [...years].sort((a, b) => a - b)
      .map((y) => `<option value="${y}">${y}.09 ~ ${y + 1}.08</option>`).join("");
    sel.value = viewYear;
  }

  function renderMonths() {
    const order = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7];
    $("months").innerHTML = order
      .map((m) => `<button type="button" data-m="${m}" class="${m === viewMonth ? "active" : ""}">${m + 1}월</button>`)
      .join("");
  }

  function renderCalendar() {
    const y = viewMonth >= 8 ? viewYear : viewYear + 1;
    const first = new Date(y, viewMonth, 1);
    const last = new Date(y, viewMonth + 1, 0).getDate();
    const todayKey = toKey(today);
    const curKey = toKey(current);
    let html = "<span></span>".repeat(first.getDay());
    const monthEvents = [];
    for (let d = 1; d <= last; d++) {
      const date = new Date(y, viewMonth, d);
      const key = toKey(date);
      const note = notes[key];
      const holiday = KoreanHolidays.get(key);
      const events = eventsOf(note).sort(byTime);
      const cls = [dayColor(date)];
      let sub = "";
      if (events.length) cls.push("has-event");
      if (hasCore(note)) {
        const n = doneCount(note);
        cls.push(n === 10 ? "full" : "has-note");
        sub = `<small>${n}/10</small>`;
      }
      if (key === todayKey) cls.push("today");
      if (key === curKey) cls.push("selected");
      const tipLines = [holiday, ...events.map((ev) => [ev.time, ev.text].filter(Boolean).join(" "))].filter(Boolean);
      const tip = tipLines.length ? ` title="${esc(tipLines.join("\n"))}"` : "";
      monthEvents.push(...events.map((ev) => ({ key, d, ev })));
      html += `<button type="button" data-key="${key}" class="${cls.join(" ")}"${tip}>${d}${sub}</button>`;
    }
    $("days").innerHTML = html;

    $("monthEventsTitle").textContent = `${viewMonth + 1}월 일정`;
    $("monthEvents").innerHTML = monthEvents.length
      ? monthEvents.map(({ key, d, ev }) => `
        <li><button type="button" data-key="${key}">
          <span class="me-date ${dayColor(fromKey(key))}">${d}일 (${WEEKDAYS[fromKey(key).getDay()]})</span>
          <span class="me-time">${esc(ev.time)}</span>
          <span class="me-text">${esc(ev.text)}</span>
        </button></li>`).join("")
      : '<li class="empty">이 달에 등록된 일정이 없습니다.</li>';
  }

  function go(date) {
    current = date;
    viewYear = businessYearOf(date);
    viewMonth = date.getMonth();
    renderYearSelect();
    renderMonths();
    renderCalendar();
    renderNote();
  }

  // ---------- 이벤트 ----------
  $("prevDay").addEventListener("click", () => go(addDays(current, -1)));
  $("nextDay").addEventListener("click", () => go(addDays(current, 1)));
  $("todayBtn").addEventListener("click", () => go(new Date(today.getFullYear(), today.getMonth(), today.getDate())));
  $("datePicker").addEventListener("change", (e) => { if (e.target.value) go(fromKey(e.target.value)); });

  $("yearSelect").addEventListener("change", (e) => {
    const y = Number(e.target.value);
    const sameDay = new Date(current.getMonth() >= 8 ? y : y + 1, current.getMonth(), current.getDate());
    const valid = sameDay.getMonth() === current.getMonth(); // 2월 29일 등 보정
    go(valid ? sameDay : yearStart(y));
  });

  $("months").addEventListener("click", (e) => {
    const m = e.target.dataset.m;
    if (m === undefined) return;
    viewMonth = Number(m);
    renderMonths();
    renderCalendar();
  });

  $("days").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-key]");
    if (btn) go(fromKey(btn.dataset.key));
  });

  $("monthEvents").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-key]");
    if (btn) go(fromKey(btn.dataset.key));
  });

  $("printBtn").addEventListener("click", () => window.print());

  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `10코아노트_백업_${toKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (typeof data !== "object" || Array.isArray(data)) throw new Error();
      if (!confirm("백업 파일의 내용을 현재 노트에 합칠까요? (같은 날짜는 백업 내용으로 바뀝니다)")) return;
      Object.assign(notes, data);
      persist();
      go(current);
      alert("백업을 불러왔습니다.");
    } catch {
      alert("올바른 백업 파일이 아닙니다.");
    } finally {
      e.target.value = "";
    }
  });

  window.addEventListener("beforeunload", () => { clearTimeout(saveTimer); persist(); });
  window.addEventListener("resize", () => document.querySelectorAll("textarea").forEach(autosize));

  go(current);
})();
