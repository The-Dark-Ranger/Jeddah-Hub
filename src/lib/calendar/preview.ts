/* Calendar preview data: made-up events, initiatives and members so the
 * calendar's pages can be built and reviewed before it is connected to
 * Firestore and the invite emails. Nothing here is real, and nothing the
 * preview does is saved. Dates are relative to today so it never looks stale. */
import { addDays, fromKey, hubToday } from './occurrences';
import type { CalendarEvent } from './types';

export interface PreviewName { en: string; ar: string }

export const PREVIEW_INITIATIVES: Record<string, PreviewName> = {
  'preview-tech': { en: 'Tech J Shore', ar: 'تك جي شور' },
  'preview-collect': { en: 'Collect It!', ar: 'اجمعها!' },
  'preview-voices': { en: 'Voices Unbound', ar: 'أصوات بلا قيود' },
  'preview-edu': { en: 'EduIndustry', ar: 'إديو إندستري' },
  'preview-nasmat': { en: 'Nasmat Alamal', ar: 'نسمات الأمل' },
};

export const PREVIEW_TEAMS: Record<string, string[]> = {
  'preview-tech': ['me', 'sara', 'omar', 'reem'],
  'preview-collect': ['lina', 'faisal', 'noura', 'me'],
  'preview-voices': ['sara', 'yousef', 'dana'],
  'preview-edu': ['khalid', 'maha', 'hassan'],
  'preview-nasmat': ['noura', 'reem', 'omar'],
};

/** "me" stands for whoever is signed in. */
export const PREVIEW_PEOPLE: Record<string, PreviewName> = {
  me: { en: 'You', ar: 'أنت' },
  sara: { en: 'Sara A.', ar: 'سارة ع.' }, omar: { en: 'Omar B.', ar: 'عمر ب.' }, lina: { en: 'Lina H.', ar: 'لينا ح.' },
  faisal: { en: 'Faisal K.', ar: 'فيصل ك.' }, noura: { en: 'Noura M.', ar: 'نورة م.' }, yousef: { en: 'Yousef S.', ar: 'يوسف س.' },
  reem: { en: 'Reem T.', ar: 'ريم ت.' }, khalid: { en: 'Khalid R.', ar: 'خالد ر.' }, dana: { en: 'Dana Q.', ar: 'دانة ق.' },
  hassan: { en: 'Hassan F.', ar: 'حسن ف.' }, maha: { en: 'Maha Z.', ar: 'مها ز.' }, curator: { en: 'The Curator', ar: 'المنسق' },
};

const nextWeekday = (today: string, dow: number) => addDays(today, (dow - fromKey(today).getDay() + 7) % 7);

