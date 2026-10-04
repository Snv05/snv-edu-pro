import React, { useEffect, useRef, useState } from 'react';
import { 
  X, 
  Sparkles, 
  Printer, 
  Copy, 
  Check, 
  FileText, 
  FlaskConical, 
  Languages, 
  Award, 
  Users, 
  BookOpen,
  Loader2,
  RefreshCw,
  Clock,
  Layers,
  FileCheck2,
  Paperclip,
  Image as ImageIcon,
  FileUp,
  Trash2,
  RotateCcw,
  XCircle,
  Search,
  ShieldCheck,
  AlertTriangle,
  BrainCircuit
} from 'lucide-react';
import { PedagogicalNote, GradeLevel } from '../types/pedagogicalNote';
import { generatePedagogicalNote } from '../services/geminiPedagogicalService';
import { buildMemoSuggestionReport, MemoSuggestion } from '../services/memoSuggestionEngine';
import { recordSuggestionDecision } from '../services/memoLearningStore';
import { sourcePriorityOf } from '../services/aiSourcePriority';
import { MemoConfig } from '../types';
import { TeacherOfficialStamp } from './TeacherOfficialStamp';
import { getScienceMemoModels, getMemoModelStatusLabel, ScienceMemoModel } from '../services/scienceMemoModelLibrary';
import { ExpertLabBlock, consumePendingExpertLabBlock, subscribeExpertLab } from '../services/expertLabStore';
import { OFFICIAL_1AM_DISTRIBUTION, OFFICIAL_2AM_DISTRIBUTION, OFFICIAL_3AM_DISTRIBUTION, OFFICIAL_4AM_DISTRIBUTION } from '../data/officialAnnualDistributionData';
import { loadCurriculumDatabase } from '../data/curriculumDb';
import { buildOfficialSourceContext } from '../services/officialPedagogicalSources';
import sourceMemo1AMFullText from '../data/sourceMemo1amFullText.md?raw';
import {
  MemoAttachment,
  fileToMemoAttachment,
  listMemoAttachments,
  saveMemoAttachment,
  deleteMemoAttachment,
  listMemoSourceDocuments,
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
} from '../services/memoAttachmentStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultLevel?: '1am' | '2am' | '3am' | '4am';
  defaultTopic?: string;
  config: MemoConfig;
  showToast: (msg: string) => void;
}

