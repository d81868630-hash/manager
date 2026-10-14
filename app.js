const $ = id => document.getElementById(id);
const sample = `카카오 대리
대자동
연제구 거제동
160,000원
출발지까지 7.3km
약 274분`;
function normalize(s) {
  return (s || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}
function parse(text) {
  const t = normalize(text);
  const money = [...t.matchAll(/(\d{1,3}(?:,\d{3})+|\d{4,6})\s*원/g)];
  const amount = money.length
    ? Math.max(...money.map(m => Number(m[1].replace(/,/g, ""))))
    : 0;
  const timeM = t.match(/(?:약\s*)?(\d{1,3})\s*(?:분|min)/i);
  const km = [...t.matchAll(/(\d+(?:\.\d+)?)\s*km/gi)]
    .map(m => parseFloat(m[1]));
  const lines = t.split(/\n+/).map(x => x.trim()).filter(Boolean);
  const banned = /^\d|원$|km$|분$|대리|콜|실수익|예상|출발지까지|운행/;
  const places = lines.filter(x =>
    x.length >= 2 && x.length <= 40 && !banned.test(x)
  );
  let origin = places[0] || "출발지 미인식";
  let destination = places[1] || "도착지 미인식";
  const arrow = t.match(/([^\n→-]{2,30})\s*(?:→|->)\s*([^\n]{2,30})/);
  if (arrow) {
    origin = arrow[1].trim();
    destination = arrow[2].trim();
  }
  return {
    amount,
    time: timeM ? parseInt(timeM[1]) : 0,
    originDist: km[0] || 0,
    origin,
    destination
  };
}
function score(c) {
  let s = 50;
  if (c.amount >= 60000) s += 20;
  else if (c.amount >= 40000) s += 14;
  else if (c.amount >= 30000) s += 8;
  else if (c.amount < 20000) s -= 12;
  if (c.time) {
    const hourly = c.amount / (c.time / 60);
    if (hourly >= 45000) s += 20;
    else if (hourly >= 35000) s += 14;
    else if (hourly >= 28000) s += 7;
    else if (hourly < 18000) s -= 15;
  }
  if (c.originDist) {
    if (c.originDist <= 1) s += 8;
    else if (c.originDist <= 3) s += 4;
    else if (c.originDist >= 7) s -= 8;
  }
  return Math.max(0, Math.min(100, Math.round(s)));
}
function analyze(text) {
  $("textInput").value = text;
  const c = parse(text);
  const s = score(c);
  const hourly = c.time
    ? Math.round(c.amount / (c.time / 60))
    : 0;
  const verdict = s >= 80 ? "🟢 추천" : s >= 65 ? "🟡 검토" : "🔴 비추천";
  $("result").innerHTML = `
    <h2>분석 결과</h2>
    <div class="score">${s}<span style="font-size:18px"> / 100</span></div>
    <div class="badge">${verdict}</div>
    <div class="route">${c.origin} → ${c.destination}</div>
    <div class="grid">
      <div class="metric"><small>콜 금액</small><strong>${c.amount ? c.amount.toLocaleString()+"원" : "미인식"}</strong></div>
      <div class="metric"><small>예상 시급</small><strong>${hourly ? hourly.toLocaleString()+"원" : "미인식"}</strong></div>
      <div class="metric"><small>출발지 이동</small><strong>${c.originDist ? c.originDist+"km" : "미인식"}</strong></div>
      <div class="metric"><small>운행시간</small><strong>${c.time ? c.time+"분" : "미인식"}</strong></div>
    </div>
    <div class="${s >= 80 ? "good" : "warn"}">
      ${s >= 80 ? "현재 입력값 기준으로 잡아볼 만한 콜입니다." : "시간 대비 금액과 이동조건을 다시 확인하세요."}
    </div>
  `;
  $("result").classList.remove("hidden");
}
$("analyzeBtn").onclick = () => analyze($("textInput").value);
$("demoBtn").onclick = () => analyze(sample);
$("clearBtn").onclick = () => {
  $("textInput").value = "";
  $("result").classList.add("hidden");
};
const imageInput = $("imageInput");
const preview = $("imagePreview");
const ocrBtn = $("ocrBtn");
const status = $("ocrStatus");
imageInput.onchange = () => {
  const file = imageInput.files[0];
  if (!file) return;
  preview.src = URL.createObjectURL(file);
  preview.classList.remove("hidden");
  ocrBtn.disabled = false;
  status.textContent = "이미지를 선택했어요. 글자 인식을 눌러주세요.";
};
ocrBtn.onclick = async () => {
  const file = imageInput.files[0];
  if (!file) return;
  if (!window.Tesseract) {
    status.textContent = "OCR 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.";
    return;
  }
  ocrBtn.disabled = true;
  status.textContent = "이미지 글자를 인식하고 있어요. 잠시 기다려 주세요.";
  try {
    const result = await Tesseract.recognize(file, "kor+eng", {
      logger: info => {
        if (info.status === "recognizing text") {
          status.textContent = `글자 인식 중 ${Math.round(info.progress * 100)}%`;
        }
      }
    });
    $("textInput").value = result.data.text.trim();
    status.textContent = "인식 완료! 글자를 확인한 뒤 콜 분석을 눌러주세요.";
  } catch (e) {
    status.textContent = "인식에 실패했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.";
  } finally {
    ocrBtn.disabled = false;
  }
};
