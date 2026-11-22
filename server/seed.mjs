// Fictional academic week. All student-specific fixtures are served after authentication.
export const demo = { date: '2026-11-23', time: '10:25' };
const days = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'];
export const requestTypes = [
  { id: 'enrollment', title: 'Справка об обучении', description: 'Подтверждение статуса студента и формы обучения.' },
  { id: 'transcript', title: 'Выписка об успеваемости', description: 'Выписка с результатами по завершённым дисциплинам.' },
  { id: 'question', title: 'Обращение в деканат', description: 'Вопрос об учёбе, документах или организации занятий.' }
];

const miraCourses = [
  ['Типографика', 'Практика', 'В-106', 'Таисия Громова'],
  ['История дизайна', 'Лекция', 'В-214', 'Семён Речной'],
  ['Проектная мастерская', 'Практика', 'А-307', 'Инга Берестова'],
  ['Цвет и композиция', 'Практика', 'В-118', 'Ольга Ладина'],
  ['Исследование аудитории', 'Семинар', 'А-209', 'Вадим Клёнов'],
  ['Цифровые медиа', 'Семинар', 'А-304', 'Ева Озёрная']
];
const levCourses = [
  ['Пространственный анализ', 'Практика', 'Г-211', 'Алиса Полынова'],
  ['Городская экономика', 'Лекция', 'Г-118', 'Платон Соснов'],
  ['Полевые методы', 'Семинар', 'А-225', 'Яна Ясенева'],
  ['Картография', 'Практика', 'Г-303', 'Варвара Тихова'],
  ['Транспортные системы', 'Лекция', 'Г-207', 'Леон Горин'],
  ['Мастерская исследований', 'Практика', 'А-305', 'Алиса Полынова']
];
function timetable(key, catalog, rows) {
  return rows.map(([day, course, start, end, oldRoom], index) => {
    const [title, type, room, teacher] = catalog[course];
    return { id: key + '-l' + index, date: days[day], start, end, title, type, room, teacher,
      change: oldRoom ? { oldRoom, text: 'Занятие перенесли из ' + oldRoom + ' в ' + room + '. Время прежнее.' } : null };
  });
}
function grade(title, score, assessment, result) {
  return { title, score, max: 100, assessment, result };
}
function exam(title, date, time, room, type) {
  return { title, date, time, room, type };
}
function notice(id, title, body, date, kind) {
  return { id, title, body, date, kind };
}
export const templates = {
  mira: {
    profile: { firstName: 'Мира', lastName: 'Ветрова', middleName: 'Алексеевна', initials: 'МВ',
      faculty: 'Факультет дизайна', program: 'Визуальные коммуникации', year: 2, group: 'ВК-24' },
    // PBKDF2-SHA256, 100000 iterations, independent 128-bit salts.
    auth: { salt: '116da6f7804382d3caf0bea4ade8d642', hash: '4231feed7e54776992d9642253330a710fdf2a9a7ce4938f4fb4733f319a7742' },
    lessons: timetable('m', miraCourses, [
      [0,0,'09:00','10:30'],[0,1,'11:00','12:30','В-201'],[0,2,'14:00','15:30'],
      [1,3,'09:00','10:30'],[1,4,'11:00','12:30'],[1,5,'13:00','14:30'],
      [2,0,'10:00','11:30'],[2,2,'13:00','14:30'],[2,5,'15:00','16:30'],
      [3,1,'09:00','10:30'],[3,3,'11:00','12:30'],[3,4,'14:00','15:30'],
      [4,5,'09:00','10:30'],[4,2,'12:00','13:30']
    ]),
    grades: [
      grade('Типографика', 92, 'Экзамен', 'Отлично'), grade('История дизайна', 84, 'Экзамен', 'Хорошо'),
      grade('Проектная мастерская', 95, 'Зачёт', 'Зачтено'), grade('Цвет и композиция', 88, 'Зачёт', 'Зачтено'),
      grade('Исследование аудитории', 76, 'Зачёт', 'В процессе'), grade('Цифровые медиа', 89, 'Зачёт', 'Зачтено')
    ],
    exams: [exam('Типографика','2026-12-17','10:00','В-106','Экзамен'), exam('История дизайна','2026-12-21','11:00','В-214','Экзамен')],
    notices: [
      notice('m-room','История дизайна в другой аудитории','Сегодня к 11:00 приходите в В-214. В расписании уже указан новый кабинет.','2026-11-23T09:10:00+03:00','change'),
      notice('m-deadline','Сдать полевой дневник','Загрузите дневник для семинара по исследованию аудитории до 26 ноября, 18:00.','2026-11-22T13:00:00+03:00','deadline'),
      notice('m-news','Просмотр студенческих плакатов','В пятницу, 27 ноября, в 15:00 в мастерской А-307 пройдёт открытый просмотр.','2026-11-20T14:00:00+03:00','news')
    ],
    seedRequest: { type: 'enrollment', preset: 'ready', date: '2026-11-20T10:15:00+03:00', note: 'Для студенческого проездного.' }
  },
  lev: {
    profile: { firstName: 'Лев', lastName: 'Северин', middleName: 'Ильич', initials: 'ЛС',
      faculty: 'Факультет городских исследований', program: 'Городская аналитика', year: 3, group: 'ГА-23' },
    auth: { salt: 'afbfb8896f3ac9d9c80c07ce528ba03f', hash: '930c965495ee19af39f0cc93b0daa9e2a41332eb62bba6b24eb2611986149643' },
    lessons: timetable('l', levCourses, [
      [0,0,'09:30','11:00'],[0,1,'13:00','14:30','Г-101'],[0,2,'15:00','16:30'],
      [1,3,'10:00','11:30'],[1,4,'13:00','14:30'],
      [2,0,'09:00','10:30'],[2,5,'11:00','12:30'],[2,2,'14:00','15:30'],
      [3,1,'09:30','11:00'],[3,4,'13:00','14:30'],
      [4,3,'10:00','11:30'],[4,5,'13:00','14:30']
    ]),
    grades: [
      grade('Пространственный анализ', 90, 'Экзамен', 'Отлично'), grade('Городская экономика', 79, 'Экзамен', 'Хорошо'),
      grade('Полевые методы', 86, 'Зачёт', 'Зачтено'), grade('Картография', 96, 'Зачёт', 'Зачтено'),
      grade('Транспортные системы', 68, 'Зачёт', 'В процессе'), grade('Мастерская исследований', 82, 'Зачёт', 'Зачтено')
    ],
    exams: [exam('Пространственный анализ','2026-12-16','09:30','Г-211','Экзамен'), exam('Городская экономика','2026-12-22','10:00','Г-118','Экзамен')],
    notices: [
      notice('l-room','Городская экономика переехала в Г-118','Сегодня лекция начнётся в 13:00 в Г-118 вместо Г-101.','2026-11-23T09:15:00+03:00','change'),
      notice('l-deadline','Загрузить карту маршрута','До 25 ноября, 20:00 добавьте черновик карты для практики по транспортным системам.','2026-11-22T12:15:00+03:00','deadline'),
      notice('l-news','Запись в полевую лабораторию','Группа ГА-23 встречается в четверг в 15:00 у кабинета А-225.','2026-11-20T11:00:00+03:00','news')
    ],
    seedRequest: { type: 'transcript', preset: 'processing', date: '2026-11-21T11:20:00+03:00', note: 'Для проектной мастерской.' }
  }
};

