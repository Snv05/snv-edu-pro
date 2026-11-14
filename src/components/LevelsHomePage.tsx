import React from 'react';
import {
  ArrowLeft,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Dna,
  GraduationCap,
  Leaf,
  Microscope,
  NotebookPen,
  Settings2,
  Sparkles,
  Sprout,
  Bot,
  TreePine,
  Mountain,
} from 'lucide-react';
import { MemoConfig } from '../types';
import card1amImg from '../assets/images/card_1am_plant_1790373274426.jpg';
import card2amImg from '../assets/images/card_2am_ecosystem_1790373285211.jpg';
import card3amImg from '../assets/images/card_3am_geology_1790373295369.jpg';
import card4amImg from '../assets/images/card_4am_human_1790373304110.jpg';
import designerPortraitImg from '../assets/images/designer_portrait_1790463396414.jpg';

interface LevelsHomePageProps {
  onSelectYear: (level: '1am' | '2am' | '3am' | '4am', subTab?: 'memos' | 'distribution') => void;
  onOpenLogbook: () => void;
  onOpenSettings: () => void;
  onOpenAssistant?: () => void;
  onOpenCorrectionMemo?: () => void;
  onOpenInfoModal?: (tab: 'about' | 'guide' | 'contact') => void;
  config: MemoConfig;
  curriculumBackground?: string;
}

const yearBooks = [
  {
    id: '1am' as const,
    label: 'السنة الأولى متوسط',
    short: '1AM',
    title: 'كتاب السنة الأولى متوسط',
    description: 'التغذية عند الإنسان والنبات الأخضر، والصحة والمحيط.',
    image: card1amImg,
    icon: <Sprout className="h-6 w-6" />,
    accent: '#0f9b82',
    soft: '#e7f8f2',
  },
  {
    id: '2am' as const,
    label: 'السنة الثانية متوسط',
    short: '2AM',
    title: 'كتاب السنة الثانية متوسط',
    description: 'الوسط الحي، التنوع الحيوي، التوزع والتكيف.',
    image: card2amImg,
    icon: <TreePine className="h-6 w-6" />,
    accent: '#b68a35',
    soft: '#fbf4df',
  },
  {
    id: '3am' as const,
    label: 'السنة الثالثة متوسط',
    short: '3AM',
    title: 'كتاب السنة الثالثة متوسط',
    description: 'الدينامية الداخلية والخارجية للأرض والظواهر الجيولوجية.',
    image: card3amImg,
    icon: <Mountain className="h-6 w-6" />,
    accent: '#3978bd',
    soft: '#eaf2ff',
  },
  {
    id: '4am' as const,
    label: 'السنة الرابعة متوسط',
    short: '4AM',
    title: 'كتاب السنة الرابعة متوسط',
    description: 'التنسيق الوظيفي، المناعة، التغذية والوراثة.',
    image: card4amImg,
    icon: <Dna className="h-6 w-6" />,
    accent: '#bd527c',
    soft: '#fff0f5',
  },
];

