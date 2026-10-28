/* ============================================================
   ML Classification & Regression Test — Python, pandas, logistic/linear regression, trees, encoding
   One question per screen · navigator · flag · countdown timer
   Results saved to a Google Sheet via Apps Script (see SETUP.md).
   >>> paste your Web App URL below: <<<
   ============================================================ */
const WEBHOOK_URL = "PASTE_YOUR_WEB_APP_URL_HERE";

const STORAGE_KEY = "ml_classification_regression_state_v1";
const DEFAULT_TIME_MIN = 40;

let QUESTIONS = [];
let PASS_MARK = 60;
let POINTS_PER_Q = 0;
let TIME_LIMIT = DEFAULT_TIME_MIN * 60;
let timerId = null;

const TOPIC_LABELS = {}; // topic names in questions.json are already readable

const state = { name:"", group:"", answers:{}, flags:{}, current:0, timeLeft:TIME_LIMIT, finished:false };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const show = (id) => {
  document.querySelectorAll(".screen").forEach((s)=>s.classList.remove("active"));
  $(id).classList.add("active"); window.scrollTo(0,0);
};
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

/* ---------- boot ---------- */
async function boot(){
  try{
    const res = await fetch("questions.json?v=1");
    const data = await res.json();
    QUESTIONS = data.questions;
    PASS_MARK = data.passing || 60;
    if (data.time_limit_min) TIME_LIMIT = data.time_limit_min * 60;
    POINTS_PER_Q = 100 / QUESTIONS.length;
    state.timeLeft = TIME_LIMIT;
    $("q-count").textContent = QUESTIONS.length;
    $("time-limit-label").textContent = Math.round(TIME_LIMIT/60) + " min";
  }catch(e){ alert("Could not load questions.json."); return; }

  const nameEl=$("student-name"), groupEl=$("student-group");
  const ready=()=>{ $("start-btn").disabled = !(nameEl.value.trim() && groupEl.value.trim()); };
  nameEl.addEventListener("input",ready); groupEl.addEventListener("input",ready);

  $("start-btn").addEventListener("click",()=>{
    state.name=nameEl.value.trim(); state.group=groupEl.value.trim();
    state.answers={}; state.flags={}; state.current=0; state.timeLeft=TIME_LIMIT; state.finished=false;
    save();
    buildNav(); renderCurrent(); startTimer(); show("exam");
  });

  $("prev-btn").addEventListener("click",()=>goTo(state.current-1));
  $("next-btn").addEventListener("click",()=>goTo(state.current+1));
  $("flag-btn").addEventListener("click",toggleFlag);
  $("hint-btn").addEventListener("click",()=>togglePanel("hint-panel","hint-btn","Hint","Hide hint"));
  $("explain-btn").addEventListener("click",()=>togglePanel("explain-panel","explain-btn","Explain simply","Hide explanation"));
  $("diagram-btn").addEventListener("click",()=>togglePanel("diagram-panel","diagram-btn","Visual guide","Hide visual"));
  $("submit-btn").addEventListener("click",openConfirm);
  $("submit-btn-2").addEventListener("click",openConfirm);
  $("confirm-cancel").addEventListener("click",()=>$("confirm-modal").classList.remove("show"));
  $("confirm-submit").addEventListener("click",submitExam);

  document.addEventListener("keydown",(e)=>{
    if($("exam").classList.contains("active")===false) return;
    if(e.key==="ArrowRight") goTo(state.current+1);
    if(e.key==="ArrowLeft") goTo(state.current-1);
    const k=e.key.toUpperCase();
    if(["A","B","C","D"].includes(k)) selectOption("ABCD".indexOf(k));
  });
}

/* ---------- timer ---------- */
function startTimer(){
  if(timerId) clearInterval(timerId);
  renderTimer();
  timerId=setInterval(()=>{
    state.timeLeft--; save(); renderTimer();
    if(state.timeLeft<=0){ clearInterval(timerId); submitExam(true); }
  },1000);
}
function renderTimer(){
  const m=Math.floor(state.timeLeft/60), s=state.timeLeft%60;
  const t=$("timer");
  t.textContent = String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
  t.classList.toggle("low", state.timeLeft<=60);
}

