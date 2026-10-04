import React, { useMemo, useState } from 'react';
import { Search, ChevronDown, ChevronUp, FileText, Table2, Image as ImageIcon } from 'lucide-react';
import { LessonMemo } from '../types';
import { SOURCE_MEMO_1AM } from '../data/sourceMemo1am';
import sourceText from '../data/sourceMemo1amFullText.md?raw';

interface Props { lessons: LessonMemo[]; }

export const SourceMemo1AMViewer: React.FC<Props> = ({ lessons }) => {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showRawSource, setShowRawSource] = useState(false);

  const records = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = lessons.filter(l => l.level === '1am');
    if (!q) return source;
    return source.filter(l => [
      l.midan, l.maqta, l.mawrid, l.ta3alom, l.marifa, l.manhaji,
      l.mostalahat, l.wasail, l.wadiya, l.moshkila, l.faradiyat,
      l.irsae, l.taqwim, ...l.anshita.flatMap(a => [a.title, a.asila, a.ajwiba])
    ].join('\n').toLowerCase().includes(q));
  }, [lessons, query]);

  const rawMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return sourceText.split(/\n{2,}/).filter(p => p.toLowerCase().includes(q)).slice(0, 80);
  }, [query]);

  const stats = useMemo(() => {
    const activities = records.flatMap(l => l.anshita);
    const tables = [
      ...records.flatMap(l => l.wadiyaTables || []),
      ...records.flatMap(l => l.irsaeTables || []),
      ...records.flatMap(l => l.taqwimTables || []),
      ...activities.flatMap(a => a.tables || [])
    ];
    const diagrams = records.flatMap(l => l.diagrams || []);
    return { lessons: records.length, activities: activities.length, tables: tables.length, diagrams: diagrams.length };
  }, [records]);

  return (
    <section dir="rtl" className="w-full min-h-full bg-slate-50 p-3 md:p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-4 md:p-5 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700"><FileText className="w-6 h-6" /></div>
              <div>
                <h1 className="text-lg md:text-xl font-black text-slate-900">المصدر الكامل — السنة الأولى متوسط</h1>
                <p className="text-xs md:text-sm text-slate-500 mt-1">{SOURCE_MEMO_1AM.fileName} · {SOURCE_MEMO_1AM.pages} صفحة · عرض قاعدة المصدر دون إعادة بناء البيانات</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-full bg-slate-100">الدروس: {stats.lessons}</span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800">الأنشطة: {stats.activities}</span>
              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800">الجداول: {stats.tables}</span>
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800">الرسومات: {stats.diagrams}</span>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث في قاعدة 1AM والنص الأصلي والجداول والأنشطة..." className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
          </div>
          <button type="button" onClick={() => setShowRawSource(v => !v)} className="mt-3 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black">
            {showRawSource ? 'إخفاء النص الأصلي' : 'عرض النص الأصلي المستخرج'}
          </button>
        </div>

        {showRawSource && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-4">
            <div className="font-black text-slate-900 mb-2">النص الأصلي المستخرج من الملف</div>
            <div className="max-h-[65vh] overflow-auto rounded-xl bg-slate-950 text-slate-100 p-4 text-xs leading-6 whitespace-pre-wrap font-mono" dir="rtl">
              {query && rawMatches.length ? rawMatches.join('\n\n────────────────────────\n\n') : sourceText}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {records.map((lesson, index) => {
            const id = lesson.sourceLearningUnitId || `1am-${index}`;
            const open = openId === id;
            const tables = [
              ...(lesson.wadiyaTables || []),
              ...(lesson.irsaeTables || []),
              ...(lesson.taqwimTables || []),
              ...lesson.anshita.flatMap(a => a.tables || [])
            ];
            return (
              <article key={id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <button type="button" onClick={() => setOpenId(open ? null : id)} className="w-full text-right p-4 hover:bg-slate-50 transition">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-slate-400">{open ? <ChevronUp /> : <ChevronDown />}</div>
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-1.5 mb-2 text-[11px] font-bold">
                        {lesson.midan && <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">{lesson.midan}</span>}
                        {lesson.maqta && <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800">{lesson.maqta}</span>}
                      </div>
                      <h2 className="font-black text-slate-900">{lesson.mawrid}</h2>
                      <p className="text-sm text-slate-600 mt-1">{lesson.ta3alom}</p>
                    </div>
                  </div>
                </button>
                {open && (
                  <div className="border-t bg-slate-50/60 p-4 space-y-4 text-sm leading-7">
                    {lesson.wadiya && <div><b>وضعية التعلم:</b><p className="whitespace-pre-wrap">{lesson.wadiya}</p></div>}
                    {lesson.moshkila && <div><b>المشكلة:</b><p className="whitespace-pre-wrap">{lesson.moshkila}</p></div>}
                    {lesson.irsae && <div><b>إرساء المورد:</b><p className="whitespace-pre-wrap">{lesson.irsae}</p></div>}
                    {lesson.taqwim && <div><b>تقويم المورد:</b><p className="whitespace-pre-wrap">{lesson.taqwim}</p></div>}
                    <div>
                      <h3 className="font-black mb-2">الأنشطة ({lesson.anshita.length})</h3>
                      <div className="space-y-3">
                        {lesson.anshita.map((a, i) => (
                          <div key={a.sourceActivityId || i} className="bg-white rounded-xl border p-3">
                            <div className="font-black">{a.title}</div>
                            {a.asila && <p className="whitespace-pre-wrap mt-1"><b>نشاط الأستاذ:</b> {a.asila}</p>}
                            {a.ajwiba && <p className="whitespace-pre-wrap mt-1"><b>نشاط المتعلم:</b> {a.ajwiba}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                    {tables.length > 0 && (
                      <div>
                        <h3 className="font-black mb-2 flex items-center gap-2"><Table2 className="w-4 h-4" /> الجداول ({tables.length})</h3>
                        <div className="space-y-4">
                          {tables.map((t, ti) => (
                            <div key={ti} className="overflow-x-auto bg-white rounded-xl border">
                              <table className="w-full text-xs border-collapse">
                                <thead><tr>{t.headers.map((h, hi) => <th key={hi} className="border p-2 bg-slate-100 text-right">{h}</th>)}</tr></thead>
                                <tbody>{t.rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="border p-2 whitespace-pre-wrap align-top">{cell}</td>)}</tr>)}</tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {lesson.diagrams?.length ? (
                      <div className="flex items-center gap-2 font-bold text-slate-600"><ImageIcon className="w-4 h-4" /> الرسومات المرتبطة: {lesson.diagrams.length}</div>
                    ) : null}
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