export const PedagogicalNoteModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultLevel = '4am',
  defaultTopic = '',
  config,
  showToast,
}) => {
  const mapLevelToGrade = (lvl: string): GradeLevel => {
    if (lvl === '1am') return '1AM';
    if (lvl === '2am') return '2AM';
    if (lvl === '3am') return '3AM';
    return '4AM';
  };

  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(() => mapLevelToGrade(defaultLevel));
  const [topic, setTopic] = useState<string>(defaultTopic || 'الهضم في الأنبوب الهضمي ومسارات الامتصاص');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [note, setNote] = useState<PedagogicalNote | null>(null);
  const [activeTab, setActiveTab] = useState<'note' | 'worksheet' | 'json'>('note');
  const [copied, setCopied] = useState<boolean>(false);
  const [attachments, setAttachments] = useState<MemoAttachment[]>([]);
  const [savedAttachments, setSavedAttachments] = useState<MemoAttachment[]>([]);
  const [sourceLibrary, setSourceLibrary] = useState<MemoAttachment[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [useWebResearch, setUseWebResearch] = useState(true);
  const [labBlock, setLabBlock] = useState<ExpertLabBlock | null>(null);
  const [showModelLibrary, setShowModelLibrary] = useState(false);
  const [modelQuery, setModelQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState<ScienceMemoModel | null>(null);
  const [aiProviderStatus, setAiProviderStatus] = useState<{primary:string|null;available:string[];freeFirst:boolean}|null>(null);
  const [showAiCenter, setShowAiCenter] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [suggestionReport, setSuggestionReport] = useState<ReturnType<typeof buildMemoSuggestionReport> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/ai/providers').then(r=>r.ok?r.json():null).then(data=>data&&setAiProviderStatus(data)).catch(()=>null);
    const pending = consumePendingExpertLabBlock();
    if (pending) setLabBlock(pending);
    const unsubscribe = subscribeExpertLab(block => { if (block) setLabBlock(block); });
    Promise.all([listMemoAttachments(), listMemoSourceDocuments()])
      .then(([attachments, sources]) => {
        setSavedAttachments(attachments);
        setSourceLibrary(sources);
        const preferred = sources.filter((item) => /منهاج|منهج|curriculum|programme|مرافق|مرافقة|companion|accompagn/i.test(String(item.name || ''))).slice(0, 2);
        if (preferred.length) setSelectedSourceIds(preferred.map(item => item.id));
      })
      .catch((error) => console.error('[memo-attachments]', error));
    return unsubscribe;
  }, [isOpen]);

  const addFiles = async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    for (const file of incoming) {
      try {
        const attachment = await fileToMemoAttachment(file);
        setAttachments((prev) => {
          const nextTotal = prev.reduce((sum, item) => sum + item.size, 0) + attachment.size;
          if (nextTotal > MAX_TOTAL_ATTACHMENT_BYTES) {
            showToast('إجمالي المرفقات يتجاوز 10MB.');
            return prev;
          }
          if (prev.some((item) => item.name === attachment.name && item.size === attachment.size)) {
            showToast('هذا المرفق موجود بالفعل.');
            return prev;
          }
          return [...prev, attachment].slice(0, 6);
        });
        await saveMemoAttachment(attachment);
        setSavedAttachments(await listMemoAttachments());
      } catch (error: any) {
        showToast(error?.message || 'تعذر إضافة المرفق.');
      }
    }
  };

  const restoreSaved = async () => {
    try {
      const saved = await listMemoAttachments();
      setSavedAttachments(saved);
      setAttachments(saved.slice(0, 6));
      showToast(saved.length ? `تم استرداد ${Math.min(saved.length, 6)} مرفقات محفوظة.` : 'لا توجد مرفقات محفوظة للاسترداد.');
    } catch {
      showToast('تعذر استرداد المرفقات المحفوظة.');
    }
  };

  const removeAttachment = async (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const permanentlyDeleteSaved = async (id: string) => {
    await deleteMemoAttachment(id);
    setSavedAttachments((prev) => prev.filter((item) => item.id !== id));
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const imageItem = (Array.from(event.clipboardData.items) as DataTransferItem[]).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    event.preventDefault();
    const blob = imageItem.getAsFile();
    if (blob) {
      const pasted = new File([blob], `صورة-ملصقة-${Date.now()}.png`, { type: blob.type || 'image/png' });
      await addFiles([pasted]);
      showToast('تم لصق الصورة وإضافتها إلى مصادر المذكرة.');
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    await addFiles(event.dataTransfer.files);
  };

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!topic.trim()) {
      showToast('يرجى كتابة عنوان المورد أو الحصة أولاً');
      return;
    }

    setIsLoading(true);
    try {
      const distributions: Record<GradeLevel, any[]> = {
        '1AM': OFFICIAL_1AM_DISTRIBUTION,
        '2AM': OFFICIAL_2AM_DISTRIBUTION,
        '3AM': OFFICIAL_3AM_DISTRIBUTION,
        '4AM': OFFICIAL_4AM_DISTRIBUTION,
      };
      const norm = (v: unknown) => String(v || '').toLowerCase().replace(/[\\u064B-\\u065F\\u0670]/g, '').replace(/\\s+/g, ' ').trim();
      const q = norm(topic);
      const progression = (distributions[selectedGrade] || []).filter((row: any) => {
        const text = [row.midan, row.maqta, row.mawrid, row.session1, row.session2].map(norm).join(' ');
        return q && (text.includes(q) || q.includes(norm(row.mawrid)));
      }).slice(0, 12).map((row: any) => ({
        id: row.id, week: row.week, month: row.month, dates: row.dates,
        midan: row.midan, maqta: row.maqta, mawrid: row.mawrid,
        session1: row.session1, session2: row.session2,
        isHoliday: row.isHoliday, isExam: row.isExam,
      }));
      const curriculum = loadCurriculumDatabase();
      const memo = curriculum.filter((item: any) => {
        if (item.level && String(item.level).toUpperCase() !== selectedGrade) return false;
        const text = [item.midan, item.maqta, item.mawrid, item.ta3alom, item.learningResource, item.lessonTitle, item.title].map(norm).join(' ');
        return q && (text.includes(q) || q.includes(norm(item.mawrid)) || q.includes(norm(item.learningResource)));
      }).slice(0, 12).map((item: any) => ({
        id: item.id || item.sourceSequenceId || item.sourceResourceId,
        level: item.level, midan: item.midan, maqta: item.maqta,
        mawrid: item.mawrid || item.learningResource,
        ta3alom: item.ta3alom || item.learningUnit,
        lessonTitle: item.lessonTitle || item.title,
        taqwim: item.taqwim,
        sourceType: item.sourceOfficial ? 'curriculum' : 'memo',
        sourceLabel: item.sourceOfficial ? 'المنهاج/المورد الرسمي' : 'قاعدة المذكرات/المورد',
        activityTitles: Array.isArray(item.anshita) ? item.anshita.map((a: any) => a.title).filter(Boolean).slice(0, 8) : [],
        activitySources: Array.isArray(item.anshita) ? item.anshita.map((a: any) => ({
          id: a.sourceActivityId || a.id || '',
          title: a.title || '',
        })).filter((a: any) => a.title).slice(0, 8) : [],
      }));
      const selectedLibrarySources = sourceLibrary.filter(item => selectedSourceIds.includes(item.id));
      const allGenerationAttachments = [...attachments, ...selectedLibrarySources].slice(0, 10);
      const generated = await generatePedagogicalNote(
        selectedGrade,
        topic.trim(),
        allGenerationAttachments.map(({ name, mimeType, size, dataUrl }) => ({ name, mimeType, size, dataUrl })),
        useWebResearch,
        selectedModel?.sections || [],
        {
          sourceMemoExcerpts: selectedGrade === '1AM' ? (() => {
            const queryParts = [topic.trim(), ...progression.slice(0, 4).flatMap((row: any) => [row.mawrid, row.maqta, row.ta3alom].filter(Boolean))]
              .map(norm).filter(Boolean);
            const paragraphs = sourceMemo1AMFullText.split(/\\n\\s*\\n/).filter(Boolean);
            const matches = paragraphs.filter((p) => queryParts.some((q) => norm(p).includes(q)));
            return matches.slice(0, 12).join('\\n\\n--- مقتطف مصدر ---\\n\\n').slice(0, 24000);
          })() : '',
          progression,
          memo,
          library: selectedModel ? [{
            id: selectedModel.id,
            title: selectedModel.title,
            status: selectedModel.status,
            sections: selectedModel.sections,
          }] : [],
          sourceDocuments: allGenerationAttachments.map((item) => {
            const category = item.category;
            const type = category === 'curriculum' ? 'curriculum' : category === 'companion' ? 'companionDocument' : category === 'teacher-guide' ? 'teacherGuide' : category === 'memo' ? 'memo' : 'attachment';
            return { id: item.id, name: item.name, mimeType: item.mimeType, type, priority: sourcePriorityOf(type) };
          }),
          officialSources: buildOfficialSourceContext(),
          sourcePolicy: {
            order: ['curriculum', 'progression', 'companionDocument', 'teacherGuide', 'memo', 'attachment', 'web', 'library', 'ai'],
            rules: [
              'المنهاج والتدرج أولاً للحقول الرسمية والتسلسل.',
              'الوثيقة المرافقة ودليل الأستاذ لتفسير المنهجية والأنشطة والتجارب عند توفرهما.',
              'المذكرات لاستخراج عناوين النشاطين والتقويم دون اختلاق أو إعادة صياغة.',
              'الويب تكميلي فقط ولا يغيّر معلومة رسمية مثبتة.',
              'أي اقتراح غير موثق يوسم: اقتراح AI — يحتاج مراجعة الأستاذ.',
            ],
          },
        }
      );
      setNote(generated);
      const report = buildMemoSuggestionReport(selectedGrade, topic.trim(), generated, {
        progression,
        memo,
        sourceDocuments: allGenerationAttachments,
      });
      setSuggestionReport(report);
      const suggestions: string[] = [];
      if (!generated.sourceActivities?.title1 && !generated.sourceActivities?.title2 && !generated.sourceActivities?.assessment) suggestions.push('لم يتم العثور على عناوين أنشطة موثقة في المصادر المختارة؛ راجع المذكرات أو دليل الأستاذ قبل إضافة نشاط.');
      if (!generated.researchSources?.length && useWebResearch) suggestions.push('لم تُثبت مصادر ويب في هذه النتيجة؛ لا تضف مرجعاً خارجياً إلا بعد التحقق منه.');
      if ((generated.sourceTrace || []).some((x: any) => x.sourceType === 'ai')) suggestions.push('توجد عناصر موسومة باقتراح AI — تحتاج مراجعة الأستاذ.');
      setAiSuggestions(suggestions);
      showToast(report.suggestions.length ? 'تم التوليد مع اقتراحات تحقق تحتاج مراجعة الأستاذ.' : 'تم توليد المذكرة البيداغوجية الرسمية بنجاح 🌟');
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'تعذر توليد المذكرة، يرجى المحاولة ثانية');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (!note) return;
    navigator.clipboard.writeText(JSON.stringify(note, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('تم نسخ كود JSON الرسمي للمذكرة');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      dir="rtl"
      onPaste={handlePaste}
      onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-5xl my-4 flex flex-col max-h-[94vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#0d544c] via-[#106b61] to-[#0d544c] text-white p-4 sm:p-5 flex items-center justify-between shadow-xs print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-amber-300 backdrop-blur-md">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-wide flex items-center gap-2">
                <span>توليد مذكرة بيداغوجية رسمية بالذكاء الاصطناعي</span>
                <span className="text-[11px] bg-amber-400 text-amber-950 font-black px-2 py-0.5 rounded-full">
                  منهاج الجيل الثاني
                </span>
              </h3>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">
                توليد مذكرة وزارية متكاملة (الثلاثية، المراحل الأربع، بطاقة العمل الفوجي، شبكة BEM، والكواشف)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bg-indigo-50/60 border-b border-indigo-100 p-3 print:hidden">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-black text-indigo-900">المصادر المرجعية المعتمدة</div>
              <div className="text-[10px] text-slate-500">اختر المصادر المحفوظة التي يجب أن يعتمد عليها التوليد.</div>
            </div>
            <button type="button" onClick={async()=>setSourceLibrary(await listMemoSourceDocuments())} className="text-[10px] font-black text-indigo-700">تحديث</button>
          </div>
          {sourceLibrary.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5 mt-2">
            {sourceLibrary.slice(0,15).map(item => <label key={item.id} className="flex items-center gap-2 bg-white border rounded-lg p-2 text-[10px] cursor-pointer">
              <input type="checkbox" checked={selectedSourceIds.includes(item.id)} onChange={e=>setSelectedSourceIds(prev=>e.target.checked ? [...prev,item.id] : prev.filter(id=>id!==item.id))}/>
              <span className="truncate flex-1 font-bold">{item.name}</span>
              <span className="text-indigo-700">{item.category==='curriculum'?'منهاج':item.category==='companion'?'وثيقة مرافقة':item.category==='teacher-guide'?'دليل أستاذ':'مذكرة'}</span>
            </label>)}
          </div> : <div className="mt-2 text-[10px] text-slate-500">لم تُضف مصادر إلى المكتبة بعد. يمكن رفعها من مكتبة المصادر داخل مذكرة التصحيح.</div>}
        </div>

        <div className="bg-slate-50 border-b border-slate-200 p-3 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={()=>setShowAiCenter(v=>!v)} className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-black text-slate-800">
              <BrainCircuit size={16}/> مركز الذكاء الاصطناعي
            </button>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <span className="flex items-center gap-1"><ShieldCheck size={13}/> المزود: {aiProviderStatus?.primary || 'غير محدد'}</span>
              <span className="text-slate-500">المتاح: {(aiProviderStatus?.available || []).join('، ') || '—'}</span>
            </div>
          </div>
          {showAiCenter && <div className="mt-3 space-y-2">
            <div className="grid md:grid-cols-3 gap-2">
              <div className="bg-white rounded-xl border p-3">
                <div className="font-black text-xs mb-1">حالة المصادر</div>
                <div className="text-[10px] text-slate-600">المنهاج/التدرج ← الوثيقة المرافقة ← دليل الأستاذ ← المذكرات ← الويب ← AI.</div>
              </div>
              <div className="bg-white rounded-xl border p-3">
                <div className="font-black text-xs mb-1">اقتراحات التطوير</div>
                {aiSuggestions.length ? aiSuggestions.map((s,i)=><div key={i} className="text-[10px] text-amber-800 flex gap-1 mt-1"><AlertTriangle size={12}/><span>{s}</span></div>) : <div className="text-[10px] text-emerald-700">لا توجد تنبيهات حالياً.</div>}
              </div>
              <div className="bg-white rounded-xl border p-3">
                <div className="font-black text-xs mb-1">وضع التحقق</div>
                <div className="text-[10px] text-slate-600">{suggestionReport?.verificationStatus === 'verified' ? 'المصادر متوافقة في البيانات المتاحة.' : 'توجد عناصر تحتاج مراجعة؛ لا يتم تعديل البيانات الرسمية تلقائياً.'}</div>
              </div>
            </div>
            {suggestionReport?.suggestions.length ? <div className="bg-white rounded-xl border p-3 space-y-2">
              <div className="font-black text-xs">مقترحات قابلة للتعلم من قرار الأستاذ</div>
              {suggestionReport.suggestions.map((item: MemoSuggestion) => <div key={item.id} className="border rounded-lg p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><div className="text-[10px] font-black text-slate-900">{item.title}</div><div className="text-[10px] text-slate-600">{item.description}</div></div>
                  <span className="text-[9px] bg-slate-100 rounded px-1.5 py-0.5">{item.sourceLabel}</span>
                </div>
                <div className="text-[9px] text-slate-500 mt-1">لماذا؟ {item.reason}</div>
                <div className="flex gap-1 mt-2">
                  <button type="button" onClick={async()=>{await recordSuggestionDecision({suggestionId:item.id,category:item.category,decision:'accepted',gradeLevel:selectedGrade,topic:topic.trim(),sourceType:item.sourceType});showToast('تم تسجيل اعتماد الاقتراح؛ لم يتم تعديل المصدر الرسمي تلقائياً.');}} className="px-2 py-1 rounded bg-emerald-700 text-white text-[9px] font-black">اعتماد</button>
                  <button type="button" onClick={async()=>{await recordSuggestionDecision({suggestionId:item.id,category:item.category,decision:'rejected',gradeLevel:selectedGrade,topic:topic.trim(),sourceType:item.sourceType});showToast('تم تسجيل رفض الاقتراح للتعلم المستقبلي.');}} className="px-2 py-1 rounded bg-white border text-slate-700 text-[9px] font-black">رفض</button>
                  <button type="button" onClick={async()=>{const edited=window.prompt('اكتب التعديل المقترح:',item.description);if(edited!==null){await recordSuggestionDecision({suggestionId:item.id,category:item.category,decision:'edited',gradeLevel:selectedGrade,topic:topic.trim(),sourceType:item.sourceType,editedText:edited});showToast('تم تسجيل تعديلك كتعلم للمقترحات القادمة.');}}} className="px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-black">تعديل</button>
                </div>
              </div>)}
            </div> : null}
          </div>}
        </div>

        {/* Generator Controls Bar */}
        <div className="bg-emerald-50/50 border-b border-emerald-100 p-4 space-y-3 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-3 space-y-1">
              <label className="text-xs font-bold text-gray-700 block">المستوى الدراسي:</label>
              <div className="grid grid-cols-4 gap-1">
                {(['1AM', '2AM', '3AM', '4AM'] as GradeLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedGrade(lvl)}
                    className={`py-1.5 text-xs font-black rounded-lg transition cursor-pointer border ${
                      selectedGrade === lvl
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
                        : 'bg-white hover:bg-emerald-100 text-emerald-950 border-emerald-200'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-6 space-y-1">
              <label className="text-xs font-bold text-gray-700 block">المورد التعلمي / عنوان الحصة:</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="مثال: تحولات الأغذية في الأنبوب الهضمي، أو استراتيجيات التكاثر، أو البراكين"
                className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 focus:border-emerald-600 outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-xs font-black rounded-xl hover:from-emerald-700 hover:to-teal-800 shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>جاري التوليد...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} className="text-amber-300" />
                    <span>توليد المذكرة الآن</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 print:hidden">
            <div className="flex items-center justify-between gap-2">
              <div><div className="text-xs font-black text-blue-950">مكتبة نماذج مذكرات علوم الطبيعة والحياة</div><div className="text-[10px] text-blue-800">نماذج استرشادية منفصلة عن المصادر الرسمية.</div></div>
              <button type="button" onClick={() => setShowModelLibrary(v => !v)} className="px-2.5 py-1 rounded-lg bg-blue-700 text-white text-[10px] font-black">فتح المكتبة</button>
            </div>
            {showModelLibrary && <div className="mt-3 space-y-2"><div className="relative"><Search size={13} className="absolute right-2 top-2.5 text-gray-400"/><input value={modelQuery} onChange={e => setModelQuery(e.target.value)} placeholder="ابحث عن نموذج..." className="w-full border border-blue-200 rounded-lg py-2 pr-7 pl-2 text-[11px] outline-none"/></div><div className="max-h-48 overflow-y-auto space-y-1.5">{getScienceMemoModels(selectedGrade).filter((m: ScienceMemoModel) => !modelQuery || (m.title + m.sections.join(' ')).includes(modelQuery)).map((m: ScienceMemoModel) => <button key={m.id} type="button" onClick={() => { setSelectedModel(m); setTopic(m.title); setShowModelLibrary(false); showToast('تم اختيار النموذج الاسترشادي. أدخل المورد الفعلي من التدرج قبل التوليد.'); }} className="w-full text-right p-2 rounded-lg bg-white border border-blue-100 hover:border-blue-300"><div className="text-[10px] font-black text-gray-800">{m.title}</div><div className="text-[9px] text-blue-700 mt-0.5">{getMemoModelStatusLabel(m.status)} • {m.sections.length} عناصر</div></button>)}</div></div>}
          </div>

          {/* مصادر المذكرة: ملفات، صور، لصق من الحافظة، واسترداد محلي */}
          <div className={`rounded-xl border p-3 space-y-2 ${isDragging ? 'border-emerald-500 bg-emerald-100/70' : 'border-gray-200 bg-white'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Paperclip size={15} className="text-emerald-700" />
                <span className="text-xs font-black text-gray-800">مصادر المذكرة</span>
                <span className="text-[10px] text-gray-500">صور وPDF — حتى 6MB للملف و10MB للمجموع</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-black bg-emerald-700 text-white rounded-lg hover:bg-emerald-800">
                  <FileUp size={13} /> إضافة ملف
                </button>
                <button type="button" onClick={restoreSaved} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-black bg-white text-emerald-800 border border-emerald-200 rounded-lg hover:bg-emerald-50">
                  <RotateCcw size={13} /> استرداد المحفوظ
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  multiple
                  hidden
                  onChange={(event) => {
                    if (event.target.files) addFiles(event.target.files);
                    event.currentTarget.value = '';
                  }}
                />
              </div>
            </div>

            <div className="border border-dashed border-emerald-200 rounded-lg p-2 text-center text-[10.5px] text-gray-500 bg-emerald-50/30">
              اسحب الملفات هنا أو اضغط <b>Ctrl + V</b>، أو استخدم زر <b>استيراد ملف</b> للصق صورة من الحافظة. المرفقات تحفظ محليًا في جهازك لاسترجاعها بعد إعادة فتح الأداة.
            </div>

            {attachments.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 border border-gray-200 rounded-lg p-2 bg-gray-50">
                    {item.mimeType.startsWith('image/') ? (
                      <img src={item.dataUrl} alt="" className="w-12 h-12 object-cover rounded-md border" />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-red-50 text-red-700 flex items-center justify-center text-[10px] font-black">PDF</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-black text-gray-800 truncate">{item.name}</div>
                      <div className="text-[10px] text-gray-500">{(item.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    <button type="button" onClick={() => removeAttachment(item.id)} className="p-1 text-gray-400 hover:text-red-600" title="إزالة من التوليد">
                      <XCircle size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {savedAttachments.length > 0 && (
              <details className="text-[10.5px]">
                <summary className="cursor-pointer font-bold text-gray-600">المرفقات المحفوظة على الجهاز ({savedAttachments.length})</summary>
                <div className="mt-2 space-y-1">
                  {savedAttachments.slice(0, 10).map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <span className="truncate flex-1">{item.name}</span>
                      <button type="button" onClick={() => setAttachments((prev) => prev.some(a => a.id === item.id) ? prev : [...prev, item].slice(0, 6))} className="text-emerald-700 font-black">استرداد</button>
                      <button type="button" onClick={() => permanentlyDeleteSaved(item.id)} className="text-red-600" title="حذف نهائي من الجهاز"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Tab Selector & Actions */}
          {note && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-200/60">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('note')}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                    activeTab === 'note'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  📄 المذكرة البيداغوجية الكاملة
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('worksheet')}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                    activeTab === 'worksheet'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  📝 بطاقة العمل الفوجي للتلميذ
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('json')}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                    activeTab === 'json'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  {`{ }`} JSON
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-gray-700 transition cursor-pointer"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copied ? 'تم النسخ' : 'نسخ JSON'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-2xs cursor-pointer"
                >
                  <Printer size={14} />
                  <span>طباعة / PDF</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Body / Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-gray-50/50">
          {!note && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <BookOpen size={32} />
              </div>
              <h4 className="text-base font-black text-gray-800">
                جاهز لتوليد مذكرة بيداغوجية رسمية بالمعايير الجزائرية
              </h4>
              <p className="text-xs text-gray-500 max-w-md">
                اختر المستوى الدراسي (1م، 2م، 3م، 4م)، واكتب موضوع الحصة أو المورد ثم اضغط على زر التوليد لإنشاء المذكرة وبطاقة العمل الفوجي.
              </p>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <Loader2 size={36} className="animate-spin text-emerald-600" />
              <div className="space-y-1">
                <h4 className="text-sm font-black text-emerald-950">
                  جاري صياغة المذكرة البيداغوجية بواسطة Gemini API...
                </h4>
                <p className="text-xs text-gray-500">
                  تطبيق توجيهات المفتشية البيداغوجية لمستوى {selectedGrade} والتحقق من الشيمة المعيارية
                </p>
              </div>
            </div>
          )}

          {note && !isLoading && (
            <div className="print-document bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6 text-gray-900 print:border-none print:shadow-none print:p-0">
              
              {/* TAB 1: Complete Pedagogical Note */}
              {activeTab === 'note' && (
                <div className="space-y-6">
                  {/* Official Header */}
                  <div className="border-b-2 border-emerald-800 pb-4 text-center space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-600">
                      <span>الجمهورية الجزائرية الديمقراطية الشعبية</span>
                      <span>وزارة التربية الوطنية</span>
                    </div>
                    <h2 className="text-xl font-black text-emerald-900 mt-1">
                      مذكرة بيداغوجية لبناء التعلمات (الجيل الثاني)
                    </h2>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11.5px] font-bold bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200">
                      <div>المستوى: <span className="font-black text-emerald-900">{note.meta.gradeLevel}</span></div>
                      <div>الميدان: <span className="font-black text-emerald-900">{note.meta.field}</span></div>
                      <div>المقطع: <span className="font-black text-emerald-900">{note.meta.learningUnit}</span></div>
                      <div>المدة: <span className="font-black text-emerald-900">{note.meta.durationHours} ساعة</span></div>
                      <div className="col-span-2 text-right">المورد: <span className="font-black text-emerald-950">{note.meta.learningResource}</span></div>
                      <div className="col-span-2 text-right">الحصة: <span className="font-black text-emerald-950">{note.meta.lessonTitle}</span></div>
                    </div>

                    <div className="text-right text-xs bg-amber-50/70 border border-amber-200 p-2 rounded-lg font-bold text-amber-950">
                      🎯 مركبة الكفاءة المستهدفة: <span className="font-normal text-gray-800">{note.meta.targetedCompetence}</span>
                    </div>
                  </div>

                  {labBlock && (
                    <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/50 rounded-xl p-4 space-y-2 print:break-inside-avoid">
                      <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-black text-emerald-900">إضافة من مختبر المساعد الخبير — {labBlock.title}</h4><button type="button" onClick={() => setLabBlock(null)} className="text-[10px] text-gray-500 print:hidden">إزالة</button></div>
                      <div className="text-xs leading-7 whitespace-pre-line text-gray-700">{labBlock.content}</div>
                      {labBlock.sources?.length ? <div className="pt-2 border-t border-emerald-200 text-[9px] text-blue-700">المصادر: {labBlock.sources.map(s => s.title).join(' • ')}</div> : null}
                      <div className="text-[9px] text-emerald-700 font-bold">اقتراح مساعد — يحتاج مراجعة الأستاذ قبل الاعتماد.</div>
                    </div>
                  )}

                  {/* 1. الثلاثية البيداغوجية */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-emerald-900 flex items-center gap-1.5 border-r-4 border-emerald-600 pr-2">
                      <Layers size={15} /> الثلاثية البيداغوجية لبناء المورد
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="bg-[#f0fdf4] border border-emerald-300 p-3 rounded-xl space-y-1">
                        <span className="font-black text-emerald-900 block">1. المورد المعرفي:</span>
                        <p className="text-gray-700 leading-relaxed">{note.pedagogicalTriad.knowledgeResource}</p>
                      </div>
                      <div className="bg-[#eff6ff] border border-blue-200 p-3 rounded-xl space-y-1">
                        <span className="font-black text-blue-900 block">2. المورد المنهجي:</span>
                        <p className="text-gray-700 leading-relaxed">{note.pedagogicalTriad.methodologicalResource}</p>
                      </div>
                      <div className="bg-[#faf5ff] border border-purple-200 p-3 rounded-xl space-y-1">
                        <span className="font-black text-purple-900 block">3. المورد القيمي والسلوكي:</span>
                        <p className="text-gray-700 leading-relaxed">{note.pedagogicalTriad.valuesResource}</p>
                      </div>
                    </div>
                  </div>

                  {/* 2. المتطلبات والوسائل والمصطلحات */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="border border-gray-200 p-3 rounded-xl bg-gray-50/60 space-y-2">
                      <span className="font-black text-gray-800 block">المكتسبات القبلية:</span>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        {note.requirements.prerequisites.map((p, idx) => (
                          <li key={idx}>{p}</li>
                        ))}
                      </ul>
                      <span className="font-black text-gray-800 block pt-1 border-t">الوسائل والسندات:</span>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        {note.requirements.didacticMeans.map((d, idx) => (
                          <li key={idx}>{d}</li>
                        ))}
                      </ul>
                    </div>

                    {/* المصطلحات العلمية باللغات */}
                    <div className="border border-gray-200 p-3 rounded-xl bg-white space-y-2">
                      <span className="font-black text-gray-800 flex items-center gap-1">
                        <Languages size={14} className="text-indigo-600" /> المصطلحات العلمية باللغتين الفرنسية والإنجليزية:
                      </span>
                      {note.requirements.scientificTerms.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-right text-[11px] border-collapse">
                            <thead>
                              <tr className="bg-gray-100 font-bold">
                                <th className="p-1 border">العربية</th>
                                <th className="p-1 border">Français</th>
                                <th className="p-1 border">English</th>
                              </tr>
                            </thead>
                            <tbody>
                              {note.requirements.scientificTerms.map((t, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="p-1 border font-bold text-gray-900">{t.arabic}</td>
                                  <td className="p-1 border font-sans text-gray-700">{t.french}</td>
                                  <td className="p-1 border font-sans text-gray-700">{t.english}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-[11px]">لا توجد مصطلحات خاصة مدخلة.</p>
                      )}
                    </div>
                  </div>

                  {/* 3. التجارب والكواشف الكيميائية (خاصة بالسنة الأولى والثانية أو حسب الحاجة) */}
                  {note.experiments && note.experiments.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-amber-900 flex items-center gap-1.5 border-r-4 border-amber-600 pr-2">
                        <FlaskConical size={15} /> جدول التجارب والكواشف الكيميائية المعتمدة
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs border border-amber-200 border-collapse">
                          <thead>
                            <tr className="bg-amber-100 text-amber-950 font-black">
                              <th className="p-2 border border-amber-200">المادة الخاضعة للتجربة</th>
                              <th className="p-2 border border-amber-200">الكاشف المستعمل</th>
                              <th className="p-2 border border-amber-200">الملاحظة المتوقعة</th>
                              <th className="p-2 border border-amber-200">الاستنتاج العلمي</th>
                            </tr>
                          </thead>
                          <tbody>
                            {note.experiments.map((exp, idx) => (
                              <tr key={idx} className="hover:bg-amber-50/50">
                                <td className="p-2 border border-amber-200 font-bold">{exp.substanceTested}</td>
                                <td className="p-2 border border-amber-200 font-mono text-emerald-800">{exp.reagentUsed}</td>
                                <td className="p-2 border border-amber-200">{exp.expectedObservation}</td>
                                <td className="p-2 border border-amber-200 font-bold text-gray-900">{exp.scientificConclusion}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 4. مراحل سير الحصة الأربعة */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-emerald-900 flex items-center gap-1.5 border-r-4 border-emerald-600 pr-2">
                      <Clock size={15} /> سير الحصة التعليمية التعلمية (المراحل الأربع الحتمية)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs border border-gray-300 border-collapse">
                        <thead>
                          <tr className="bg-[#f0fdf4] text-emerald-950 font-black">
                            <th className="p-2 border border-gray-300 w-24">المرحلة</th>
                            <th className="p-2 border border-gray-300 w-16 text-center">المدة</th>
                            <th className="p-2 border border-gray-300">تعليمات ونشاط الأستاذ</th>
                            <th className="p-2 border border-gray-300">نشاط المتعلم والفرضيات</th>
                            <th className="p-2 border border-gray-300 w-32">السندات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {note.sequence.map((stage, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/80">
                              <td className="p-2 border border-gray-300 font-black text-emerald-900 bg-emerald-50/40">
                                {stage.stageName}
                              </td>
                              <td className="p-2 border border-gray-300 font-bold text-center">
                                {stage.timeMinutes} د
                              </td>
                              <td className="p-2 border border-gray-300 text-gray-800 leading-relaxed">
                                {stage.teacherInstructions}
                              </td>
                              <td className="p-2 border border-gray-300 text-gray-800 leading-relaxed">
                                {stage.studentActivities}
                              </td>
                              <td className="p-2 border border-gray-300 text-[11px] text-gray-600">
                                {stage.didacticSupports.join('، ')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 5. شبكة معايير تصحيح وضعية إدماجية متوافقة مع شهادة التعليم المتوسط (BEM) */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-purple-900 flex items-center gap-1.5 border-r-4 border-purple-600 pr-2">
                      <Award size={15} /> شبكة معايير تصحيح وضعية إدماجية (معايير شهادة التعليم المتوسط BEM)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="border border-purple-200 bg-purple-50/50 p-3 rounded-xl space-y-1">
                        <span className="font-black text-purple-900 block">1. الوجاهة (الملاءمة):</span>
                        <p className="text-gray-700 leading-relaxed">{note.bemEvaluationGrid.relevance}</p>
                      </div>
                      <div className="border border-purple-200 bg-purple-50/50 p-3 rounded-xl space-y-1">
                        <span className="font-black text-purple-900 block">2. الاستعمال السليم لأدوات المادة:</span>
                        <p className="text-gray-700 leading-relaxed">{note.bemEvaluationGrid.correctUseOfTools}</p>
                      </div>
                      <div className="border border-purple-200 bg-purple-50/50 p-3 rounded-xl space-y-1">
                        <span className="font-black text-purple-900 block">3. الانسجام والتفسير العلمي:</span>
                        <p className="text-gray-700 leading-relaxed">{note.bemEvaluationGrid.coherence}</p>
                      </div>
                    </div>
                  </div>

                  {(note.sourceActivities?.title1 || note.sourceActivities?.title2 || note.sourceActivities?.assessment) && (
                    <div className="space-y-2 border-t border-emerald-200 pt-4 print:break-inside-avoid">
                      <h4 className="text-xs font-black text-emerald-900 border-r-4 border-emerald-600 pr-2">الأنشطة والتقويم من المصدر</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2"><b>النشاط 1:</b> {note.sourceActivities.title1 || 'غير متوفر في المصدر'}</div>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2"><b>النشاط 2:</b> {note.sourceActivities.title2 || 'غير متوفر في المصدر'}</div>
                        <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-2"><b>التقويم:</b> {note.sourceActivities.assessment || 'غير متوفر في المصدر'}</div>
                      </div>
                      <div className="text-[9px] text-gray-500">المصدر: {note.sourceActivities.sourceLabel}</div>
                    </div>
                  )}

                  {note.sourceTrace?.length > 0 && (
                    <div className="space-y-2 border-t border-sky-200 pt-4 print:break-inside-avoid">
                      <h4 className="text-xs font-black text-sky-900 flex items-center gap-1.5 border-r-4 border-sky-500 pr-2">
                        <FileCheck2 size={15} /> مصدر المعلومات في المذكرة
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                        {note.sourceTrace.map((trace, idx) => {
                          const labels: Record<string, string> = {
                            progression: 'التدرج',
                            memo: 'المذكرة',
                            library: 'المكتبة',
                            attachment: 'المرفق',
                            web: 'الويب',
                            ai: 'اقتراح AI',
                          };
                          const label = labels[trace.sourceType] || trace.sourceLabel;
                          const safeUri = trace.uri && /^https?:\/\//i.test(trace.uri) ? trace.uri : '';
                          return (
                            <div key={idx} className="border border-sky-100 bg-sky-50/50 rounded-lg p-2">
                              <div className="flex items-center justify-between gap-2 font-black text-sky-900">
                                <span>{trace.field}</span>
                                <span className="px-1.5 py-0.5 rounded bg-white border border-sky-200">{label}</span>
                              </div>
                              <div className="mt-1 text-gray-700 leading-5">{trace.value}</div>
                              <div className="mt-1 text-gray-500">{trace.sourceLabel}</div>
                              {safeUri ? (
                                <a href={safeUri} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline break-all print:hidden">{safeUri}</a>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {note.researchSources?.some(source => /^https?:\/\//i.test(source.url)) && (
                    <div className="space-y-2 border-t border-gray-200 pt-4 print:break-inside-avoid">
                      <h4 className="text-xs font-black text-gray-800">مصادر ومراجع التوليد</h4>
                      <ul className="space-y-1 text-[10px]">
                        {note.researchSources.filter(source => /^https?:\/\//i.test(source.url)).map((source, idx) => (
                          <li key={idx}>
                            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline print:text-black">{source.title || source.url}</a>
                            {source.purpose ? <span className="text-gray-500"> — {source.purpose}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Footer & Teacher Stamp */}
                  <div className="pt-4 border-t flex justify-between items-center text-xs font-bold text-gray-600">
                    <div>متوسطة: {config.schoolName || 'المؤسسة التربوية'}</div>
                    <div className="flex items-center gap-2">
                      <span>ختم الأستاذ(ة):</span>
                      <TeacherOfficialStamp config={config} />
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: Student Worksheet (بطاقة عمل فوجي جاهزة للطباعة) */}
              {activeTab === 'worksheet' && (
                <div className="space-y-5 border-2 border-emerald-600 p-6 rounded-2xl bg-white">
                  <div className="flex justify-between items-center border-b pb-3">
                    <div>
                      <h3 className="text-lg font-black text-emerald-950">بطاقة عمل فوجي - مرحلة التقصي والبحث</h3>
                      <p className="text-xs text-gray-500">المستوى: {note.meta.gradeLevel} | المورد: {note.meta.learningResource}</p>
                    </div>
                    <div className="text-left text-xs font-bold text-gray-600 space-y-0.5">
                      <div>الفوج رقم: ............</div>
                      <div>أسماء الأعضاء: ................................................</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="font-black text-xs text-emerald-900 block">التعليمات والتوجيهات:</span>
                    <ul className="list-disc list-inside space-y-1 text-xs text-gray-800">
                      {note.studentWorksheet.instructions.map((inst, idx) => (
                        <li key={idx} className="font-medium">{inst}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-4 pt-2">
                    <span className="font-black text-xs text-emerald-900 block">المهام والأسئلة المطلوبة للإنجاز:</span>
                    {note.studentWorksheet.questionsToAnswer.map((q, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="text-xs font-bold text-gray-900 flex items-start gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-900 flex items-center justify-center shrink-0 text-[11px] font-black">
                            {idx + 1}
                          </span>
                          <span>{q}</span>
                        </div>
                        <div className="border border-dashed border-gray-300 rounded-xl h-24 p-2 bg-gray-50/40 text-[11px] text-gray-400">
                          تدوين إجابة واستنتاج الفوج هنا...
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t flex justify-between items-center text-xs text-gray-500">
                    <span>مادة علوم الطبيعة والحياة - التعليم المتوسط</span>
                    <span>تقييم الأستاذ: ⚪ ممتاز  ⚪ جيد  ⚪ مقبول  ⚪ بحاجة لتعديل</span>
                  </div>
                </div>
              )}

              {/* TAB 3: JSON Output */}
              {activeTab === 'json' && (
                <div className="space-y-2" dir="ltr">
                  <pre className="p-4 bg-gray-950 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto max-h-[500px]">
                    {JSON.stringify(note, null, 2)}
                  </pre>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-100 border-t border-gray-200 p-3 px-6 flex items-center justify-between print:hidden">
          <span className="text-xs text-gray-500 font-bold">
            مطابق للتوجيهات البيداغوجية الرسمية لوزارة التربية الوطنية بالجزائر
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