/* ---------- navigator ---------- */
function buildNav(){
  const grid=$("nav-grid"); grid.innerHTML="";
  QUESTIONS.forEach((q,i)=>{
    const b=document.createElement("button");
    b.className="nav-btn"; b.textContent=i+1; b.dataset.i=i;
    b.addEventListener("click",()=>goTo(i));
    grid.appendChild(b);
  });
  updateNav();
}
function updateNav(){
  const btns=$("nav-grid").children;
  QUESTIONS.forEach((q,i)=>{
    const b=btns[i]; b.className="nav-btn";
    if(state.answers[q.id]!=null) b.classList.add("answered");
    if(state.flags[q.id]) b.classList.add("flagged");
    if(i===state.current) b.classList.add("current");
  });
  const answered=Object.keys(state.answers).length;
  const flagged=Object.values(state.flags).filter(Boolean).length;
  $("nav-summary").textContent = `${answered}/${QUESTIONS.length} answered · ${flagged} flagged`;
  const pct=Math.round((answered/QUESTIONS.length)*100);
  const ring=$("nav-progress");
  if(ring){ ring.style.setProperty("--progress",pct+"%"); ring.querySelector("span").textContent=pct+"%"; }
}

/* ---------- render one question ---------- */
function goTo(i){
  if(i<0||i>=QUESTIONS.length) return;
  state.current=i; save(); renderCurrent();
}
function renderCurrent(){
  const q=QUESTIONS[state.current];
  $("q-number").textContent="Question "+(state.current+1);
  $("q-topic").textContent=TOPIC_LABELS[q.topic]||q.topic;
  $("progress-label").textContent=`Question ${state.current+1} of ${QUESTIONS.length}`;
  const progress=$("progress-fill");
  if(progress) progress.style.width=((state.current+1)/QUESTIONS.length*100)+"%";
  $("q-text").textContent=q.q;
  const qc=$("q-code"); qc.textContent=q.code||""; qc.hidden=!q.code;
  const qv=$("q-visual"); qv.hidden=!q.visual;
  if(q.visual){ qv.src=q.visual; qv.alt=q.q; } else { qv.removeAttribute("src"); qv.alt=""; }

  const wrap=$("options"); wrap.innerHTML="";
  q.options.forEach((opt,i)=>{
    const sel=state.answers[q.id]===i;
    const el=document.createElement("label");
    el.className="opt"+(sel?" selected":"");
    el.innerHTML=`<input type="radio" name="q${q.id}" ${sel?"checked":""}/>
      <span class="letter">${String.fromCharCode(65+i)})</span><span>${esc(opt)}</span>`;
    el.addEventListener("click",()=>selectOption(i));
    wrap.appendChild(el);
  });

  const fb=$("flag-btn");
  fb.classList.toggle("on",!!state.flags[q.id]);
  fb.textContent=(state.flags[q.id]?"⚑ Flagged":"⚑ Flag for review");

  // learning helpers — hint + simple explanation (hidden until clicked)
  const hp=$("hint-panel"), ep=$("explain-panel");
  hp.textContent=q.hint||""; ep.textContent=q.explain_simple||"";
  hp.hidden=true; ep.hidden=true;
  $("hint-btn").textContent="Hint";
  $("explain-btn").textContent="Explain simply";
  $("hint-btn").style.display=q.hint?"":"none";
  $("explain-btn").style.display=q.explain_simple?"":"none";

  const dp=$("diagram-panel");
  const diag=(window.QUESTION_DIAGRAMS && window.QUESTION_DIAGRAMS[q.id]) || "";
  dp.innerHTML=diag; dp.hidden=true;
  $("diagram-btn").textContent="Visual guide";
  $("diagram-btn").style.display=diag?"":"none";

  $("prev-btn").disabled = state.current===0;
  const last = state.current===QUESTIONS.length-1;
  $("next-btn").hidden = last;
  $("submit-btn").hidden = !last;
  updateNav();
}
function selectOption(i){
  const q=QUESTIONS[state.current];
  if(i<0||i>=q.options.length) return;
  state.answers[q.id]=i; save();
  document.querySelectorAll("#options .opt").forEach((o,idx)=>{
    o.classList.toggle("selected",idx===i);
    const r=o.querySelector("input"); if(r) r.checked=(idx===i);
  });
  updateNav();
}
function toggleFlag(){
  const q=QUESTIONS[state.current];
  state.flags[q.id]=!state.flags[q.id]; save(); renderCurrent();
}
function togglePanel(panelId,btnId,showLabel,hideLabel){
  const p=$(panelId); p.hidden=!p.hidden;
  $(btnId).textContent=p.hidden?showLabel:hideLabel;
}

