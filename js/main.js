
// OBS Study Overlay - main.js
(async function(){
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  // load config.json
  let config = {};
  try{ config = await fetch('config.json').then(r=>r.json()); }catch(e){ console.warn('No config.json'); }

  // apply theme if present
  function applyTheme(theme){
    if(!theme) return;
    const map = {
      '--bg': theme.bgColor,
      '--panel': theme.panelColor,
      '--accent': theme.accent,
      '--accent-strong': theme.accentStrong,
      '--text': theme.text,
      '--muted': theme.muted,
      '--timer': theme.timerColor,
      '--ok': theme.ok,
      '--warn': theme.warn
    };
    Object.entries(map).forEach(([k,v])=>{ if(v) document.documentElement.style.setProperty(k,v); });
  }
  applyTheme(config.theme);

  // URL params
  const params = new URLSearchParams(location.search);
  const urlChannel = params.get('channel');
  const scale = parseFloat(params.get('scale') || '0');
  if(!isNaN(scale) && scale>0){ document.body.dataset.scale = '1'; document.body.style.setProperty('--scale', scale); }

  // clock & session timer
  const startTime = Date.now();
  const liveClockEl = $('#liveClock');
  const sessionTimeEl = $('#sessionTime');
  function pad(n){ return n.toString().padStart(2,'0'); }
  function tickClock(){
    const d = new Date();
    liveClockEl.textContent = pad(d.getHours())+':'+pad(d.getMinutes());
    const ms = Date.now() - startTime;
    const m = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000);
    if(config.layout?.showSessionTimer !== false){
      sessionTimeEl.textContent = pad(m)+':'+pad(s);
    } else {
      sessionTimeEl.style.display='none';
    }
  }
  setInterval(tickClock, 1000); tickClock();

  // slideshow
  const slides = Array.isArray(config.slideshowImages) ? config.slideshowImages : [];
  const slideImg = $('#slideshowImage');
  const slideCap = $('#slideshowCaption');
  let slideIdx = 0;
  function showSlide(i){
    if(slides.length===0){ slideImg.alt = 'Keine Bilder konfiguriert'; slideCap.textContent = '—'; return; }
    slideIdx = (i+slides.length)%slides.length;
    slideImg.src = slides[slideIdx];
    slideCap.textContent = `Bild ${slideIdx+1}/${slides.length}`;
  }
  showSlide(0);
  const slideInterval = (config.slideshowIntervalSeconds||6)*1000;
  setInterval(()=>showSlide(slideIdx+1), slideInterval);

  // quotes rotator
  const quotes = Array.isArray(config.quotes) ? config.quotes : [];
  const quoteEl = $('#quote');
  let qi=0;
  function rotateQuote(){
    if(quotes.length===0){ quoteEl.style.display='none'; return; }
    qi = (qi+1)%quotes.length;
    quoteEl.textContent = '„'+quotes[qi]+'“';
  }
  setInterval(rotateQuote, 20000);
  rotateQuote();

  // social links
  const socialWrap = $('#socialLinks');
  (config.social?.links||[]).forEach(link=>{
    const a = document.createElement('a');
    a.href = link.url; a.target = '_blank'; a.rel='noopener';
    a.textContent = link.label;
    socialWrap.appendChild(a);
  });

  // chat embed
  const channel = (urlChannel || config.twitchChannel || '').trim();
  if(channel && channel !== 'DEINCHANNEL'){
    const chat = $('#chatEmbed');
    chat.innerHTML = '';
    const iframe = document.createElement('iframe');
    // parent param must include hostname(s) where the embed runs; when using local file, 'localhost' is common
    const parent = location.hostname || 'localhost';
    iframe.src = `https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat?parent=${parent}`;
    iframe.setAttribute('sandbox','allow-same-origin allow-scripts allow-popups');
    chat.appendChild(iframe);
  }

  // Pomodoro logic
  const timerDisplay = $('#timerDisplay');
  const timerStatus = $('#timerStatus');
  const btnStartPause = $('#btnStartPause');
  const btnReset = $('#btnReset');
  const btnNext = $('#btnNext');
  const modeFocus = $('#modeFocus');
  const modeShort = $('#modeShort');
  const modeLong = $('#modeLong');
  const progressBar = $('#progressBar');
  const pomosTodayEl = $('#pomosToday');
  const focusMinutesTodayEl = $('#focusMinutesToday');
  const LS_PREFIX = 'obsStudyOverlay:';

  const pomoCfg = {
    focus: (config.pomodoro?.focusMinutes ?? 25) * 60,
    short: (config.pomodoro?.shortBreakMinutes ?? 5) * 60,
    long: (config.pomodoro?.longBreakMinutes ?? 15) * 60,
    cyclesUntilLong: config.pomodoro?.cyclesUntilLongBreak ?? 4,
    autoNext: config.pomodoro?.autoStartNext !== false
  };

  let mode = 'focus'; // 'focus' | 'short' | 'long'
  let remaining = pomoCfg.focus;
  let running = false;
  let lastTick = null;
  let cyclesDone = 0;
  let tickInterval = null;

  function setMode(m){
    mode = m;
    [modeFocus,modeShort,modeLong].forEach(el=>el.classList.remove('active'));
    ({focus:modeFocus, short:modeShort, long:modeLong}[m]).classList.add('active');
    remaining = {focus:pomoCfg.focus, short:pomoCfg.short, long:pomoCfg.long}[m];
    timerStatus.textContent = m==='focus' ? 'Fokus' : (m==='short'?'Kurzpause':'Langpause');
    updateDisplay();
  }

  function formatTime(sec){
    const m = Math.floor(sec/60), s = Math.floor(sec%60);
    return pad(m)+':'+pad(s);
  }

  function updateDisplay(){
    timerDisplay.textContent = formatTime(Math.max(0,Math.ceil(remaining)));
    const total = {focus:pomoCfg.focus, short:pomoCfg.short, long:pomoCfg.long}[mode];
    progressBar.style.width = `${(1 - remaining/total)*100}%`;
  }

  function tick(){
    if(!running) return;
    const now = Date.now();
    const dt = (now - (lastTick||now))/1000;
    lastTick = now;
    remaining -= dt;
    if(remaining <= 0){
      running = false;
      remaining = 0;
      updateDisplay();
      onPhaseComplete();
    } else {
      updateDisplay();
    }
  }

  function onPhaseComplete(){
    beep();
    if(mode==='focus'){
      cyclesDone++;
      incPomosToday();
      addFocusMinutes(pomoCfg.focus/60);
      if(cyclesDone % pomoCfg.cyclesUntilLong === 0){
        setMode('long');
      }else{
        setMode('short');
      }
    } else {
      setMode('focus');
    }
    if(pomoCfg.autoNext){
      // small delay before auto-starting next phase
      setTimeout(()=>{ start(); }, 800);
    } else {
      timerStatus.textContent += ' – Fertig';
      btnStartPause.textContent = 'Start';
    }
  }

  function start(){
    if(running) return;
    running = true;
    lastTick = Date.now();
    btnStartPause.textContent = 'Pause';
    timerStatus.textContent = (mode==='focus' ? 'Fokus' : (mode==='short'?'Kurzpause':'Langpause')) + ' • läuft';
  }

  function stop(){ running = false; btnStartPause.textContent = 'Start'; }

  function reset(){
    running = false;
    setMode(mode);
    btnStartPause.textContent = 'Start';
  }

  btnStartPause.addEventListener('click', ()=>{
    if(running){ stop(); }
    else{ start(); }
  });
  btnReset.addEventListener('click', ()=>{ reset(); });
  btnNext.addEventListener('click', ()=>{ remaining = 0; updateDisplay(); onPhaseComplete(); });

  modeFocus.addEventListener('click', ()=>{ setMode('focus'); });
  modeShort.addEventListener('click', ()=>{ setMode('short'); });
  modeLong.addEventListener('click', ()=>{ setMode('long'); });

  setMode('focus'); updateDisplay();
  tickInterval = setInterval(tick, 250);

  // Hotkeys
  document.addEventListener('keydown', (e)=>{
    if(e.code==='Space'){ e.preventDefault(); btnStartPause.click(); }
    if(e.key==='r' || e.key==='R'){ btnReset.click(); }
    if(e.key==='n' || e.key==='N'){ btnNext.click(); }
    if(e.key==='t' || e.key==='T'){ $('#todoInput')?.focus(); }
  });

  // Stats storage
  function storageKey(k){ return LS_PREFIX + k; }
  function todayKey(suffix){ const d=new Date(); const y=d.getFullYear(), m=pad(d.getMonth()+1), day=pad(d.getDate()); return storageKey(`stat:${y}-${m}-${day}:${suffix}`); }
  function incPomosToday(){
    const k = todayKey('pomos');
    const v = parseInt(localStorage.getItem(k) || '0', 10) + 1;
    localStorage.setItem(k, v);
    pomosTodayEl.textContent = v;
  }
  function addFocusMinutes(min){
    const k = todayKey('focusMin');
    const v = parseInt(localStorage.getItem(k) || '0', 10) + Math.round(min);
    localStorage.setItem(k, v);
    focusMinutesTodayEl.textContent = v;
  }
  (function initStats(){
    pomosTodayEl.textContent = parseInt(localStorage.getItem(todayKey('pomos'))||'0', 10);
    focusMinutesTodayEl.textContent = parseInt(localStorage.getItem(todayKey('focusMin'))||'0', 10);
  })();

  // beep
  function beep(){
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.value = 0.05;
      o.start();
      setTimeout(()=>{ o.stop(); ctx.close(); }, 400);
    }catch(e){ /* ignore */ }
  }

  // Todo list
  const todoListEl = $('#todoList');
  const todoInput = $('#todoInput');
  const todoAdd = $('#todoAdd');
  const addTodoBtn = $('#addTodoBtn');
  const TODOS_KEY = storageKey('todos');

  function loadTodos(){
    try{ return JSON.parse(localStorage.getItem(TODOS_KEY) || '[]'); }catch(e){ return []; }
  }
  function saveTodos(t){ localStorage.setItem(TODOS_KEY, JSON.stringify(t)); }
  function renderTodos(){
    const todos = loadTodos();
    todoListEl.innerHTML = '';
    todos.forEach((t, idx)=>{
      const li = document.createElement('li');
      if(t.done) li.classList.add('done');
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = !!t.done;
      cb.addEventListener('change', ()=>{ todos[idx].done = cb.checked; saveTodos(todos); renderTodos(); });
      const span = document.createElement('span'); span.textContent = t.text; span.style.flex='1';
      const del = document.createElement('button'); del.className='btn'; del.textContent='×';
      del.addEventListener('click', ()=>{ todos.splice(idx,1); saveTodos(todos); renderTodos(); });
      li.appendChild(cb); li.appendChild(span); li.appendChild(del);
      todoListEl.appendChild(li);
    });
  }
  function addTodo(text){
    const trimmed = (text||'').trim();
    if(!trimmed) return;
    const todos = loadTodos();
    todos.unshift({ text: trimmed, done:false, ts: Date.now() });
    saveTodos(todos);
    todoInput.value='';
    renderTodos();
  }
  todoAdd.addEventListener('click', ()=> addTodo(todoInput.value));
  addTodoBtn.addEventListener('click', ()=> addTodo(todoInput.value || 'Neues Ziel'));
  todoInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ addTodo(todoInput.value); }});
  renderTodos();

  // Now playing placeholder (can be extended)
  const nowPlayingEl = $('#nowPlaying');
  async function updateNowPlaying(){
    // Placeholder: integrate your own endpoint if you have one
  }
  setInterval(updateNowPlaying, 15000);
  updateNowPlaying();

})();
