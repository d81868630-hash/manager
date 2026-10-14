const $ = id => document.getElementById(id);

const sample = `카카오 대리
대자동
연제구 거제동
160,000원
출발지까지 7.3km
약 274분`;

function normalize(s){
  return (s||"").replace(/\u00a0/g," ").replace(/[ ]{2,}/g," ").trim();
}
function won(v){ return v ? Number(v.replace(/,/g,"")) : 0; }
function parse(text){
  const t=normalize(text);
  const moneyMatches=[...t.matchAll(/(?:₩|\b)(\d{1,3}(?:,\d{3})+|\d{4,6})\s*(?:원|$)/g)];
  let amount=moneyMatches.length?Math.max(...moneyMatches.map(m=>won(m[1]))):0;
  if(!amount){
    const alt=[...t.matchAll(/(\d{1,3}(?:,\d{3})+|\d{4,6})\s*원/g)];
    if(alt.length) amount=won(alt[alt.length-1][1]);
  }
  const timeM=t.match(/(?:약\s*)?(\d{1,3})\s*(?:분|min)/i);
  const kmMatches=[...t.matchAll(/(\d+(?:\.\d+)?)\s*km/gi)].map(m=>parseFloat(m[1]));
  const originDist=kmMatches.length?kmMatches[0]:0;
  const routeKm=kmMatches.length>1?kmMatches[1]:0;

  const lines=t.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const banned=/^\d|원$|km$|분$|대리|콜|실수익|예상|출발지까지|운행/;
  const places=lines.filter(x=>x.length>=2 && x.length<=40 && !banned.test(x));
  let origin=places[0]||"출발지 미인식";
  let destination=places[1]||"도착지 미인식";
  const arrow=t.match(/([^\n→-]{2,30})\s*(?:→|->)\s*([^\n]{2,30})/);
  if(arrow){origin=arrow[1].trim();destination=arrow[2].trim();}

  return {amount,time:timeM?parseInt(timeM[1]):0,originDist,routeKm,origin,destination,raw:t};
}
function score(c){
  let s=50;
  if(c.amount>=60000)s+=20; else if(c.amount>=40000)s+=14; else if(c.amount>=30000)s+=8; else if(c.amount<20000)s-=12;
  if(c.time){ const hourly=c.amount/(c.time/60); if(hourly>=45000)s+=20; else if(hourly>=35000)s+=14; else if(hourly>=28000)s+=7; else if(hourly<18000)s-=15; }
  if(c.originDist){ if(c.originDist<=1)s+=8; else if(c.originDist<=3)s+=4; else if(c.originDist>=7)s-=8; }
  if(c.routeKm>=80)s-=4;
  return Math.max(0,Math.min(100,Math.round(s)));
}
function resultHTML(c){
  const s=score(c), hourly=c.time?Math.round(c.amount/(c.time/60)):0;
  const verdict=s>=80?"🟢 추천":s>=65?"🟡 검토":"🔴 비추천";
  const cls=s>=80?"good":"warn";
  return `<h2>분석 결과</h2>
    <div class="score">${s}<span style="font-size:18px"> / 100</span></div>
    <div class="badge">${verdict}</div>
    <div class="route">${c.origin} → ${c.destination}</div>
    <div class="grid">
      <div class="metric"><small>콜 금액</small><strong>${c.amount?c.amount.toLocaleString()+"원":"미인식"}</strong></div>
      <div class="metric"><small>예상 시급</small><strong>${hourly?hourly.toLocaleString()+"원":"미인식"}</strong></div>
      <div class="metric"><small>출발지 이동</small><strong>${c.originDist?c.originDist+"km":"미인식"}</strong></div>
      <div class="metric"><small>운행시간</small><strong>${c.time?c.time+"분":"미인식"}</strong></div>
    </div>
    <div class="${cls}">${s>=80?"현재 입력값 기준으로 잡아볼 만한 콜입니다.":"시간 대비 금액 또는 이동조건을 다시 확인하는 것을 권장합니다."}</div>`;
}
function analyze(text){
  $("textInput").value=text;
  const c=parse(text);
  $("result").innerHTML=resultHTML(c);
  $("result").classList.remove("hidden");
  history.replaceState(null,"",location.pathname+"?text="+encodeURIComponent(text));
}
$("analyzeBtn").onclick=()=>analyze($("textInput").value);
$("demoBtn").onclick=()=>analyze(sample);
$("clearBtn").onclick=()=>{ $("textInput").value=""; $("result").classList.add("hidden"); history.replaceState(null,"",location.pathname); };

const q=new URLSearchParams(location.search).get("text");
if(q) analyze(q);
