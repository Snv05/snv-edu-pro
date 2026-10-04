import React, { useMemo, useState } from 'react';
import { LessonMemo } from '../types';
import { BookOpen, ChevronDown, ChevronUp, Search, Printer } from 'lucide-react';

type Props = {
  lessons: LessonMemo[];
  onClose?: () => void;
};

const Field: React.FC<{label: string; value?: string}> = ({label, value}) => {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/90 p-3">
      <div className="text-[11px] font-black text-slate-500 mb-1">{label}</div>
      <div className="text-[13px] leading-7 whitespace-pre-wrap text-slate-900">{value}</div>
    </div>
  );
};

const TableBlock: React.FC<{table: any}> = ({table}) => (
  <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white my-3">
    <table className="w-full border-collapse text-[12px] text-right">
      <thead>
        <tr>
          {(table.headers || []).map((h: string, i: number) => (
            <th key={i} className="border border-slate-300 bg-slate-100 p-2 font-black">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(table.rows || []).map((row: any[], r: number) => (
          <tr key={r}>
            {row.map((cell: any, c: number) => (
              <td key={c} className="border border-slate-300 p-2 align-top whitespace-pre-wrap">{String(cell ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const Full1AMSourceViewer: React.FC<Props> = ({ lessons }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lessons;
    return lessons.filter(l => [
      l.memoNumber, l.midan, l.maqta, l.mawrid, l.ta3alom,
      l.markaba, l.marifa, l.manhaji, l.mostalahat, l.wasail,
      l.wadiya, l.moshkila, l.faradiyat, l.irsae, l.taqwim,
      ...(l.anshita || []).flatMap(a => [a.title, a.asila, a.ajwiba])
    ].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [lessons, query]);

  const printAll = () => {
    window.print();
  };

  return (
    <section dir="rtl" className="w-full min-h-full bg-slate-50 p-4 md:p-7">
      <div className="max-w-[1180px] mx-auto">
        <div className="no-print sticky top-0 z-20 mb-4 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-slate-950 font-black text-lg">
                <BookOpen className="w-5 h-5" />
                المصدر الكامل — مذكرات السنة الأولى متوسط
              </div>
              <p className="text-xs text-slate-500 mt-1">
                عرض المحتوى الموجود في قاعدة 1AM كما هو، مع جميع الحقول والأنشطة والجداول والرسومات المرتبطة، دون إنشاء قاعدة بديلة.
              </p>
            </div>
            <button type="button" onClick={printAll} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-3 py-2 text-xs font-black">
              <Printer className="w-4 h-4" /> طباعة المصدر الكامل
            </button>
          </div>
          <div className="mt-3 relative">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ابحث داخل الملف: مورد، نشاط، جدول، تقويم..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-950">
          <b>ملاحظة المصدر:</b> هذا العرض يجمع البيانات الأصلية الموجودة حالياً في قاعدة السنة الأولى متوسط. الجداول محفوظة كجداول حقيقية وليست نصاً، والرسومات المرتبطة بالمذكرات تبقى مرتبطة بمصدرها. لا تُحذف البيانات الحالية ولا تُستبدل بنسخة مبسطة.
        </div>

        <div className="space-y-3">
          {filtered.map((lesson, index) => {
            const isOpen = open === index || query.trim().length > 0;
            return (
              <article key={lesson.sourceLearningUnitId || index} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  className="w-full text-right p-4 flex items-center justify-between gap-3 hover:bg-slate-50"
                >
                  <div>
                    <div className="text-[11px] font-black text-slate-500">مذكرة {lesson.memoNumber || index + 1}</div>
                    <div className="font-black text-slate-950 mt-1">{lesson.ta3alom || lesson.mawrid}</div>
                    <div className="text-xs text-slate-500 mt-1">{lesson.midan} ← {lesson.maqta} ← {lesson.mawrid}</div>
                  </div>
                  {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                {isOpen && (
                  <div className="p-4 border-t border-slate-100 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="الميدان" value={lesson.midan} />
                      <Field label="المقطع التعلمي" value={lesson.maqta} />
                      <Field label="المورد التعلمي" value={lesson.mawrid} />
                      <Field label="تعلم المورد" value={lesson.ta3alom} />
                      <Field label="مركبة الكفاءة" value={lesson.markaba} />
                      <Field label="المورد المعرفي" value={lesson.marifa} />
                      <Field label="المورد المنهجي" value={lesson.manhaji} />
                      <Field label="المصطلحات" value={lesson.mostalahat} />
                      <Field label="الوسائل" value={lesson.wasail} />
                      <Field label="الوضعية الانطلاقية" value={lesson.wadiya} />
                      <Field label="المشكلة" value={lesson.moshkila} />
                      <Field label="الفرضيات" value={lesson.faradiyat} />
                    </div>

                    <Field label="إرساء المورد" value={lesson.irsae} />
                    {lesson.irsaeTables?.map((t: any, i: number) => <TableBlock key={'i'+i} table={t} />)}

                    <Field label="تقويم المورد" value={lesson.taqwim} />
                    {lesson.taqwimTables?.map((t: any, i: number) => <TableBlock key={'t'+i} table={t} />)}

                    <div className="pt-2">
                      <div className="font-black text-slate-800 mb-2">الأنشطة كاملة</div>
                      {(lesson.anshita || []).map((a: any, i: number) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-3">
                          <div className="font-black text-slate-900">{a.title}</div>
                          <Field label="عمل الأستاذ / سند النشاط" value={a.asila} />
                          <Field label="عمل المتعلم / الإجابة" value={a.ajwiba} />
                          {a.tables?.map((t: any, ti: number) => <TableBlock key={ti} table={t} />)}
                          {(a.diagrams || []).map((d: any, di: number) => (
                            <div key={di} className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-2 text-xs font-bold text-blue-900">
                              الرسم/السند: {d.diagram_title || d.title || 'رسم مرتبط بالنشاط'}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Full1AMSourceViewer;