/* ---------- submit ---------- */
function openConfirm(){
  const answered=Object.keys(state.answers).length;
  const missing=QUESTIONS.length-answered;
  const flagged=Object.values(state.flags).filter(Boolean).length;
  $("confirm-summary").textContent =
    `${answered} answered, ${missing} blank${flagged?`, ${flagged} flagged`:""}. Blank questions are marked wrong.`;
  $("confirm-modal").classList.add("show");
}
function grade(){
  let correct=0; const perTopic={}; const review=[];
  QUESTIONS.forEach((q)=>{
    const chosen=state.answers[q.id]; const ok=chosen===q.answer;
    if(ok) correct++;
    perTopic[q.topic]=perTopic[q.topic]||{correct:0,total:0};
    perTopic[q.topic].total++; if(ok) perTopic[q.topic].correct++;
    review.push({q,chosen,ok});
  });
  return {correct, score:+(correct*POINTS_PER_Q).toFixed(1), perTopic, review};
}
async function submitExam(auto){
  if(timerId) clearInterval(timerId);
  $("confirm-modal").classList.remove("show");
  const r=grade(); state.finished=true; save();

  $("results-student").textContent=`${state.name} · ${state.group}`;
  const passed=r.score>=PASS_MARK;
  const pf=$("pass-fail"); pf.textContent=passed?"PASS":"FAIL"; pf.className="pass-fail "+(passed?"pass":"fail");
  $("score-big").textContent=r.score;

  const tb=$("topic-breakdown"); tb.innerHTML=""; const seen=[];
  QUESTIONS.forEach(q=>{ if(!seen.includes(q.topic)) seen.push(q.topic); });
  seen.forEach(t=>{ const p=r.perTopic[t];
    tb.innerHTML+=`<div class="section-score"><div class="label">${TOPIC_LABELS[t]||t}</div><div class="value">${p.correct} / ${p.total}</div></div>`; });

  const rev=$("review"); rev.innerHTML="";
  r.review.forEach(({q,chosen,ok})=>{
    const you=chosen==null?"(blank)":`${String.fromCharCode(65+chosen)}) ${esc(q.options[chosen])}`;
    const right=`${String.fromCharCode(65+q.answer)}) ${esc(q.options[q.answer])}`;
    rev.innerHTML+=`<div class="item ${ok?"correct":"wrong"}">
      <div class="qt">${q.id}. ${esc(q.q)}</div>${q.code?`<pre class="rv-code">${esc(q.code)}</pre>`:""}${q.visual?`<img class="rv-visual" src="${esc(q.visual)}" alt="${esc(q.q)}"/>`:""}
      <div class="line">Your answer: <span class="${ok?"right":"you-wrong"}">${you}</span></div>
      ${ok?"":`<div class="line">Correct: <span class="right">${right}</span></div>`}
      <div class="explain">${esc(q.explain)}</div></div>`;
  });

  show("results");
  $("save-status").textContent = auto ? "⏱ Time up — saving your result…" : "Saving your result…";
  const okSave=await sendToSheet(r);
  $("save-status").textContent = okSave ? "✅ Your result was saved."
    : "⚠️ Could not confirm save (your score is shown above). Tell your mentor.";
}

async function sendToSheet(r){
  if(!WEBHOOK_URL || WEBHOOK_URL.indexOf("PASTE_YOUR")===0){ console.warn("WEBHOOK_URL not set."); return false; }
  const answersStr=QUESTIONS.map(q=>{ const c=state.answers[q.id]; return q.id+":"+(c==null?"-":String.fromCharCode(65+c)); }).join(",");
  const seen=[]; QUESTIONS.forEach(q=>{ if(!seen.includes(q.topic)) seen.push(q.topic); });
  const topicsStr=seen.map(t=>t+" "+r.perTopic[t].correct+"/"+r.perTopic[t].total).join(" | ");
  const payload={ name:state.name, group:state.group, score:r.score, correct:r.correct, total:QUESTIONS.length,
    percent:Math.round((r.correct/QUESTIONS.length)*100), topics:topicsStr, answers:answersStr, timestamp:new Date().toISOString() };
  try{
    await fetch(WEBHOOK_URL,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});
    return true;
  }catch(e){ console.error(e); return false; }
}

boot();