export function previewEvents(): CalendarEvent[] {
  const t = hubToday();
  const d = (n: number) => addDays(t, n);
  const tue = nextWeekday(t, 2), sat = nextWeekday(t, 6);
  return [
    {
      id: 'p1', kind: 'initiative', initiativeId: 'preview-tech', title: 'Tech J Shore: weekly sync', titleAr: 'تك جي شور: اجتماع أسبوعي',
      startDate: addDays(tue, -14), endDate: addDays(tue, -14), startTime: '20:00', endTime: '21:00', weekly: true,
      location: 'Online, Google Meet', locationAr: 'عبر الإنترنت، Google Meet', source: 'site', createdBy: 'me',
      people: [{ userId: 'me', role: 'team', reply: 'yes' }, { userId: 'sara', role: 'team', reply: 'yes' }, { userId: 'omar', role: 'team', reply: 'maybe' }, { userId: 'reem', role: 'team', reply: 'none' }],
    },
    {
      id: 'p2', kind: 'initiative', initiativeId: 'preview-collect', title: '[Collect It!] Cleanup prep call', titleAr: '[اجمعها!] مكالمة التحضير للتنظيف',
      startDate: d(1), endDate: d(1), startTime: '20:30', endTime: '21:15', location: 'Online', locationAr: 'عبر الإنترنت',
      source: 'invite', organizerName: 'Lina H.', organizerNameAr: 'لينا ح.',
      people: [{ userId: 'lina', role: 'team', reply: 'yes' }, { userId: 'faisal', role: 'guest', reply: 'none' }, { userId: 'noura', role: 'guest', reply: 'none' }, { userId: 'me', role: 'guest', reply: 'none' }],
    },
    {
      id: 'p3', kind: 'hub', title: 'Monthly general assembly', titleAr: 'الاجتماع العام الشهري', startDate: sat, endDate: sat, startTime: '19:00', endTime: '21:00',
      location: 'Hub office, Al Rawdah', locationAr: 'مكتب المركز، الروضة', notes: 'Initiative updates, budget, open floor.', notesAr: 'تحديثات المبادرات، الميزانية، نقاش مفتوح.',
      source: 'site', createdBy: 'curator',
      people: [
        { userId: 'curator', role: 'team', reply: 'yes' }, { userId: 'me', role: 'guest', reply: 'yes' }, { userId: 'sara', role: 'guest', reply: 'yes' },
        { userId: 'omar', role: 'guest', reply: 'maybe' }, { userId: 'lina', role: 'guest', reply: 'yes' }, { userId: 'faisal', role: 'guest', reply: 'no' },
        { userId: 'noura', role: 'guest', reply: 'yes' }, { userId: 'yousef', role: 'guest', reply: 'yes' }, { userId: 'reem', role: 'guest', reply: 'none' },
        { userId: 'khalid', role: 'guest', reply: 'yes' }, { userId: 'dana', role: 'guest', reply: 'none' }, { userId: 'hassan', role: 'guest', reply: 'maybe' },
      ],
    },
    {
      id: 'p4', kind: 'initiative', initiativeId: 'preview-voices', title: 'Voices Unbound: podcast recording', titleAr: 'أصوات بلا قيود: تسجيل البودكاست',
      startDate: sat, endDate: sat, startTime: '20:00', endTime: '22:00', location: 'Studio 9, Tahlia', locationAr: 'ستوديو ٩، التحلية', source: 'site', createdBy: 'sara',
      people: [{ userId: 'sara', role: 'team', reply: 'yes' }, { userId: 'yousef', role: 'team', reply: 'yes' }, { userId: 'dana', role: 'team', reply: 'maybe' }],
    },
    { id: 'p5', kind: 'deadline', title: 'Annual impact report due', titleAr: 'موعد تسليم تقرير الأثر السنوي', startDate: d(5), endDate: d(5), source: 'site', createdBy: 'curator', people: [] },
    {
      id: 'p6', kind: 'activity', title: 'Youth Climate Workshop', titleAr: 'ورشة المناخ للشباب', startDate: d(6), endDate: d(6), startTime: '17:00', endTime: '19:30',
      location: 'Jeddah Science Park', locationAr: 'حديقة جدة للعلوم', outsideGuests: 60, source: 'activity',
      people: [{ userId: 'khalid', role: 'team', reply: 'yes' }, { userId: 'maha', role: 'team', reply: 'yes' }, { userId: 'me', role: 'guest', reply: 'yes' }],
    },
    {
      id: 'p7', kind: 'external', title: 'Regional Shapers retreat', titleAr: 'ملتقى الصنّاع الإقليمي', startDate: d(8), endDate: d(10),
      location: 'AlUla', locationAr: 'العُلا', source: 'invite', organizerName: 'Global Shapers MENA', organizerNameAr: 'الصنّاع العالميون - الشرق الأوسط',
      people: [{ userId: 'me', role: 'guest', reply: 'none' }, { userId: 'sara', role: 'guest', reply: 'none' }, { userId: 'curator', role: 'guest', reply: 'none' }],
    },
    {
      id: 'p8', kind: 'initiative', initiativeId: 'preview-nasmat', title: 'Nasmat Alamal: care home visit', titleAr: 'نسمات الأمل: زيارة دار الرعاية',
      startDate: d(12), endDate: d(12), startTime: '10:00', endTime: '12:00', location: 'Al Safa care home', locationAr: 'دار رعاية الصفا', source: 'site', createdBy: 'noura',
      people: [{ userId: 'noura', role: 'team', reply: 'yes' }, { userId: 'reem', role: 'team', reply: 'yes' }, { userId: 'omar', role: 'team', reply: 'none' }],
    },
    {
      id: 'p9', kind: 'initiative', initiativeId: 'preview-edu', title: 'EduIndustry: partner meeting', titleAr: 'إديو إندستري: اجتماع الشركاء',
      startDate: d(-2), endDate: d(-2), startTime: '16:00', endTime: '17:00', location: 'Online', locationAr: 'عبر الإنترنت', source: 'site', createdBy: 'khalid',
      people: [{ userId: 'khalid', role: 'team', reply: 'yes' }, { userId: 'maha', role: 'team', reply: 'yes' }],
    },
  ];
}
