import { commonAcademics, demo, freeSlots, requestTypes, templates } from './seed.mjs';

const SESSION_MS = 8 * 60 * 60 * 1000;
const PROCESSING_MS = 15000;
const READY_MS = 45000;
const demoTime = Date.parse(demo.date + 'T' + demo.time + ':00+03:00');
const encoder = new TextEncoder();
const cookieName = 'mp_session';
const hex = (bytes) => Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
const unhex = (value) => Uint8Array.from(value.match(/../g), part => parseInt(part, 16));
const digest = async (value) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
const iso = (value) => new Date(value).toISOString();
const requestKind = (id) => requestTypes.find(type => type.id === id);
const registeredOwnerPrefix = 'registered-';
const loginPattern = /^[a-z][a-z0-9._-]{2,23}$/;
const normalizedLogin = (login) => typeof login === 'string' ? login.trim().toLowerCase() : '';

class UserError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers
  }});
}
function checkedTemplate(login) {
  return (typeof login === 'string' && Object.hasOwn(templates, login)) ? templates[login] : null;
}
async function passwordBits(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000
  }, key, 256);
  return new Uint8Array(bits);
}
async function passwordMatches(password, auth) {
  const bytes = await passwordBits(password, unhex(auth.salt));
  const expected = unhex(auth.hash);
  let different = 0;
  for (let i=0; i<expected.length; i++) different |= bytes[i] ^ expected[i];
  return different === 0;
}
async function bodyOf(request) {
  const origin = request.headers.get('Origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    throw new UserError(403, 'Откройте кабинет в той же вкладке и повторите действие.');
  }
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new UserError(415, 'Требуется запрос в формате JSON.');
  }
  if (Number(request.headers.get('Content-Length')) > 8192) throw new UserError(413, 'Слишком большой запрос.');
  if (!request.body) throw new UserError(400, 'Не удалось прочитать данные формы.');
  const reader = request.body.getReader(), chunks = [];
  let length = 0;
  for (;;) {
    const {value, done} = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 8192) { await reader.cancel(); throw new UserError(413, 'Слишком большой запрос.'); }
    chunks.push(value);
  }
  let data;
  try { data = JSON.parse(await new Blob(chunks).text()); } catch { /* malformed input */ }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new UserError(400, 'Не удалось прочитать данные формы.');
  return data;
}
function cookie(request, token, lifetime) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return cookieName+'='+token+'; Path=/; Max-Age='+lifetime+'; HttpOnly; SameSite=Lax'+secure;
}
async function getTokenHash(request) {
  const pair = (request.headers.get('Cookie') || '').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));
  const raw = pair?.slice(cookieName.length+1);
  return raw && /^[a-f0-9]{64}$/.test(raw) ? digest(raw) : null;
}
async function getSession(request, db) {
  const tokenHash = await getTokenHash(request);
  if (!tokenHash) return null;
  return db.prepare('SELECT owner, profile_key, token_hash FROM mp_sessions WHERE token_hash=? AND expires_at>?')
    .bind(tokenHash, Date.now()).first();
}
async function limitLogin(db, request, kind) {
  const now = Date.now(), period = 10*60*1000;
  // Only the trusted Worker-provided connection header is used. Raw addresses are never stored.
  const bucket = await digest(kind+'|'+(request.headers.get('CF-Connecting-IP') || 'local')+'|'+Math.floor(now/period));
  const row = await db.prepare('INSERT INTO mp_login_attempts(bucket, attempts, expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts')
    .bind(bucket, (Math.floor(now/period)+1)*period).first();
  const limit = { demo: 100, login: 35, register: 20 }[kind];
  if (row.attempts > limit) throw new UserError(429, 'Слишком много попыток. Попробуйте через 10 минут.');
}
async function startSession(request, db, body, isDemo) {
  const login = normalizedLogin(body.login);
  const fixture = checkedTemplate(login);
  await limitLogin(db, request, isDemo ? 'demo' : 'login');
  if (isDemo) {
    if (!fixture) throw new UserError(400, 'Выберите один из демонстрационных профилей.');
    return openSession(request, db, login, 'demo-' + crypto.randomUUID());
  }
  if (typeof body.password !== 'string' || !body.password || body.password.length > 255) {
    throw new UserError(401, 'Проверьте логин и пароль.');
  }
  const account = !fixture && loginPattern.test(login) ? await findAccount(db, login) : null;
  const matches = await passwordMatches(body.password, fixture?.auth || account || templates.mira.auth);
  if (!matches || (!fixture && !account)) throw new UserError(401, 'Проверьте логин и пароль.');
  const owner = (fixture ? 'student-' : registeredOwnerPrefix) + login;
  return openSession(request, db, fixture ? login : account.profile_key, owner);
}
function findAccount(db, login) {
  return db.prepare('SELECT profile_key, salt, hash FROM mp_accounts WHERE login=?').bind(login).first();
}
function profileFrom(details) {
  const fields = [
    ['firstName', 'имя', 40], ['lastName', 'фамилию', 40], ['middleName', 'отчество', 40],
    ['faculty', 'факультет', 90], ['program', 'направление', 90], ['group', 'группу', 20]
  ];
  const profile = {};
  for (const [key, label, max] of fields) {
    const raw = details?.[key];
    const value = typeof raw === 'string' ? raw.trim().replace(/ +/g, ' ') : '';
    if ((!value && key !== 'middleName') || value.length > max || /[<>\p{Cc}\p{Cf}]/u.test(value)) {
      throw new UserError(400, `Проверьте ${label}. Допустимо до ${max} символов.`);
    }
    if (value) profile[key] = value;
  }
  if (!/^[1-6]$/.test(String(details?.year))) throw new UserError(400, 'Укажите курс от 1 до 6.');
  profile.year = Number(details.year);
  profile.initials = [profile.firstName, profile.lastName].map((name) => Array.from(name)[0]).join('').toLocaleUpperCase('ru');
  return profile;
}
async function register(request, db, body) {
  const login = normalizedLogin(body.login);
  if (!loginPattern.test(login)) {
    throw new UserError(400, 'Введите от 3 до 24 символов. Начните с латинской буквы. Можно использовать цифры, точку, дефис и подчёркивание.');
  }
  if (typeof body.password !== 'string' || body.password.length < 10 ||
      body.password.length > 128 || !body.password.trim()) {
    throw new UserError(400, 'Введите пароль длиной от 10 до 128 символов.');
  }
  const profile = profileFrom(body.details);
  await limitLogin(db, request, 'register');
  const loginTaken = () => new UserError(409, 'Этот логин уже занят. Выберите другой.');
  if (checkedTemplate(login) || await findAccount(db, login)) throw loginTaken();

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await passwordBits(body.password, salt);
  const templateKey = 'mira';
  const inserts = [
    db.prepare('INSERT INTO mp_accounts(login, profile_key, salt, hash, created_at) VALUES(?,?,?,?,?)')
      .bind(login, templateKey, hex(salt), hex(hash), Date.now()),
    db.prepare('INSERT INTO mp_account_profiles(login,profile_json) VALUES(?,?)').bind(login, JSON.stringify(profile))
  ];
  try {
    return await openSession(request, db, templateKey, registeredOwnerPrefix + login, inserts);
  } catch (error) {
    if (await findAccount(db, login)) throw loginTaken();
    throw error;
  }
}
async function openSession(request, db, profileKey, owner, accountInserts=[]) {
  const raw = hex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await digest(raw), previous = await getTokenHash(request), now = Date.now();
  const seed = templates[profileKey].seedRequest;
  const oldDemo = "SELECT owner FROM mp_sessions WHERE owner LIKE 'demo-%' AND expires_at<=?";
  const statements = [
    ...accountInserts,
    db.prepare('UPDATE mp_sessions SET expires_at=0 WHERE token_hash=?').bind(previous || ''),
    db.prepare('DELETE FROM mp_requests WHERE owner IN ('+oldDemo+')').bind(now),
    db.prepare('DELETE FROM mp_read WHERE owner IN ('+oldDemo+')').bind(now),
    db.prepare('DELETE FROM mp_sessions WHERE expires_at<=?').bind(now),
    db.prepare('DELETE FROM mp_login_attempts WHERE expires_at<=?').bind(now),
    db.prepare('INSERT INTO mp_sessions(token_hash, owner, profile_key, expires_at) VALUES(?,?,?,?)')
      .bind(tokenHash, owner, profileKey, now+SESSION_MS),
  ];
  if (!owner.startsWith(registeredOwnerPrefix)) {
    statements.push(db.prepare('INSERT OR IGNORE INTO mp_requests(id, owner, client_id, type, note, created_at, preset) VALUES(?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), owner, 'fixture', seed.type, seed.note, Date.parse(seed.date), seed.preset));
  }
  await db.batch(statements);
  return json({ok:true}, 200, {'Set-Cookie':cookie(request,raw,SESSION_MS/1000)});
}

function requestView(row, slots, now) {
  const isQuestion = row.type === 'question';
  const start = row.preset ? row.created_at : demoTime;
  const createdAt = iso(start);
  const elapsed = now - row.created_at;
  const processing = row.preset ? true : elapsed >= PROCESSING_MS;
  const complete = row.preset ? row.preset === 'ready' : elapsed >= READY_MS;
  const history = [{status:'Принята', date:createdAt, text:'Обращение зарегистрировано в электронном журнале.'}];
  if (processing) history.push({status:'В работе', date:iso(start+(row.preset ? 3600000 : PROCESSING_MS)),
    text:isQuestion ? 'Деканат готовит ответ на обращение.' : 'Деканат готовит документ.'});
  if (complete) history.push({status:isQuestion ? 'Есть ответ' : 'Готова', date:iso(start+(row.preset ? 3*3600000 : READY_MS)),
    text:isQuestion ? 'Учебный ответ деканата: вопрос принят. Для обсуждения деталей можно прийти в А-112 в часы приёма.'
    : 'Документ можно получить в приёмной А-112 в часы работы деканата.'});
  return {id:row.id, type:row.type, title:requestKind(row.type).title, status:history.at(-1).status,
    createdAt, note:row.note, slot:slots.find(slot=>slot.id === row.slot_id) || null, history};
}
async function userRequests(db, session, slots, now) {
  const {results} = await db.prepare('SELECT * FROM mp_requests WHERE owner=? ORDER BY (preset IS NOT NULL), created_at DESC, id DESC')
    .bind(session.owner).all();
  return results.map(row=>requestView(row,slots,now));
}
function listedNotices(fixture, requests) {
  const eventNotices = requests.map(request => ({
    id:'req-'+request.id+'-'+request.history.length,
    title:request.title+' · '+request.status.toLocaleLowerCase('ru'),
    date:request.history.at(-1).date, kind:'request', body:request.history.at(-1).text, requestId:request.id
  }));
  return [...fixture.notices, ...eventNotices].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
}
async function state(db, session) {
  const fixture = templates[session.profile_key], allSlots = freeSlots(fixture.lessons);
  const studentLogin = session.owner.startsWith(registeredOwnerPrefix)
    ? session.owner.slice(registeredOwnerPrefix.length)
    : null;
  const [requests, read, profileJson] = await Promise.all([
    userRequests(db, session, allSlots, Date.now()),
    db.prepare('SELECT notice_id FROM mp_read WHERE owner=?').bind(session.owner).all(),
    studentLogin ? db.prepare('SELECT profile_json FROM mp_account_profiles WHERE login=?').bind(studentLogin).first('profile_json') : null
  ]);
  const seen = new Set(read.results.map(row=>row.notice_id));
  const occupied = new Set(requests.map(request=>request.slot?.id).filter(Boolean));
  const profile = profileJson ? JSON.parse(profileJson) : fixture.profile;
  const academic = profileJson ? commonAcademics : fixture;
  return { profile:{...profile,id:session.owner,...(studentLogin && {login:studentLogin})}, demo:{...demo, processingSeconds:15, readySeconds:45},
    lessons:academic.lessons, grades:academic.grades, exams:academic.exams, requestTypes, requests,
    notices:listedNotices(academic, requests).map(notice=>({...notice,read:seen.has(notice.id)})),
    slots:allSlots.filter(slot=>!occupied.has(slot.id)) };
}
async function addRequest(db, session, body) {
  if (!requestKind(body.type)) throw new UserError(400,'Выберите вид обращения.');
  if (typeof body.clientId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(body.clientId)) {
    throw new UserError(400,'Обновите форму и повторите отправку.');
  }
  if (body.note != null && typeof body.note !== 'string') throw new UserError(400,'Проверьте текст обращения.');
  const note = (body.note || '').trim();
  if (note.length > 1000) throw new UserError(400,'Максимальная длина сообщения — 1000 символов.');
  if (body.type === 'question' && note.length < 3) throw new UserError(400,'Напишите вопрос для деканата.');
  const slots = freeSlots(templates[session.profile_key].lessons);
  const slotId = body.slotId || null;
  if (slotId !== null && !slots.some(slot=>slot.id === slotId)) throw new UserError(400,'Выберите доступное окно из расписания.');
  const now = Date.now();
  const result = await db.prepare('INSERT OR IGNORE INTO mp_requests(id,owner,client_id,type,note,slot_id,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),session.owner,body.clientId,body.type,note,slotId,now).run();
  const row = await db.prepare('SELECT * FROM mp_requests WHERE owner=? AND client_id=?').bind(session.owner,body.clientId).first();
  if (!row) throw new UserError(409,'На это окно уже запланирован визит. Выберите другое время.');
  if (row.type !== body.type || row.note !== note || row.slot_id !== slotId) {
    throw new UserError(409,'Данные формы изменились. Откройте новую заявку.');
  }
  return json({request:requestView(row,slots,now)}, result.meta?.changes === 0 ? 200 : 201);
}
async function markRead(db, session, id) {
  const current = await state(db,session);
  const items = id === 'all' ? current.notices : current.notices.filter(item=>item.id === id);
  if (!items.length && id !== 'all') throw new UserError(404,'Уведомление не найдено.');
  const writes = items.filter(item=>!item.read).map(item=>
    db.prepare('INSERT OR IGNORE INTO mp_read(owner,notice_id) VALUES(?,?)').bind(session.owner,item.id));
  // Stay within the per-invocation statement limit, including long-lived demo accounts.
  for (let i=0;i<writes.length;i+=40) await db.batch(writes.slice(i,i+40));
  return json({ok:true});
}
export async function handleApi(request, env) {
  try {
    const path = new URL(request.url).pathname, db = env.DB;
    const method = request.method.toUpperCase();
    const passwordRequired = env.CAMPUS_PASSWORD_ONLY === '1';
    let data;
    if (method === 'POST') data = await bodyOf(request);
    if (path === '/api/register' && method === 'POST') return await register(request,db,data);
    if ((path === '/api/login' || path === '/api/demo') && method === 'POST') {
      if (passwordRequired && path === '/api/demo') {
        return json({error:'Войдите с логином и паролем.',passwordRequired}, 403);
      }
      return await startSession(request,db,data,path === '/api/demo');
    }
    const session = await getSession(request, db);
    if (!session) return json({error:'Войдите в кабинет, чтобы продолжить.',passwordRequired}, 401);
    if (path === '/api/state' && method === 'GET') return json(await state(db,session));
    if (path === '/api/requests' && method === 'POST') return await addRequest(db,session,data);
    if (path.startsWith('/api/requests/') && method === 'GET') {
      const row = await db.prepare('SELECT * FROM mp_requests WHERE owner=? AND id=?')
        .bind(session.owner,path.slice('/api/requests/'.length)).first();
      if (!row) throw new UserError(404,'Обращение не найдено.');
      return json({request:requestView(row,freeSlots(templates[session.profile_key].lessons),Date.now())});
    }
    if (path === '/api/notices/read' && method === 'POST') return await markRead(db,session,data.id);
    if (path === '/api/logout' && method === 'POST') {
      await db.prepare('UPDATE mp_sessions SET expires_at=0 WHERE token_hash=?').bind(session.token_hash).run();
      return json({ok:true},200,{'Set-Cookie':cookie(request,'',0)});
    }
    throw new UserError(404,'Страница не найдена.');
  } catch (error) {
    if (error instanceof UserError) return json({error:error.message},error.status);
    console.error('Student portal storage operation failed:',error.name,error.message);
    return json({error:'Не удалось получить данные. Попробуйте ещё раз.'}, 503);
  }
}
