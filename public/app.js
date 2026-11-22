const root = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const toast = document.querySelector('#toast');
const paths = {
  day: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"/>',
  schedule: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-14 4h3m4 0h3m-10 3h3"/>',
  grades: '<path d="m2 8 10-5 10 5-10 5L2 8zm4 3v5c4 3 8 3 12 0v-5m4-3v7"/>',
  requests: '<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>',
  notices: '<path d="M4 17h16l-2-3V9a6 6 0 0 0-12 0v5l-2 3zm6 3a2.5 2.5 0 0 0 4 0"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 1 1 16 0"/>',
  logout: '<path d="M10 4H4v16h6m5-12 4 4-4 4m-7-4h11"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  location: '<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0z"/><circle cx="12" cy="9" r="2"/>',
  route: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M5 16v-5a3 3 0 0 1 3-3h4m7 0v5a3 3 0 0 1-3 3h-4"/>',
  change: '<path d="M4 8h14l-3-3m5 11H6l3 3"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="m3 3 18 18M9 5.5a9.5 9.5 0 0 1 3-.5c6 0 10 7 10 7a20 20 0 0 1-3.5 4.3M6.5 6.5A21 21 0 0 0 2 12s4 7 10 7a10 10 0 0 0 4.5-1.2"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  menu: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v1"/>',
  open: '<path d="m9 6 6 6-6 6"/>',
  flag: '<path d="M5 21V4m0 0c5-4 9 4 14 0v9c-5 4-9-4-14 0"/>',
};
const labels = { day:'Мой день', schedule:'Расписание', grades:'Успеваемость', requests:'Заявки', notices:'Уведомления', profile:'Профиль' };
const titles = { ...labels, requests:'Заявки в деканат' };
const icon = (name, size=20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brand = () => '<span class="brand"><img src="/mark.svg" width="39" height="39" alt=""><span>между<span>парами</span></span></span>';
const stamp = () => '<span class="stamp"><span></span> Конкурсный прототип</span>';
const avatars = (initials, alt=false) => `<span class="avatar ${alt?'alt':''}" aria-hidden="true">${esc(initials)}</span>`;
const dateObj = s => new Date(s.length === 10 ? s+'T12:00:00+03:00' : s);
const dateText = (s, opts={day:'numeric',month:'long'}) => {
  const d=dateObj(s || ''); return Number.isNaN(d.getTime()) ? esc(s) : d.toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',...opts});
};
const cleanDate = s => dateText(s,{weekday:'short',day:'numeric',month:'long'}).replace('.', '');
const fullName = p => [p.lastName,p.firstName,p.middleName].filter(Boolean).join(' ');
const dayList = ['2026-11-23','2026-11-24','2026-11-25','2026-11-26','2026-11-27','2026-11-28','2026-11-29'];
let data=null, view='day', selectedDate=dayList[0], scheduleMode='day', activeNoticeFilter='all', activeReqFilter='all';
let modalOrigin=null, messageTimer, pendingDraft=null, formBusy=false, passwordRequired=false;
class ApiError extends Error { constructor(message,status){ super(message); this.status=status; } }
async function api(url,body) {
  let response;
  try { response=await fetch('/api/'+url,body===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}); }
  catch { throw new ApiError('Нет связи с кабинетом. Проверьте интернет и повторите попытку.',0); }
  const result=await response.json().catch(()=>({}));
  if(result.passwordRequired===true) passwordRequired=true;
  if(!response.ok) throw new ApiError(result.error || 'Сервис временно недоступен. Попробуйте ещё раз.',response.status);
  return result;
}
function notify(message) {
  clearTimeout(messageTimer); toast.textContent=message; toast.classList.add('visible');
  messageTimer=setTimeout(()=>toast.classList.remove('visible'),4400);
}
function setError(element,message) { if(element){element.textContent=message; element.hidden=false;} }
function reportError(error,element) {
  if(error.status===401 && data){closeDialog();data=null;loginView();notify('Сессия завершилась. Войдите снова.');return;}
  if(element) setError(element,error.message); else notify(error.message);
}
function showDialog(html) {
  if(!dialog.open) {modalOrigin=document.activeElement;dialog.innerHTML=html;dialog.showModal();}
  else dialog.innerHTML=html;
  document.body.classList.add('modal-open');
  dialog.querySelector('.modal-close')?.focus({preventScroll:true});
}
function closeDialog(){if(dialog.open)dialog.close();}
dialog.addEventListener('close',()=>{document.body.classList.remove('modal-open');dialog.innerHTML='';if(modalOrigin?.isConnected)modalOrigin.focus({preventScroll:true});});
dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeDialog();}});
const modalHead = (title,sub='') => `<div class="modal-head"><div>${sub?`<p class="eyebrow">${esc(sub)}</p>`:''}<h2 id="modal-title">${esc(title)}</h2></div><button type="button" class="icon-btn modal-close" data-act="close" aria-label="Закрыть">${icon('close')}</button></div>`;
function loginView(register=false) {
  const title = register ? 'Регистрация' : 'Вход для студента';
  document.title = (register ? 'Регистрация' : 'Вход') + ' — Между парами';
  root.innerHTML=`<div class="login-layout"><header class="login-top">${brand()}${stamp()}</header>
  <main id="main" class="login-main${register ? ' register-layout' : ''}">
    <section class="login-poster"><div class="poster-copy"><span class="poster-kicker"><span class="spark">✳</span> Цифровой деканат</span>
    <h1>В деканат<br><em>между парами.</em></h1><p>Кабинет найдёт окно в расписании, чтобы успеть в деканат до следующей пары.</p></div>
    <div class="poster-art"><img src="/campus.svg" alt="Схема маршрута от учебного корпуса до деканата"></div>
    <div class="poster-foot">${icon('route',17)}<span>Маршрут по кампусу</span><span class="foot-rule"></span><span>А-112</span></div></section>
    <section class="login-panel" aria-labelledby="login-title"><div class="login-form-inner"><p class="eyebrow">Личный кабинет</p><h2 id="login-title" tabindex="-1">${title}</h2>
    <form id="${register ? 'register-form' : 'login-form'}"><label>Логин<input name="login" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="${register ? 'Например, student26' : 'Ваш логин'}" required maxlength="${register ? 24 : 80}" ${register ? 'minlength="3" aria-describedby="login-help"' : ''}></label>
    ${register ? '<p class="field-help" id="login-help">От 3 до 24 символов. Начните с латинской буквы.</p>' : ''}
    <label>Пароль<span class="password-control"><input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" placeholder="${register ? 'Минимум 10 символов' : 'Ваш пароль'}" required maxlength="${register ? 128 : 255}" ${register ? 'minlength="10" aria-describedby="password-help"' : ''}><button class="eye" type="button" data-act="password" aria-label="Показать пароль" aria-pressed="false">${icon('eye',19)}</button></span></label>
    ${register ? `<p class="field-help" id="password-help">Придумайте отдельный пароль для прототипа.</p>
    <label>Повторите пароль<input name="confirmPassword" type="password" autocomplete="new-password" minlength="10" maxlength="128" required></label>
    <fieldset class="registration-fields" aria-describedby="profile-help"><legend>Данные студента</legend>
    <p class="field-help" id="profile-help">Укажите вымышленные данные для конкурсного прототипа.</p>
    <div class="registration-pair">
      <label>Фамилия<input name="lastName" autocomplete="off" maxlength="40" required></label>
      <label>Имя<input name="firstName" autocomplete="off" maxlength="40" required></label>
    </div>
    <label>Отчество <small>необязательно</small><input name="middleName" autocomplete="off" maxlength="40"></label>
    <label>Факультет<input name="faculty" autocomplete="off" maxlength="90" required></label>
    <label>Направление<input name="program" autocomplete="off" maxlength="90" required></label>
    <div class="registration-pair">
      <label>Курс<select name="year" required><option value="">Выберите курс</option>${[1,2,3,4,5,6].map(y=>`<option value="${y}">${y} курс</option>`).join('')}</select></label>
      <label>Группа<input name="group" autocomplete="off" maxlength="20" required></label>
    </div></fieldset>` : ''}
    <p class="error" id="login-error" role="alert" hidden></p><button class="btn primary wide" type="submit">${register ? 'Создать аккаунт' : 'Войти в кабинет'}</button></form>
    <p class="auth-switch">${register ? 'Уже есть аккаунт?' : 'Впервые здесь?'} <button class="text-btn" type="button" data-act="${register ? 'show-login' : 'show-register'}">${register ? 'Войти' : 'Зарегистрироваться'}</button></p>
    ${register ? '' : passwordRequired ? `<p class="demo-note">${icon('lock',15)} Для жюри предусмотрены два тестовых аккаунта.</p>` : `<div class="or"><span></span>или попробовать демоверсию<span></span></div>
    <div class="demo-options"><button class="demo-person" data-act="demo" data-login="mira">${avatars('МВ')}<span><b>Мира</b><small>Дизайн</small></span></button><button class="demo-person" data-act="demo" data-login="lev">${avatars('ЛС',true)}<span><b>Лев</b><small>Аналитика</small></span></button></div>
    <p class="demo-note">${icon('lock',15)} Демо откроет отдельный учебный профиль.</p>`}
    </div></section>
  </main><footer class="login-footer"><span>Между парами · 2026</span><span>Все данные вымышлены</span></footer></div>`;
}
const shouldAlert = () => data.notices.filter(n=>!n.read).length;
function navItem(key,mobile=false) {
  const count=key==='notices'?shouldAlert():0;
  return `<a href="#${key}" class="nav-link ${view===key?'current':''}" ${view===key?'aria-current="page"':''}>${icon(key)}<span>${mobile && key==='schedule'?'Пары':labels[key]}</span>${count?`<b class="count">${count}</b>`:''}</a>`;
}
function render(focus=false){
  if(!data)return;
  const p=data.profile, unread=shouldAlert();
  document.title=`${titles[view]} — Между парами`;
  root.innerHTML=`<div class="shell"><aside class="sidebar"><a class="brand-link" href="#day" aria-label="Между парами, мой день">${brand()}</a>
  <nav class="side-nav" aria-label="Основная навигация">${Object.keys(labels).filter(k=>k!=='profile').map(k=>navItem(k)).join('')}</nav>
  <div class="side-bottom"><a class="user-link ${view==='profile'?'selected':''}" href="#profile">${avatars(p.initials,p.firstName==='Лев')}<span><b>${esc(p.firstName)} ${esc(p.lastName)}</b><small>${esc(p.group)} · ${esc(p.year)} курс</small></span></a><span class="side-foot">Конкурсный прототип<br>Все данные вымышлены</span></div></aside>
  <div class="main-wrap"><header class="topbar"><span class="desk-top">Студенческий кабинет</span><a class="mobile-brand" href="#day">${brand()}</a><div class="top-right"><span class="demo-day">${icon('clock',15)} Демо-день · 10:25 МСК</span><a class="icon-btn bell ${unread?'unread':''}" href="#notices" aria-label="Уведомления${unread?', непрочитанных '+unread:''}">${icon('notices')}</a></div></header>
  <main id="main" tabindex="-1">${({day:dayView,schedule:scheduleView,grades:gradesView,requests:requestsView,notices:noticesView,profile:profileView})[view]()}</main>
  <footer class="app-footer">Между парами <span>Конкурсный прототип · Вымышленные данные</span></footer></div>
  <nav class="mobile-nav" aria-label="Мобильная навигация">${['day','schedule','requests','grades'].map(k=>navItem(k,true)).join('')}<button class="nav-link ${['profile','notices'].includes(view)?'current':''}" data-act="more">${icon('menu')}<span>Ещё</span></button></nav></div>`;
  if(focus){document.querySelector('#main').focus({preventScroll:true});window.scrollTo(0,0);}
}
function fromHash(){const key=location.hash.slice(1);return Object.hasOwn(labels,key)?key:'day';}
function navigate(key){if(location.hash==='#'+key){view=key;render(true);}else location.hash=key;}
window.addEventListener('hashchange',()=>{if(data){closeDialog();view=fromHash();render(true);}});
const header = (eyebrow,title,aux='') => `<div class="page-head"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1></div>${aux}</div>`;
const empty = (name,title,copy='')=>`<div class="empty">${icon(name,25)}<div><b>${esc(title)}</b>${copy?`<p>${esc(copy)}</p>`:''}</div></div>`;
const sectionTop = (title,action='')=>`<div class="section-top"><h2>${esc(title)}</h2>${action}</div>`;
const badge=(label,cls='')=>`<span class="pill ${cls}">${esc(label)}</span>`;
function todayLessons(date=data.demo.date){return data.lessons.filter(l=>l.date===date).sort((a,b)=>a.start.localeCompare(b.start));}
function lessonCard(l) {
  const now=l.date===data.demo.date && l.start<=data.demo.time && l.end>data.demo.time;
  return `<article class="lesson ${now?'ongoing':''}"><div class="lesson-time"><strong>${esc(l.start)}</strong><small>${esc(l.end)}</small></div><div class="lesson-line"></div>
  <div class="lesson-body"><div class="lesson-label">${esc(l.type)} ${now?badge('Идёт сейчас','live'):''}</div><h3>${esc(l.title)}</h3><div class="lesson-meta"><span>${icon('location',15)}${esc(l.room)}</span><span>${icon('profile',15)}${esc(l.teacher)}</span></div>${l.change?`<div class="change-line">${icon('change',15)}${esc(l.change.text)}</div>`:''}</div></article>`;
}
function agenda(date) {
  const entries=todayLessons(date).map(l=>({time:l.start,html:lessonCard(l)}));
  for(const request of data.requests.filter(r=>r.slot?.date===date)){
    const s=request.slot;
    entries.push({time:s.start,html:`<article class="lesson visit-event"><div class="lesson-time"><strong>${esc(s.start)}</strong><small>${esc(s.end)}</small></div><div class="lesson-line"></div><div class="lesson-body"><div class="lesson-label">${icon('route',14)} Запланированный визит</div><h3>Визит в деканат</h3><div class="lesson-meta"><span>${icon('location',15)}${esc(s.room)}</span><button class="text-btn" data-act="detail" data-id="${esc(request.id)}">Посмотреть заявку</button></div></div></article>`});
  }
  return entries.sort((a,b)=>a.time.localeCompare(b.time)).map(entry=>entry.html).join('') || empty('day','Пар нет','В расписании на этот день нет занятий.');
}
function slotHero(){
  const planned=data.requests.filter(r=>r.slot && (r.slot.date>data.demo.date || (r.slot.date===data.demo.date && r.slot.end>data.demo.time)))
    .sort((a,b)=>(a.slot.date+a.slot.start).localeCompare(b.slot.date+b.slot.start))[0];
  const s=planned?.slot || data.slots[0];
  if(!s)return `<section class="window-hero"><div class="hero-copy"><span class="hero-label">${icon('route',16)} Окно в деканат</span><h2>Пока нет окон</h2><p>Отправьте обращение в деканат онлайн.</p><button class="btn lime" data-act="new">Подать заявку</button></div><img class="hero-map" src="/campus.svg" alt=""></section>`;
  const action=planned?`<button class="btn lime" data-act="detail" data-id="${esc(planned.id)}">${icon('requests',18)} Открыть заявку</button>`:`<button class="btn lime" data-act="slots">${icon('schedule',18)} Выбрать окно</button>`;
  return `<section class="window-hero"><div class="hero-copy"><span class="hero-label">${icon(planned?'check':'route',16)} ${planned?'Ваш визит в деканат':'Окно в деканат'}</span>
  <h2>${esc(s.start)}<span class="time-dash">–</span>${esc(s.end)}</h2><p>${s.date===data.demo.date?'Сегодня':esc(cleanDate(s.date))} в приёмной ${esc(s.room)}. ${planned?'Визит добавлен в расписание.':'Успеете между парами.'}</p>
  ${action}</div><img class="hero-map" src="/campus.svg" alt=""><span class="hero-corner" aria-hidden="true">✳</span></section>`;
}
function dayView(){
  const n=data.notices.find(n=>!n.read)||data.notices[0];
  return `${header('Понедельник, 23 ноября', 'Мой день',`<span class="semester">Осенний семестр · 2026</span>`)}${slotHero()}
  <div class="dashboard-grid"><section class="white-panel day-schedule">${sectionTop('План на сегодня','<a class="text-link" href="#schedule">Расписание</a>')}${agenda(data.demo.date)}</section>
  <div class="dashboard-side"><section class="white-panel side-card">${sectionTop('Деканат на связи')}<p class="muted">Справки, выписки и вопросы по учёбе.</p>
  <button class="btn secondary wide" data-act="new">${icon('plus',17)} Подать заявку</button></section>
  <section class="white-panel side-card">${sectionTop('Уведомления',`<a href="#notices" class="text-link">Все</a>`)}${n?`<button class="notice-preview" data-act="notice" data-id="${esc(n.id)}"><span class="notice-kicker">${icon('notices',16)} ${esc(dateText(n.date))}</span><b>${esc(n.title)}</b><span>${esc(n.body)}</span></button>`:empty('notices','Пока тихо')}</section></div></div>`;
}
function scheduleView(){
  const week=scheduleMode==='week', date=selectedDate;
  return `${header('23–29 ноября 2026','Расписание')}
  <div class="tool-row"><div class="seg" aria-label="Период расписания"><button data-act="period" data-mode="day" aria-pressed="${!week}">День</button><button data-act="period" data-mode="week" aria-pressed="${week}">Неделя</button></div><span class="timezone">Время московское</span></div>
  ${week?`<div class="week-list">${dayList.map(d=>`<section class="white-panel schedule-panel">${sectionTop(cleanDate(d))}${agenda(d)}</section>`).join('')}</div>`:
  `<div class="date-strip" aria-label="Выберите день">${dayList.map(d=>`<button data-act="date" data-date="${d}" aria-pressed="${date===d}"><small>${esc(dateText(d,{weekday:'short'}))}</small><b>${d.slice(-2)}</b></button>`).join('')}</div>
  <section class="white-panel schedule-panel">${sectionTop(cleanDate(date))}${agenda(date)}</section>`}
  <button class="window-link" data-act="slots">${icon('route',21)}<span><b>Окно в деканат</b><small>Подобрать время по расписанию</small></span>${icon('open',18)}</button>`;
}
function gradesView(){
  const grades=data.grades, done=grades.filter(g=>g.result!=='В процессе').length;
  const total=grades.reduce((s,g)=>s+g.score,0), max=grades.reduce((s,g)=>s+g.max,0);
  return `${header('Осенний семестр · 2026','Успеваемость')}
  <div class="metrics"><article class="metric blue"><span>${icon('grades',19)} Средний результат</span><strong>${max?Math.round(total/max*100):'—'}<small> / 100</small></strong></article>
  <article class="metric green"><span>${icon('check',19)} Аттестация пройдена</span><strong>${done}<small> из ${grades.length} дисциплин</small></strong></article></div>
  <section class="white-panel">${sectionTop('Дисциплины')}<div class="grade-list">${grades.map(g=>`<article class="grade-row"><div><small>${esc(g.assessment)}</small><h3>${esc(g.title)}</h3></div><div class="grade-score"><b>${esc(g.score)} / ${esc(g.max)}</b><span class="meter"><i style="width:${Math.min(100,Math.max(0,Number(g.score)/Number(g.max)*100))}%"></i></span></div>${badge(g.result,g.result==='В процессе'?'warm':'soft')}</article>`).join('')}</div></section>
  <section class="white-panel lower-panel">${sectionTop('Зимняя сессия')}<div class="exams">${data.exams.map(ex=>`<article class="exam"><div class="calendar-tile"><b>${ex.date.slice(8,10)}</b><small>${esc(dateText(ex.date,{month:'short'}))}</small></div><div><small>${esc(ex.type)}</small><h3>${esc(ex.title)}</h3><span>${icon('clock',15)} ${esc(ex.time)} · ${esc(ex.room)}</span></div></article>`).join('') || empty('schedule','Расписание сессии ещё не опубликовано')}</div></section>`;
}
const statusClass=s=>['Готова','Есть ответ'].includes(s)?'soft':s==='В работе'?'warm':'blue-tint';
function requestItem(r){
  return `<button class="request-row" data-act="detail" data-id="${esc(r.id)}"><span class="item-symbol">${icon(r.type==='question'?'mail':'requests',22)}</span><span class="request-copy"><small>${esc(dateText(r.createdAt))}</small><b>${esc(r.title)}</b>${r.slot?`<span>${icon('route',14)} Визит · ${esc(cleanDate(r.slot.date))}, ${esc(r.slot.start)}</span>`:''}</span>${badge(r.status,statusClass(r.status))}${icon('open',16)}</button>`;
}
function requestsView(){
  const items=data.requests.filter(r=>activeReqFilter==='all'||(activeReqFilter==='done' ? ['Готова','Есть ответ'].includes(r.status) : !['Готова','Есть ответ'].includes(r.status)));
  return `${header('Справки и обращения','Заявки в деканат',`<button class="btn primary" data-act="new">${icon('plus',17)} Подать заявку</button>`)}
  <section class="white-panel"><div class="section-top"><h2>Мои заявки</h2><button class="text-btn" data-act="refresh">Обновить</button></div><div class="filter-row">${[['all','Все'],['active','В работе'],['done','Завершённые']].map(([key,l])=>`<button class="filter" data-act="req-filter" data-filter="${key}" aria-pressed="${activeReqFilter===key}">${l}</button>`).join('')}</div>
  ${items.length?items.map(requestItem).join(''):empty('requests','В этой категории пока нет заявок','Здесь появятся обращения и их статусы.')}</section>
  <button class="window-link" data-act="slots">${icon('route',21)}<span><b>Запланировать визит</b><small>Подобрать время между занятиями</small></span>${icon('open',18)}</button>`;
}
const noticeKinds={change:['Перенос','change'],deadline:['Дедлайн','clock'],news:['Объявление','notices'],request:['Заявка','requests']};
function noticesView(){
  const unread=shouldAlert(), notes=data.notices.filter(n=>activeNoticeFilter==='all'||!n.read);
  return `${header('Новости деканата и учебные события','Уведомления',unread?'<button class="btn secondary" data-act="read-all">Прочитать все</button>':'')}
  <section class="white-panel"><div class="filter-row first"><button class="filter" data-act="notice-filter" data-filter="all" aria-pressed="${activeNoticeFilter==='all'}">Все</button><button class="filter" data-act="notice-filter" data-filter="unread" aria-pressed="${activeNoticeFilter==='unread'}">Непрочитанные · ${unread}</button></div>
  ${notes.map(n=>{const [label,symbol]=noticeKinds[n.kind]||['Новость','notices'];return `<button class="notification-row ${n.read?'':'new'}" data-act="notice" data-id="${esc(n.id)}"><span class="item-symbol ${esc(n.kind)}">${icon(symbol,21)}</span><span class="notification-copy"><small>${label} · ${esc(dateText(n.date))}</small><b>${esc(n.title)}</b><span>${esc(n.body)}</span></span>${!n.read?'<i class="unread-dot" aria-label="Не прочитано"></i>':''}</button>`;}).join('')||empty('check','Всё прочитано','Новые уведомления появятся здесь.')}</section>`;
}
function profileView(){
  const p=data.profile;
  const profileFields=[['Факультет',p.faculty],['Направление',p.program],['Курс',p.year],['Группа',p.group]];
  if(p.login)profileFields.push(['Логин',p.login]);
  return `${header('Студенческий кабинет','Профиль')}<section class="white-panel profile-panel"><div class="profile-top">${avatars(p.initials,p.firstName==='Лев')}<div><p class="eyebrow">Студенческий профиль</p><h2>${esc(fullName(p))}</h2></div></div>
  <dl class="profile-fields">${profileFields.map(([l,v])=>`<div><dt>${l}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
  <div class="profile-footer"><p>${icon('lock',17)} Данные учебного профиля вымышлены.</p><button class="btn secondary" data-act="logout">${icon('logout',17)} Выйти</button></div></section>`;
}
function slotsDialog(){
  const slots=data.slots;
  showDialog(`${modalHead('Выберите окно','Визит в деканат')}<p class="modal-intro">Каждый визит длится 15 минут. В подборке учтены ваши занятия, часы приёма и дорога.</p>
  <div class="slot-list">${slots.map(s=>`<button class="slot-option" data-act="pick-slot" data-id="${esc(s.id)}"><span class="slot-date">${esc(cleanDate(s.date))}</span><b>${esc(s.start)}–${esc(s.end)}</b><span class="slot-reason">${esc(s.reason)}</span><span class="slot-room">${icon('location',15)} Приёмная ${esc(s.room)}</span></button>`).join('')||empty('schedule','Свободных окон пока нет','Можно отправить заявку онлайн.')}</div>
  <button class="btn secondary wide" data-act="new">Подать заявку без визита</button>`);
}
function nextClientId(){return crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');}
function newRequest(slotId=''){
  pendingDraft={clientId:nextClientId()};
  showDialog(`${modalHead('Новая заявка','Деканат')}<form id="request-form">
  <label>Что вам нужно?<select name="type">${data.requestTypes.map(t=>`<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('')}</select></label>
  <p class="field-help type-help" id="type-help">${esc(data.requestTypes[0]?.description)}</p>
  <label><span id="note-label">Комментарий <small>необязательно</small></span><textarea name="note" rows="3" maxlength="1000" placeholder="Например, для студенческого проездного"></textarea></label>
  <p class="field-help">Используйте вымышленные данные.</p>
  <label>Визит в приёмную<select name="slotId"><option value="">Без визита</option>${data.slots.map(s=>`<option value="${esc(s.id)}" ${s.id===slotId?'selected':''}>${esc(cleanDate(s.date))} · ${esc(s.start)}–${esc(s.end)}</option>`).join('')}</select></label>
  <p class="slot-explanation" id="slot-explanation"></p><p id="request-error" class="error" role="alert" hidden></p>
  <button type="submit" class="btn primary wide">Отправить заявку</button></form>`);
  updateSlotExplanation();
}
function updateSlotExplanation(){
  const form=document.querySelector('#request-form');if(!form)return;
  const s=data.slots.find(s=>s.id===form.elements.slotId.value);
  const t=form.querySelector('#slot-explanation');
  t.hidden=!s;t.textContent=s ? `Приёмная ${s.room}. ${s.reason} Визит бронируется после отправки заявки.`:'';
}
function detailDialog(r,wasCreated=false){
  const hasSlot=!!r.slot;
  showDialog(`<div data-request-detail="${esc(r.id)}">${modalHead(r.title,wasCreated?'Заявка отправлена':'Моя заявка')}
  <div class="detail-summary"><span>Статус</span>${badge(r.status,statusClass(r.status))}</div>
  ${hasSlot?`<div class="detail-slot">${icon('route',23)}<div><b>Визит запланирован</b><span>${esc(cleanDate(r.slot.date))} · ${esc(r.slot.start)}–${esc(r.slot.end)} · ${esc(r.slot.room)}</span></div></div>`:''}
  ${r.note?`<div class="detail-note"><small>Ваш комментарий</small><p>${esc(r.note)}</p></div>`:''}
  <h3 class="history-heading">История заявки</h3><ol class="history">${r.history.map(h=>`<li><div><b>${esc(h.status)}</b><small>${esc(dateText(h.date))} · ${dateObj(h.date).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'})}</small></div><p>${esc(h.text)}</p></li>`).join('')}</ol>
  ${!['Готова','Есть ответ'].includes(r.status) && r.createdAt.startsWith(data.demo.date)?'<p class="demo-hint">В демоверсии обработка заявки занимает около 45 секунд. Статус обновится автоматически.</p>':''}
  <button type="button" class="btn secondary wide" data-act="to-requests">Мои заявки</button></div>`);
}
async function openNotice(id){
  const n=data.notices.find(n=>n.id===id);if(!n)return;
  if(!n.read){await api('notices/read',{id});n.read=true;render();}
  const [kind]=noticeKinds[n.kind]||['Уведомление'];
  showDialog(`${modalHead(n.title,kind)}<p class="notice-date">${esc(dateText(n.date))}</p><p class="notice-full">${esc(n.body)}</p>
  ${n.requestId?`<button class="btn secondary" data-act="detail" data-id="${esc(n.requestId)}">Открыть заявку</button>`:n.kind==='change'?'<button class="btn secondary" data-act="to-schedule">Открыть расписание</button>':''}`);
}
async function authenticate(endpoint,body,button){
  if(formBusy)return;formBusy=true;
  const buttons=[...document.querySelectorAll('.login-panel button')], label=button?.textContent;
  buttons.forEach(b=>b.disabled=true);document.querySelector('#login-error').hidden=true;
  if(button?.type==='submit')button.textContent=endpoint==='register'?'Создаём аккаунт…':'Входим…';
  try{await api(endpoint,body);data=await api('state');selectedDate=data.demo.date;activeNoticeFilter='all';activeReqFilter='all';scheduleMode='day';view='day';history.replaceState(null,'','#day');render(true);}
  catch(error){reportError(error,document.querySelector('#login-error'));}
  finally{formBusy=false;buttons.forEach(b=>b.disabled=false);if(button?.type==='submit')button.textContent=label;}
}
async function reloadData(){const next=await api('state');data=next;render();}
document.addEventListener('change',e=>{
  if(e.target.closest('#request-form') && e.target.name==='slotId')updateSlotExplanation();
  if(e.target.closest('#request-form') && e.target.name==='type'){
    const form=e.target.form,type=data.requestTypes.find(t=>t.id===e.target.value),ask=type.id==='question';
    form.querySelector('#type-help').textContent=type.description;form.querySelector('#note-label').innerHTML=ask?'Ваш вопрос':'Комментарий <small>необязательно</small>';
    form.elements.note.required=ask;form.elements.note.minLength=ask?3:0;form.elements.note.placeholder=ask?'Какой вопрос вы хотите задать?':'Например, для студенческого проездного';
  }
});
document.addEventListener('submit',async e=>{
  if(!['login-form','register-form','request-form'].includes(e.target.id))return;e.preventDefault();
  const form=e.target, payload=Object.fromEntries(new FormData(form)), submit=form.querySelector('button[type=submit]');
  if(form.id==='login-form'){await authenticate('login',payload,submit);return;}
  if(form.id==='register-form'){
    const {login,password,confirmPassword,...details}=payload;
    if(password!==confirmPassword){
      setError(form.querySelector('#login-error'),'Пароли не совпадают.');
      form.elements.confirmPassword.focus();
      return;
    }
    await authenticate('register',{login,password,details},submit);
    return;
  }
  if(formBusy || !pendingDraft)return;formBusy=true;submit.disabled=true;submit.textContent='Отправляем…';
  try{
    const {request}=await api('requests',{...payload,clientId:pendingDraft.clientId});pendingDraft=null;
    data.requests=[request,...data.requests.filter(r=>r.id!==request.id)];
    if(request.slot)data.slots=data.slots.filter(s=>s.id!==request.slot.id);
    view='requests';activeReqFilter='all';history.replaceState(null,'','#requests');render(true);detailDialog(request,true);
    try { await reloadData(); } catch { /* The confirmed request is already in the current view. */ }
  }catch(error){reportError(error,form.querySelector('#request-error'));}
  finally{formBusy=false;submit.disabled=false;submit.textContent='Отправить заявку';}
});
async function act(button){
  const {act,id,filter,mode,date,login}=button.dataset;
  switch(act){
    case 'show-register':loginView(true);document.querySelector('#login-title').focus();break;
    case 'show-login':loginView();document.querySelector('#login-title').focus();break;
    case 'password':{const input=button.parentElement.querySelector('input');const visible=input.type==='password';input.type=visible?'text':'password';button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',visible?'Скрыть пароль':'Показать пароль');button.innerHTML=icon(visible?'eyeoff':'eye',19);break;}
    case 'demo':await authenticate('demo',{login},button);break;
    case 'close':closeDialog();break;
    case 'more':showDialog(`${modalHead('Ещё разделы')}<nav class="more-nav" aria-label="Дополнительные разделы">${navItem('notices')}${navItem('profile')}</nav>`);break;
    case 'period':scheduleMode=mode;render();break;
    case 'date':selectedDate=date;render();break;
    case 'slots':slotsDialog();break;
    case 'new':newRequest();break;
    case 'pick-slot':newRequest(id);break;
    case 'to-requests':closeDialog();navigate('requests');break;
    case 'to-schedule':closeDialog();navigate('schedule');break;
    case 'detail':{const {request}=await api('requests/'+encodeURIComponent(id));detailDialog(request);break;}
    case 'notice':await openNotice(id);break;
    case 'notice-filter':activeNoticeFilter=filter;render();break;
    case 'req-filter':activeReqFilter=filter;render();break;
    case 'refresh':button.disabled=true;try{await reloadData();notify('Статусы обновлены.');}finally{button.disabled=false;}break;
    case 'read-all':button.disabled=true;try{await api('notices/read',{id:'all'});await reloadData();notify('Уведомления отмечены прочитанными.');}finally{button.disabled=false;}break;
    case 'logout':button.disabled=true;try{await api('logout',{});data=null;pendingDraft=null;closeDialog();history.replaceState(null,'',location.pathname);loginView();window.scrollTo(0,0);}finally{button.disabled=false;}break;
    case 'retry':await boot();break;
  }
}
document.addEventListener('click',e=>{const button=e.target.closest('[data-act]');if(button && !button.disabled)act(button).catch(err=>reportError(err));if(e.target.closest('.more-nav a'))closeDialog();});
let refreshing=false;
setInterval(async()=>{
  if(!data || refreshing || document.hidden || formBusy)return;
  const detail=dialog.querySelector('[data-request-detail]')?.dataset.requestDetail;
  if(view!=='requests' && view!=='notices' && !detail)return;
  const active=data.requests.some(r=>r.createdAt.startsWith(data.demo.date)&&!['Готова','Есть ответ'].includes(r.status));
  if(!active)return;refreshing=true;
  try{const before=JSON.stringify(data.requests),next=await api('state');if(!data)return;
    if(before!==JSON.stringify(next.requests)){data=next;render();if(detail && dialog.open){const changed=next.requests.find(r=>r.id===detail);if(changed)detailDialog(changed);}}
  }catch(e){if(e.status===401)reportError(e);}
  finally{refreshing=false;}
},4000);
async function boot(){
  try{data=await api('state');view=fromHash();selectedDate=data.demo.date;render();}
  catch(e){data=null;if(e.status===401){loginView();return;}
    loginView();setError(document.querySelector('#login-error'),e.message);}
}
boot();
