// 대한민국 공휴일 (대체공휴일은 자동 계산)
// 음력 공휴일은 해마다 날짜가 달라서 아래 표에 직접 적어 둡니다. 새 연도는 여기에 추가하세요.
window.KoreanHolidays = (() => {
  // 연도: [설날, 부처님오신날, 추석] (양력 MM-DD)
  const LUNAR = {
    2024: ["02-10", "05-15", "09-17"],
    2025: ["01-29", "05-05", "10-06"],
    2026: ["02-17", "05-24", "09-25"],
    2027: ["02-07", "05-13", "09-15"],
    2028: ["01-27", "05-02", "10-03"],
    2029: ["02-13", "05-20", "09-22"],
    2030: ["02-03", "05-09", "09-12"],
    2031: ["01-23", "05-28", "10-01"],
  };

  // 선거일·임시공휴일 등 그때그때 지정되는 날
  const EXTRA = {
    "2024-04-10": "국회의원선거",
    "2024-10-01": "임시공휴일",
    "2025-01-27": "임시공휴일",
    "2025-06-03": "대통령선거",
    "2026-06-03": "지방선거",
    "2028-04-12": "국회의원선거",
  };

  // [월-일, 이름, 대체공휴일 적용 여부]
  const FIXED = [
    ["01-01", "신정", false],
    ["03-01", "삼일절", true],
    ["05-05", "어린이날", true],
    ["06-06", "현충일", false],
    ["08-15", "광복절", true],
    ["10-03", "개천절", true],
    ["10-09", "한글날", true],
    ["12-25", "성탄절", true],
  ];

  const pad = (n) => String(n).padStart(2, "0");
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const make = (y, md, offset = 0) => {
    const [m, d] = md.split("-").map(Number);
    return new Date(y, m - 1, d + offset);
  };

  const cache = {};

  function build(y) {
    const map = {}; // key -> [이름...]
    const add = (k, name) => (map[k] = map[k] || []).push(name);
    const rules = []; // 대체공휴일 판단용

    FIXED.forEach(([md, name, sub]) => {
      const d = make(y, md);
      add(key(d), name);
      if (sub) rules.push({ dates: [d], weekendTrigger: [0, 6], name });
    });

    const lunar = LUNAR[y];
    if (lunar) {
      const [seol, buddha, chuseok] = lunar;
      [["설날", seol], ["추석", chuseok]].forEach(([name, md]) => {
        const days = [-1, 0, 1].map((o) => make(y, md, o));
        days.forEach((d, i) => add(key(d), i === 1 ? name : `${name} 연휴`));
        // 설·추석 연휴는 일요일 또는 다른 공휴일과 겹칠 때만 대체
        rules.push({ dates: days, weekendTrigger: [0], name });
      });
      const b = make(y, buddha);
      add(key(b), "부처님오신날");
      rules.push({ dates: [b], weekendTrigger: [0, 6], name: "부처님오신날" });
    }

    Object.entries(EXTRA).forEach(([k, name]) => { if (k.startsWith(`${y}-`)) add(k, name); });

    // 대체공휴일: 겹친 날은 한 번만 대체되도록 날짜별로 필요한 개수를 셈
    const needed = {}; // key -> {count, after}
    rules.forEach(({ dates, weekendTrigger }) => {
      const after = dates[dates.length - 1];
      dates.forEach((d) => {
        const k = key(d);
        const onWeekend = weekendTrigger.includes(d.getDay());
        const overlap = map[k].length > 1;
        if (!onWeekend && !overlap) return;
        const slot = needed[k] || (needed[k] = { count: 0, max: onWeekend ? map[k].length : map[k].length - 1, after });
        if (slot.count < slot.max) slot.count++;
        if (after > slot.after) slot.after = after;
      });
    });

    Object.values(needed).forEach(({ count, after }) => {
      let d = after;
      for (let i = 0; i < count; i++) {
        do { d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
        while (d.getDay() === 0 || d.getDay() === 6 || map[key(d)]);
        add(key(d), "대체공휴일");
      }
    });

    return map;
  }

  return {
    // 공휴일이면 이름, 아니면 빈 문자열
    get(dateKey) {
      const y = Number(dateKey.slice(0, 4));
      const map = cache[y] || (cache[y] = build(y));
      return (map[dateKey] || []).join(" · ");
    },
  };
})();