const minutes = (clock) => Number(clock.slice(0,2)) * 60 + Number(clock.slice(3,5));
const commonTitles = [
  'Академическое письмо', 'Иностранный язык', 'Проектный практикум',
  'Цифровые инструменты', 'Командная работа', 'Медиа и коммуникация'
];
const commonTitleByCourse = new Map(miraCourses.map(([title], index) => [title, commonTitles[index]]));
const commonCourse = (item) => ({ ...item, title: commonTitleByCourse.get(item.title) });
export const commonAcademics = {
  lessons: templates.mira.lessons.map(commonCourse),
  grades: templates.mira.grades.map(commonCourse),
  exams: templates.mira.exams.map(commonCourse),
  notices: [
    notice('common-room','Иностранный язык в другой аудитории','Сегодня к 11:00 приходите в В-214. В расписании уже указан новый кабинет.','2026-11-23T09:10:00+03:00','change'),
    notice('common-deadline','Сдать план проекта','Загрузите учебный план проекта до 26 ноября, 18:00.','2026-11-22T13:00:00+03:00','deadline'),
    notice('common-news','Открытая консультация','В пятницу, 27 ноября, в 15:00 в мастерской А-307 пройдёт консультация по учебным проектам.','2026-11-20T14:00:00+03:00','news')
  ]
};
const clock = (value) => String(Math.floor(value/60)).padStart(2,'0') + ':' + String(value%60).padStart(2,'0');
export function freeSlots(lessons) {
  const slots = [];
  for (const [i,date] of days.entries()) {
    const day = lessons.filter(item => item.date === date).sort((a,b) => a.start.localeCompare(b.start));
    const receptionStart = 11 * 60 + 15;
    const receptionEnd = (i === 4 ? 14 : 16) * 60;
    // A recommendation is between classes, with 15 minutes reserved for each walk.
    for (let j = 1; j < day.length; j++) {
      const gapStart = day[j-1].end, gapEnd = day[j].start;
      const from = Math.ceil(Math.max(receptionStart, minutes(gapStart)+15, date === demo.date ? minutes(demo.time) : 0)/15)*15;
      const until = Math.min(receptionEnd, minutes(gapEnd)-15);
      if (from + 15 > until) continue;
      const start = clock(from), end = clock(from+15);
      slots.push({ id: date+'_'+start, date, start, end, room: 'А-112', gapStart, gapEnd,
        reason: 'Между занятиями '+gapStart+'–'+gapEnd+'. Деканат открыт, на дорогу в каждую сторону есть 15 минут.' });
    }
  }
  return slots;
}