export const LevelsHomePage: React.FC<LevelsHomePageProps> = ({
  onSelectYear,
  onOpenLogbook,
  onOpenSettings,
  onOpenAssistant,
  onOpenCorrectionMemo,
  onOpenInfoModal,
  config,
  curriculumBackground,
}) => {
  return (
    <main
      dir="rtl"
      className="relative isolate min-h-[calc(100vh-76px)] overflow-hidden bg-[#f4f8f7] px-4 py-6 sm:px-6 lg:px-10"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-20 bg-cover bg-center opacity-[0.07]"
        style={{ backgroundImage: `url(${curriculumBackground || card1amImg})` }}
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute -right-28 top-16 -z-10 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 top-[28rem] -z-10 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />

      <div className="mx-auto max-w-7xl space-y-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-900/10 bg-gradient-to-l from-[#073b37] via-[#0b6259] to-[#123e57] text-white shadow-[0_24px_70px_rgba(9,68,63,.20)]">
          <div className="absolute inset-0 opacity-20" aria-hidden="true">
            <div className="absolute -left-10 -top-20 h-72 w-72 rounded-full border-[35px] border-white/20" />
            <div className="absolute bottom-[-7rem] right-[36%] h-72 w-72 rounded-full border-[28px] border-emerald-200/20" />
            <Dna className="absolute left-[8%] top-[14%] h-28 w-28 rotate-12 text-emerald-100" />
            <Leaf className="absolute bottom-[10%] left-[34%] h-16 w-16 -rotate-12 text-emerald-100" />
          </div>

          <div className="relative grid items-center gap-7 px-6 py-8 sm:px-9 md:grid-cols-[minmax(0,1fr)_260px] md:py-10 lg:px-12">
            <div className="order-2 space-y-5 text-right md:order-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-emerald-100 backdrop-blur">
                <Sparkles className="h-4 w-4 text-amber-300" />
                فضاء رقمي متخصص للأستاذ
              </div>
              <div>
                <p className="mb-2 text-sm font-bold tracking-wide text-emerald-200">التعليم المتوسط • الجزائر</p>
                <h1 className="text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                  علوم الطبيعة <span className="text-emerald-300">والحياة</span>
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-8 text-emerald-50/90 sm:text-base">
                  منصتك المتكاملة لتحضير الدروس، تنظيم التعلمات، بناء التقويمات ومتابعة العمل اليومي،
                  وفق المنهاج والوثائق البيداغوجية المعتمدة.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => document.getElementById('year-books')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-emerald-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-200"
                >
                  <BookOpen className="h-4 w-4" />
                  تصفح كتب السنوات
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onOpenAssistant}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20"
                >
                  <Bot className="h-4 w-4" />
                  المساعد التربوي
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/15 pt-4 text-xs font-semibold text-emerald-100/90">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> محتوى مرتبط بالمنهاج</span>
                <span className="inline-flex items-center gap-2"><Microscope className="h-4 w-4 text-emerald-300" /> موارد علمية وبيداغوجية</span>
                <span className="inline-flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-emerald-300" /> أدوات الأستاذ في مكان واحد</span>
              </div>
            </div>

            <div className="order-1 mx-auto w-full max-w-[230px] md:order-2 md:max-w-none">
              <div className="relative mx-auto aspect-[4/5] max-h-[290px] overflow-hidden rounded-[1.7rem] border-[5px] border-white/25 bg-white/10 shadow-2xl ring-1 ring-white/20">
                <img
                  src={designerPortraitImg}
                  alt="الأستاذ بغداد الطيب"
                  className="h-full w-full object-cover object-center"
                  loading="eager"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#062f2d]/95 via-[#062f2d]/55 to-transparent px-4 pb-4 pt-12 text-right">
                  <p className="text-[10px] font-bold text-emerald-200">تصميم وتطوير المنصة</p>
                  <p className="mt-1 text-base font-black text-white">الأستاذ بغداد الطيب</p>
                </div>
              </div>
              <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-emerald-50">
                <GraduationCap className="h-4 w-4 text-amber-300" />
                منهاج الجيل الثاني
              </div>
            </div>
          </div>
        </section>

        {/* Main tools */}
        <section aria-labelledby="main-tools-title" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black text-emerald-700">مساحة العمل</p>
              <h2 id="main-tools-title" className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">أقسام المنصة</h2>
              <p className="mt-1 text-sm text-slate-500">اختر الأداة التي تريد العمل بها مباشرة.</p>
            </div>
            <span className="rounded-full border border-emerald-100 bg-white/80 px-3 py-1.5 text-xs font-bold text-emerald-800">علوم الطبيعة والحياة</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <button
              type="button"
              onClick={onOpenAssistant}
              className="group relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-[#0d7669] to-[#064e49] p-5 text-right text-white shadow-lg transition duration-200 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="absolute -left-5 -top-7 h-28 w-28 rounded-full bg-white/10 transition group-hover:scale-125" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="rounded-2xl bg-white/15 p-3"><Bot className="h-7 w-7 text-emerald-100" /></div>
                <ArrowLeft className="mt-2 h-5 w-5 text-emerald-100 transition group-hover:-translate-x-1" />
              </div>
              <h3 className="relative mt-5 text-xl font-black">المساعد التربوي الذكي</h3>
              <p className="relative mt-2 text-sm leading-7 text-emerald-50/90">مساعدة في بناء الوضعيات والأنشطة والتجارب والتقويمات وتحضير الدروس.</p>
            </button>

            <button
              type="button"
              onClick={onOpenCorrectionMemo}
              className="group rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 text-right shadow-sm transition duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-2xl bg-violet-100 p-3 text-violet-700"><ClipboardCheck className="h-7 w-7" /></div>
                <ArrowLeft className="mt-2 h-5 w-5 text-violet-500 transition group-hover:-translate-x-1" />
              </div>
              <h3 className="mt-5 text-xl font-black text-slate-900">المذكرة التصحيحية</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">إعداد مذكرة تصحيح الفروض والاختبارات وتنظيم الإجابات ومعايير التقييم.</p>
              <span className="mt-4 inline-flex items-center gap-2 text-xs font-black text-violet-700">فتح قسم التصحيح <ArrowLeft className="h-4 w-4" /></span>
            </button>

            <button
              type="button"
              onClick={onOpenLogbook}
              className="group rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 text-right shadow-sm transition duration-200 hover:-translate-y-1 hover:border-sky-300 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-2xl bg-sky-100 p-3 text-sky-700"><NotebookPen className="h-7 w-7" /></div>
                <ArrowLeft className="mt-2 h-5 w-5 text-sky-500 transition group-hover:-translate-x-1" />
              </div>
              <h3 className="mt-5 text-xl font-black text-slate-900">الدفتر اليومي</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">تنظيم الحصص والتعلمات وتوثيق الأنشطة اليومية للأقسام المسندة.</p>
              <span className="mt-4 inline-flex items-center gap-2 text-xs font-black text-sky-700">فتح الدفتر اليومي <ArrowLeft className="h-4 w-4" /></span>
            </button>
          </div>
        </section>

        {/* Four year books */}
        <section id="year-books" aria-labelledby="year-books-title" className="scroll-mt-24 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <p className="text-xs font-black text-emerald-700">المكتبة التعليمية</p>
              <h2 id="year-books-title" className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">كتب السنوات الأربع</h2>
              <p className="mt-1 text-sm text-slate-500">اختر السنة لفتح مذكراتها وتدرج التعلمات الخاص بها.</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">
              <BookOpen className="h-4 w-4 text-emerald-700" />
              التعليم المتوسط
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {yearBooks.map((year) => (
              <article
                key={year.id}
                className="group overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative h-40 overflow-hidden">
                  <img src={year.image} alt={year.label} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent" />
                  <div className="absolute right-4 top-4 rounded-xl border border-white/30 bg-white/90 px-3 py-1 text-xs font-black text-slate-800 shadow-sm">{year.short}</div>
                  <div className="absolute bottom-4 right-4 left-4 flex items-end justify-between gap-2 text-white">
                    <h3 className="text-lg font-black">{year.label}</h3>
                    <span className="rounded-xl bg-white/15 p-2 backdrop-blur">{year.icon}</span>
                  </div>
                </div>
                <div className="space-y-4 p-4">
                  <div>
                    <p className="text-[11px] font-black" style={{ color: year.accent }}>كتاب المستوى</p>
                    <h4 className="mt-1 text-base font-black text-slate-900">{year.title}</h4>
                    <p className="mt-2 min-h-[3.5rem] text-xs leading-6 text-slate-500">{year.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectYear(year.id, 'memos')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-black text-white transition hover:brightness-95"
                      style={{ backgroundColor: year.accent }}
                    >
                      <BookOpenCheck className="h-4 w-4" />
                      المذكرات
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectYear(year.id, 'distribution')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-black transition hover:bg-slate-50"
                      style={{ color: year.accent, borderColor: year.accent + '55', backgroundColor: year.soft }}
                    >
                      <CalendarDays className="h-4 w-4" />
                      التدرج السنوي
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Footer / platform information */}
        <footer className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/85 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="text-right">
            <p className="text-sm font-black text-slate-800">منصة علوم الطبيعة والحياة</p>
            <p className="mt-1 text-xs text-slate-500">فضاء عمل بيداغوجي لأساتذة التعليم المتوسط في الجزائر.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onOpenInfoModal?.('about')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50">حول المنصة</button>
            <button type="button" onClick={() => onOpenInfoModal?.('guide')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50">دليل الاستخدام</button>
            <button type="button" onClick={onOpenSettings} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-700"><Settings2 className="h-3.5 w-3.5" /> إعدادات الأستاذ</button>
          </div>
        </footer>
      </div>
    </main>
  );
};
