const $ = s => document.querySelector(s);
const historyKey = "daeri-history-v1";
let current = null;

function won(n){ return n == null ? "-" : Math.round(n).toLocaleString("ko-KR") + "원"; }
function km(n){ return n == null ? "-" : Number(n).toFixed(1) + " km"; }

function parseCall(text){
  const t = text.replace(/,/g,"");
  const source = /오픈콜|현금.*실수익|실수익.*P/.test(text) ? "T맵 대리" :
                 /콜 수요 지도|실제.*수익|확정.*160000/.test(text) ? "카카오 대리" : "분석";
  const amounts = [...t.matchAll(/(?<!\d)(\d{4,6})(?=\s*(?:P|원|₩))/g)].map(m=>Number(m[1]));
  const amount = amounts.length ? Math.max(...amounts) : ((t.match(/실수익\s*(\d{4,6})/)||[])[1]*1 || null);
  const dur = Number((t.match(/약\s*(\d{2,4})\s*분(?:\s*운행)?/)||[])[1]) || null;
  const pickupKm = Number((t.match(/(?:출발|도보)[^\d]{0,25}(\d+(?:\.\d+)?)\s*km/)||[])[1]) || null;
  const tripKm = Number((t.match(/이동\s*(?:약\s*)?(\d+(?:\.\d+)?)\s*km/)||[])[1]) || null;
  const lines = text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const idxP = lines.findIndex(x=>x.startsWith("출발"));
  const idxD = lines.findIndex(x=>x.startsWith("도착"));
  let pickup = idxP>=0 ? lines[idxP].replace(/^출발\s*/,"") : null;
  let destination = idxD>=0 ? lines[idxD].replace(/^도착\s*/,"") : null;
  if(!pickup && /대자동/.test(text)) pickup="고양시 덕양구 대자동";
  if(!destination && /거제동/.test(text)) destination="연제구 거제동";
  return {source,amount,pickup,destination,pickupKm,tripKm,duration,rawText:text};
}

function scoreCall(c){
  let score=50,reasons=[];
  if(c.amount==null) return {score:50,grade:"정보 부족",hourly:null,net:null,reasons:["콜 금액을 읽지 못했습니다."]};
  let hourly=null;
  if(c.duration>0){
    hourly=c.amount/c.duration*60;
    if(hourly>=35000){score+=20;reasons.push("예상 시급이 높습니다.");}
    else if(hourly>=28000){score+=12;reasons.push("예상 시급이 양호합니다.");}
    else if(hourly>=20000)score+=4;
    else{score-=18;reasons.push("운행시간 대비 금액이 낮습니다.");}
    if(c.duration>=240){score-=8;reasons.push("장시간 운행입니다.");}
    else if(c.duration<=90){score+=5;reasons.push("운행시간이 짧은 편입니다.");}
  }
  if(c.pickupKm!=null){
    if(c.pickupKm<=3){score+=8;reasons.push("출발지가 가깝습니다.");}
    else if(c.pickupKm<=7)score+=3;
    else{score-=8;reasons.push("출발지까지 이동거리가 깁니다.");}
  }
  if(c.amount>=80000 && c.duration>=180){score+=8;reasons.push("고액 장거리 콜입니다.");}
  let net=c.amount-(c.duration>=180?5000:2000);
  score=Math.max(0,Math.min(100,Math.round(score)));
  let grade=score>=90?"강력 추천":score>=80?"추천":score>=70?"검토":score>=60?"애매":"비추천";
  return {score,grade,hourly,net,reasons};
}

function render(c,s){
  current={...c,...s};
  $("#heroScore").textContent=s.score;
  $("#heroGrade").textContent=s.grade;
  $("#heroSub").textContent=`${c.source} · ${c.amount?won(c.amount):"금액 확인 필요"}`;
  $("#resultCard").classList.remove("hidden");
  $("#sourceBadge").textContent=c.source;
  $("#amount").textContent=won(c.amount);
  $("#pickup").textContent=c.pickup||"확인 필요";
  $("#destination").textContent=c.destination||"확인 필요";
  $("#duration").textContent=c.duration?c.duration+"분":"-";
  $("#pickupKm").textContent=km(c.pickupKm);
  $("#tripKm").textContent=km(c.tripKm);
  $("#hourly").textContent=s.hourly?won(s.hourly):"-";
  $("#score").textContent=s.score;
  $("#grade").textContent=s.grade;
  $("#scoreReason").textContent=s.net?`1차 추정 순익 ${won(s.net)}`:"";
  $("#reasons").innerHTML=s.reasons.map(x=>`<div class="reason">✓ ${x}</div>`).join("");
}

async function runOCR(file){
  $("#progressWrap").classList.remove("hidden");
  $("#progressText").textContent="OCR 엔진 준비 중…";
  try{
    const worker=await Tesseract.createWorker("kor+eng",1,{logger:m=>{
      if(m.progress){$("#progressBar").style.width=Math.round(m.progress*100)+"%";}
      if(m.status)$("#progressText").textContent=m.status;
    }});
    const result=await worker.recognize(file);
    await worker.terminate();
    return result.data.text;
  }catch(e){
    throw new Error("OCR 처리에 실패했습니다. 아래 샘플 또는 텍스트 입력 기능을 사용할 수 있습니다.");
  }finally{
    setTimeout(()=>$("#progressWrap").classList.add("hidden"),700);
  }
}

$("#imageInput").addEventListener("change",async e=>{
  const file=e.target.files[0]; if(!file)return;
  $("#previewCard").classList.remove("hidden");
  $("#preview").src=URL.createObjectURL(file);
  $("#resultCard").classList.add("hidden");
  try{
    const text=await runOCR(file);
    const c=parseCall(text), s=scoreCall(c);
    render(c,s);
  }catch(err){ alert(err.message); }
});

$("#demoBtn").addEventListener("click",()=>{
  const text=`오픈콜
현금 실수익 28,000 P
이동 약 11.8km
출발 와동동 1569-6
약 149분 운행
도착 파주시 법원읍 법원읍문리`;
  const c=parseCall(text),s=scoreCall(c);
  render(c,s);
  $("#previewCard").classList.add("hidden");
});

$("#saveBtn").addEventListener("click",()=>{
  if(!current)return;
  const arr=JSON.parse(localStorage.getItem(historyKey)||"[]");
  arr.unshift({date:new Date().toLocaleString("ko-KR"),...current});
  localStorage.setItem(historyKey,JSON.stringify(arr.slice(0,100)));
  renderHistory();
  alert("운행기록에 저장했습니다.");
});

$("#clearBtn").addEventListener("click",()=>{
  if(confirm("저장된 기록을 모두 삭제할까요?")){
    localStorage.removeItem(historyKey); renderHistory();
  }
});

function renderHistory(){
  const arr=JSON.parse(localStorage.getItem(historyKey)||"[]");
  const box=$("#history");
  if(!arr.length){box.className="history empty";box.textContent="아직 저장된 콜이 없습니다.";return;}
  box.className="history";
  box.innerHTML=arr.map(x=>`<div class="history-item">
    <div><strong>${x.amount?won(x.amount):"-"} · ${x.source}</strong>
    <small>${x.pickup||"-"} → ${x.destination||"-"}<br>${x.date}</small></div>
    <div class="history-score">${x.score}점</div>
  </div>`).join("");
}

if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));
renderHistory();
