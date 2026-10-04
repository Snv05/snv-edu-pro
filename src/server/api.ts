import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, createPartFromUri } from '@google/genai';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import { buildGeminiSystemPrompt } from '../services/geminiPrompts';
import { generateTextWithGateway, getAIProviderStatus } from './aiGateway';
import { sourcePriorityOf } from '../services/aiSourcePriority';

dotenv.config();

export const apiApp = express();

const getKnowledgeSnapshot = () => {
  try {
    const file = path.resolve(process.cwd(), 'data', 'aiKnowledge.json');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { updatedAt: null, updates: [], sources: [] };
  }
};

apiApp.use(express.json({ limit: '40mb' }));

// حالة مزودي الذكاء الاصطناعي المتاحين على الخادم.
apiApp.get('/api/ai/providers', (_req, res) => res.json(getAIProviderStatus()));

// نقطة نهاية لمعالجة طلبات المساعد البيداغوجي الذكي على جانب الخادم
apiApp.post('/api/gemini/generate', async (req, res) => {
  try {
    const { prompt, question, attachments = [], useWeb = false } = req.body;
    const finalPrompt = String(prompt || question || '').trim();
    if (!finalPrompt) return res.status(400).json({ error: 'Missing prompt in request' });

    const allowedAttachmentTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
    if (!Array.isArray(attachments) || attachments.length > 6) return res.status(400).json({ error: 'Too many attachments' });

    // عند وجود صور/PDF نستخدم Gemini لأنه مزود الرؤية المهيأ في المنصة.
    // لا نرسل المرفقات تلقائياً إلى مزود بديل حفاظاً على الخصوصية وتوافق الصيغ.
    if (attachments.length > 0) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY مطلوب لتحليل الصور وPDF.' });

      const attachmentInputs: Array<{ mimeType: string; base64: string; displayName: string }> = [];
      let attachmentSize = 0;
      for (const item of attachments) {
        if (!item || !allowedAttachmentTypes.has(item.mimeType)) return res.status(400).json({ error: 'Unsupported attachment type' });
        const dataUrl = String(item.dataUrl || '');
        const prefix = `data:${item.mimeType};base64,`;
        if (!dataUrl.startsWith(prefix)) return res.status(400).json({ error: 'Invalid attachment data' });
        attachmentSize += dataUrl.length;
        if (dataUrl.length > 20_000_000 || attachmentSize > 32_000_000) return res.status(400).json({ error: 'Attachments are too large' });
        attachmentInputs.push({
          mimeType: item.mimeType,
          base64: dataUrl.slice(prefix.length),
          displayName: String(item.name || `correction-source-${attachmentInputs.length + 1}`),
        });
      }

      const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
      const uploadedFiles: any[] = [];
      try {
        for (const item of attachmentInputs) {
          const file = await ai.files.upload({
            file: new Blob([Buffer.from(item.base64, 'base64')], { type: item.mimeType }),
            config: { mimeType: item.mimeType, displayName: item.displayName },
          });
          let info = file;
          for (let attempt = 0; attempt < 20 && info.state === 'PROCESSING'; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            info = await ai.files.get({ name: file.name });
          }
          if (info.state === 'FAILED') throw new Error(`فشل تجهيز المرفق: ${item.displayName}`);
          uploadedFiles.push(info);
        }
        const response = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: finalPrompt }, ...uploadedFiles.map((file) => createPartFromUri(file.uri, file.mimeType))] }],
          config: { tools: useWeb ? [{ googleSearch: {} }] : undefined },
        });
        const grounding = response.candidates?.[0]?.groundingMetadata;
        const sources = Array.isArray(grounding?.groundingChunks)
          ? grounding.groundingChunks.map((chunk: any) => chunk?.web).filter((web: any) => web?.uri)
              .map((web: any) => ({ title: web.title || web.uri, uri: web.uri }))
              .filter((source: any, index: number, arr: any[]) => arr.findIndex((x) => x.uri === source.uri) === index).slice(0, 10)
          : [];
        return res.json({ text: response.text || '', provider: 'gemini', sources, webSearchQueries: grounding?.webSearchQueries || [], usedWeb: sources.length > 0 || Boolean(grounding?.webSearchQueries?.length) });
      } finally {
        await Promise.allSettled(uploadedFiles.map((file) => ai.files.delete({ name: file.name })));
      }
    }

    const generated = await generateTextWithGateway(finalPrompt);
    return res.json({ text: generated.text, provider: generated.provider, sources: [], webSearchQueries: [], usedWeb: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Gateway Error]:', message);
    return res.status(500).json({ error: message });
  }
});

// المساعد الذكي المتقدم: المنهاج + المذكرات + الوثائق المرفقة + الويب
apiApp.post('/api/gemini/smart-assistant', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

    const {
      question,
      level = '',
      currentLesson = null,
      curriculum = [],
      attachments = [],
      useWeb = true,
      expertMode = true,
      assistantMode = 'expert',
    } = req.body;

    if (!String(question || '').trim()) {
      return res.status(400).json({ error: 'سؤال الأستاذ مطلوب' });
    }
    if (!Array.isArray(attachments) || attachments.length > 4) {
      return res.status(400).json({ error: 'يسمح المساعد المتقدم بأربعة مرفقات كحد أقصى.' });
    }

    const allowedTypes = new Set([
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf', 'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ]);

    const attachmentInputs: Array<{ mimeType: string; base64: string; displayName: string }> = [];
    let totalLength = 0;
    for (const item of attachments) {
      if (!item || !allowedTypes.has(item.mimeType)) {
        return res.status(400).json({ error: 'نوع ملف غير مدعوم في المساعد الذكي.' });
      }
      const dataUrl = String(item.dataUrl || '');
      const prefix = `data:${item.mimeType};base64,`;
      if (!dataUrl.startsWith(prefix) || dataUrl.length > 15_000_000) {
        return res.status(400).json({ error: 'حجم أحد ملفات المساعد الذكي أكبر من الحد المسموح.' });
      }
      totalLength += dataUrl.length;
      if (totalLength > 24_000_000) {
        return res.status(400).json({ error: 'إجمالي ملفات المساعد الذكي كبير جداً.' });
      }
      attachmentInputs.push({
        mimeType: item.mimeType,
        base64: dataUrl.slice(prefix.length),
        displayName: String(item.name || `assistant-source-${attachmentInputs.length + 1}`),
      });
    }

    const compactLesson = currentLesson ? {
      level: currentLesson.level,
      midan: currentLesson.midan,
      maqta: currentLesson.maqta,
      mawrid: currentLesson.mawrid,
      ta3alom: currentLesson.ta3alom,
      markaba: currentLesson.markaba,
      marifa: currentLesson.marifa,
      manhaji: currentLesson.manhaji,
      wadiya: currentLesson.wadiya,
      moshkila: currentLesson.moshkila,
      faradiyat: currentLesson.faradiyat,
      irsae: currentLesson.irsae,
      taqwim: currentLesson.taqwim,
      activities: Array.isArray(currentLesson.anshita) ? currentLesson.anshita.slice(0, 8) : [],
    } : null;

    const curriculumRows = Array.isArray(curriculum)
      ? curriculum
          .filter((item: any) => !level || item.level === level)
          .slice(0, 80)
          .map((item: any) => ({
            level: item.level,
            midan: item.midan,
            maqta: item.maqta,
            mawrid: item.mawrid,
            ta3alom: item.ta3alom,
            markaba: item.markaba,
            taqwim: item.taqwim,
            activityTitles: Array.isArray(item.anshita) ? item.anshita.map((a: any) => a.title).slice(0, 8) : [],
          }))
      : [];

    const sourcePolicy = [
      'أنت المساعد الخبير للأستاذ في علوم الطبيعة والحياة للتعليم المتوسط بالجزائر 1AM–4AM.',
      'مهمتك: البحث، التحقق، تفسير المصادر، تحديد الأنشطة والرسومات والسندات والملفات، اقتراح بدائل، والإجابة عن أسئلة الأستاذ والتلاميذ.',
      'هرم المصادر: 1) المنهاج الرسمي وبيانات المنصة والتدرج، 2) الوثيقة المرافقة، 3) دليل الأستاذ والكتاب المدرسي، 4) المذكرات والملفات التي يرفعها الأستاذ، 5) منصات التعليم وموارد المعلمين، 6) الويب، 7) الاقتراح التوليدي.',
      'لا تغيّر أسماء الميدان أو المقطع أو المورد أو تعلم المورد إذا ثبتت في قاعدة المنصة.',
      'عند تحديد نشاط، افصل النشاط الموثق حرفياً عن أي نشاط جديد. لا تنسب اقتراحاً إلى مصدر رسمي.',
      'عند طلب رسم أو صورة، افصل ما هو موجود في المصدر عن وصف/مخطط جديد مقترح، ولا تدّعِ وجود ملف أو صورة غير متاحة.',
      'عند طلب ملف، ابحث عن مصدر قابل للوصول؛ إذا لم يوجد، قدّم بنية الملف وكلمات بحث دقيقة بدلاً من اختلاق رابط.',
      'عند وجود تعارض بين المصادر، اعرضه بوضوح مع اسم كل مصدر ولا تخترع حلاً.',
      'المعلومة غير المثبتة تكتب: يحتاج مراجعة الأستاذ. والإنشاء الجديد يكتب: اقتراح تربوي.',
      'الإجابة العلمية تكون مباشرة، ثم تفسيراً مناسباً للمستوى، ثم تطبيقاً بيداغوجياً عند الحاجة.',
      'إذا استُخدم الويب، أدرج المصادر القابلة للفتح في نهاية الإجابة، مع تمييز المصدر الرسمي من المصدر التكميلي.',
      'عند طلب تجربة: الهدف، الفرضية، المتغيرات، الأدوات، الخطوات، الشاهد، النتائج، التفسير، السلامة، والبدائل المدرسية.',
      'عند طلب تقويم/حل: المعطيات، المطلوب، التحليل، الجواب، ثم سلم/مؤشرات عند الطلب.',
      'عند طلب بدائل: قدم بدائل تجريبية ووثائقية ورقمية/رسمية عند ملاءمتها، مع الوسائل والزمن والمزايا والحدود.',
      'لا تنشئ درساً كاملاً إذا كان المطلوب سؤالاً واحداً؛ كن مركزاً.',
      `وضع المهمة الحالي: ${assistantMode}`,
    ].join('\\n');

    const knowledgeSnapshot = getKnowledgeSnapshot();
    const context = [
      sourcePolicy,
      'لقطة المعرفة المحدثة من زيارات الويب المجدولة:',
      JSON.stringify({
        updatedAt: knowledgeSnapshot.updatedAt,
        updates: Array.isArray(knowledgeSnapshot.updates) ? knowledgeSnapshot.updates.slice(0, 30) : [],
      }, null, 2),
      `المستوى المطلوب: ${level || compactLesson?.level || 'غير محدد'}`,
      `نمط الأستاذ الخبير: ${expertMode ? 'مفعل' : 'متوقف'}`,
      `نوع المهمة: ${String(assistantMode || 'expert')}`,
      'المورد/المذكرة الحالية:',
      JSON.stringify(compactLesson, null, 2),
      'مقتطف قاعدة بيانات المنهاج والتدرجات:',
      JSON.stringify(curriculumRows, null, 2),
      'سؤال الأستاذ:',
      String(question).slice(0, 12000),
    ].join('\n\n');

    // عند غياب المرفقات والبحث الويب، يسمح الممر النصي باستخدام مزود بديل.
    if (attachmentInputs.length === 0 && !useWeb) {
      const generated = await generateTextWithGateway(context);
      return res.json({ text: generated.text, provider: generated.provider, sources: [], webSearchQueries: [], usedWeb: false, usedAttachments: [] });
    }

    if (!apiKey) return res.status(503).json({ error: 'لم يتم إعداد مفتاح Gemini على الخادم. أضف GEMINI_API_KEY أو GOOGLE_API_KEY في أسرار النشر.' });
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    const uploadedFiles: any[] = [];

    try {
      for (const item of attachmentInputs) {
        const file = await ai.files.upload({
          file: new Blob([Buffer.from(item.base64, 'base64')], { type: item.mimeType }),
          config: { mimeType: item.mimeType, displayName: item.displayName },
        });
        let info = file;
        for (let attempt = 0; attempt < 20 && info.state === 'PROCESSING'; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          info = await ai.files.get({ name: file.name });
        }
        if (info.state === 'FAILED') throw new Error(`فشل تجهيز الملف: ${item.displayName}`);
        uploadedFiles.push(info);
      }

      const fileParts = uploadedFiles.map((file) => createPartFromUri(file.uri, file.mimeType));
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const response = await ai.models.generateContent({
        model,
        contents: fileParts.length
          ? [{ role: 'user', parts: [{ text: context }, ...fileParts] }]
          : context,
        config: {
          tools: useWeb ? [{ googleSearch: {} }] : undefined,
        },
      });

      const candidate: any = response.candidates?.[0];
      const grounding = candidate?.groundingMetadata;
      const sources = Array.isArray(grounding?.groundingChunks)
        ? grounding.groundingChunks
            .map((chunk: any) => chunk?.web)
            .filter((web: any) => web?.uri)
            .map((web: any) => ({ title: web.title || web.uri, uri: web.uri }))
            .filter((source: any, index: number, arr: any[]) => arr.findIndex((x) => x.uri === source.uri) === index)
            .slice(0, 8)
        : [];

      return res.json({
        text: response.text || '',
        sources,
        webSearchQueries: grounding?.webSearchQueries || [],
        usedWeb: sources.length > 0 || Boolean(grounding?.webSearchQueries?.length),
        usedAttachments: uploadedFiles.map((file) => file.displayName || file.name),
      });
    } finally {
      await Promise.allSettled(uploadedFiles.map((file) => ai.files.delete({ name: file.name })));
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Smart Assistant Error]:', message);
    const normalized = message.toLowerCase();
    if (normalized.includes('401') || normalized.includes('403') || normalized.includes('api key') || normalized.includes('permission') || normalized.includes('unauthorized')) {
      return res.status(503).json({
        error: 'مفتاح Gemini موجود لكنه غير صالح أو غير مصرح به. أنشئ/حدّث مفتاح Gemini المصرح به في Google AI Studio، ثم ضعه في أسرار النشر باسم GEMINI_API_KEY أو GOOGLE_API_KEY.',
        code: 'GEMINI_AUTH_ERROR',
      });
    }
    return res.status(500).json({ error: message });
  }
});

// صحة مزود المساعد الذكي: لا يعيد المفتاح أو أي سر.
apiApp.get('/api/gemini/assistant-status', (_req, res) => {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const fallbackConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.HF_TOKEN);
  res.json({
    ready: geminiConfigured || fallbackConfigured,
    geminiConfigured,
    fallbackConfigured,
    webAndFileFeatures: geminiConfigured,
    message: geminiConfigured
      ? 'المساعد الخبير جاهز مع تحليل الملفات والبحث في الويب.'
      : fallbackConfigured
        ? 'المساعد النصي جاهز، لكن البحث في الويب وتحليل الملفات يحتاجان Gemini.'
        : 'لم يتم إعداد مزود ذكاء اصطناعي على الخادم.',
  });
});

// حالة قاعدة المعرفة المستمرة للمساعد الذكي
apiApp.get('/api/gemini/knowledge-status', (_req, res) => {
  const snapshot = getKnowledgeSnapshot();
  const updates = Array.isArray(snapshot.updates) ? snapshot.updates : [];
  const sources = Array.isArray(snapshot.sources) ? snapshot.sources : [];
  res.json({
    version: snapshot.version || 1,
    updatedAt: snapshot.updatedAt || null,
    updateCount: updates.length,
    sources,
    lastRefresh: snapshot.lastRefresh || null,
    updates: updates.slice(0, 30).map((item: any) => ({
      title: item.title,
      summary: item.summary,
      date: item.date,
      level: item.level,
      topic: item.topic,
      importance: item.importance,
      sourceTitle: item.sourceTitle,
      sourceUrl: item.sourceUrl,
      sourceType: item.sourceType,
      confidence: item.confidence,
    })),
  });
});

// تحليل ورقة الفرض/الاختبار قبل بناء مذكرة التصحيح
apiApp.post('/api/gemini/analyze-correction-source', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on server' });

    const { examType, examText = '', attachments = [] } = req.body;
    if (!examType || (!String(examText).trim() && (!Array.isArray(attachments) || attachments.length === 0))) {
      return res.status(400).json({ error: 'مصدر التصحيح مطلوب' });
    }

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain']);
    if (!Array.isArray(attachments) || attachments.length > 6) {
      return res.status(400).json({ error: 'عدد المرفقات غير مسموح' });
    }

    const attachmentInputs: Array<{ mimeType: string; base64: string; displayName: string }> = [];
    let totalLength = 0;
    for (const item of attachments) {
      if (!item || !allowedTypes.has(item.mimeType)) return res.status(400).json({ error: 'نوع مرفق غير مسموح' });
      const dataUrl = String(item.dataUrl || '');
      const prefix = `data:${item.mimeType};base64,`;
      if (!dataUrl.startsWith(prefix) || dataUrl.length > 20_000_000) {
        return res.status(400).json({ error: 'مرفق غير صالح أو كبير جداً' });
      }
      totalLength += dataUrl.length;
      if (totalLength > 32_000_000) return res.status(400).json({ error: 'إجمالي المرفقات كبير جداً' });
      attachmentInputs.push({
        mimeType: item.mimeType,
        base64: dataUrl.slice(prefix.length),
        displayName: String(item.name || `correction-analysis-${attachmentInputs.length + 1}`),
      });
    }

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    const uploadedFiles: any[] = [];
    try {
      for (const item of attachmentInputs) {
        const file = await ai.files.upload({
          file: new Blob([Buffer.from(item.base64, 'base64')], { type: item.mimeType }),
          config: { mimeType: item.mimeType, displayName: item.displayName },
        });
        let info = file;
        for (let attempt = 0; attempt < 20 && info.state === 'PROCESSING'; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          info = await ai.files.get({ name: file.name });
        }
        if (info.state === 'FAILED') throw new Error(`فشل تجهيز المرفق: ${item.displayName}`);
        uploadedFiles.push(info);
      }

      const fileParts = uploadedFiles.map((file) => createPartFromUri(file.uri, file.mimeType));
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const response = await ai.models.generateContent({
        model,
        contents: [{
          role: 'user',
          parts: [{
            text: [
              'حلل ورقة التقييم التالية كمصدر فقط ولا تحل الأسئلة.',
              'استخرج ما يمكن قراءته حرفياً من الورقة، مع الحفاظ على الترتيب.',
              'أعد JSON فقط بالشكل: {title, exercises:[{number, title, questions:[{number,text,points,documentRefs}]}], totalPoints, documents:[{id,description}], ambiguities:[]}.',
              'إذا لم تستطع قراءة عنصر اتركه فارغاً وأضفه إلى ambiguities. لا تخترع أي سؤال أو نقطة.',
              `نوع التقييم: ${examType}`,
              `النص المتاح: ${String(examText).slice(0, 30000)}`,
            ].join('\\n'),
          }, ...fileParts],
        }],
        config: { responseMimeType: 'application/json' },
      });
      return res.json({ json: response.text || '' });
    } finally {
      await Promise.allSettled(uploadedFiles.map((file) => ai.files.delete({ name: file.name })));
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Correction source analysis error]:', message);
    return res.status(500).json({ error: message });
  }
});

// نقطة نهاية لتوليد المذكرة البيداغوجية الرسمية وفق منهاج الجيل الثاني (JSON منظم)
apiApp.post('/api/gemini/generate-pedagogical-note', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'مفتاح واجهة برمجة تطبيقات Gemini غير متوفر في الخادم' });
    }
    const { gradeLevel, topic, attachments = [], useWebResearch = true, modelSections = [], sourceContext = {} } = req.body;
    if (!gradeLevel || !topic) {
      return res.status(400).json({ error: 'المستوى والموضوع مطلوبان لتوليد المذكرة' });
    }

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain']);
    if (!Array.isArray(attachments) || attachments.length > 6) {
      return res.status(400).json({ error: 'عدد المرفقات المسموح به هو 6 كحد أقصى.' });
    }

    const classifyAttachment = (item: any) => {
      const name = String(item?.name || '').toLowerCase();
      if (/منهاج|programme|curriculum/.test(name)) return { kind: 'curriculum', role: 'المنهاج الرسمي', priority: sourcePriorityOf('curriculum') };
      if (/مرافق|مرافقة|document.*accompagn|companion/.test(name)) return { kind: 'companionDocument', role: 'الوثيقة المرافقة', priority: sourcePriorityOf('companionDocument') };
      if (/دليل.*أستاذ|أستاذ.*دليل|guide.*prof|teacher.*guide/.test(name)) return { kind: 'teacherGuide', role: 'كتاب دليل الأستاذ', priority: sourcePriorityOf('teacherGuide') };
      if (/مذكر|memo|fiche/.test(name)) return { kind: 'memo', role: 'مذكرة/مورد تربوي', priority: sourcePriorityOf('memo') };
      return { kind: 'attachment', role: 'وثيقة مرفقة من الأستاذ', priority: sourcePriorityOf('attachment') };
    };

    let totalLength = 0;
    const attachmentParts: any[] = [];
    for (const item of attachments) {
      if (!item || !allowedTypes.has(item.mimeType)) {
        return res.status(400).json({ error: 'تم رفض مرفق بسبب نوع ملف غير مسموح.' });
      }
      const dataUrl = String(item.dataUrl || '');
      const prefix = `data:${item.mimeType};base64,`;
      if (!dataUrl.startsWith(prefix) || dataUrl.length > 8_500_000) {
        return res.status(400).json({ error: 'صيغة أو حجم أحد المرفقات غير صالح.' });
      }
      totalLength += dataUrl.length;
      if (totalLength > 10_000_000) {
        return res.status(400).json({ error: 'إجمالي المرفقات كبير جداً.' });
      }
      if (item.mimeType === 'text/plain') {
        return res.status(400).json({ error: 'الملفات النصية غير مدعومة بعد في التوليد المرفق.' });
      }
      const sourceMeta = Array.isArray(sourceContext?.sourceDocuments)
        ? sourceContext.sourceDocuments.find((doc: any) => String(doc?.name || '') === String(item?.name || ''))
        : null;
      const classified = sourceMeta?.type
        ? { kind: String(sourceMeta.type), role: String(sourceMeta.type === 'curriculum' ? 'المنهاج والتدرج' : sourceMeta.type === 'companion' || sourceMeta.type === 'companionDocument' ? 'الوثيقة المرافقة' : sourceMeta.type === 'teacher-guide' || sourceMeta.type === 'teacherGuide' ? 'كتاب دليل الأستاذ' : 'مذكرة/مرجع تربوي'), priority: Number(sourceMeta.priority || 5) }
        : classifyAttachment(item);
      attachmentParts.push(
        { text: `المرفق المرجعي التالي مصنف رسمياً للاستخدام في التوليد: ${classified.role}. اعتبره مصدراً ${classified.priority <= 2 ? 'أعلى أولوية' : 'مرجعياً مكملاً'}، ولا تنسب إليه معلومة غير موجودة فيه. اسم الملف: ${String(item.name || 'مرفق')}` },
        { inlineData: { mimeType: item.mimeType, data: dataUrl.slice(prefix.length) } }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const safeModelSections = Array.isArray(modelSections) ? modelSections.slice(0, 30).map(String) : [];

    const safeSourceContext = sourceContext && typeof sourceContext === 'object'
      ? {
          progression: Array.isArray((sourceContext as any).progression) ? (sourceContext as any).progression.slice(0, 40) : [],
          memo: Array.isArray((sourceContext as any).memo) ? (sourceContext as any).memo.slice(0, 40) : [],
          library: Array.isArray((sourceContext as any).library) ? (sourceContext as any).library.slice(0, 10) : [],
          sourceDocuments: Array.isArray((sourceContext as any).sourceDocuments)
            ? (sourceContext as any).sourceDocuments.slice(0, 10)
            : [],
          officialSources: Array.isArray((sourceContext as any).officialSources)
            ? (sourceContext as any).officialSources.slice(0, 20)
            : [],
          sourceMemoExcerpts: typeof (sourceContext as any).sourceMemoExcerpts === 'string'
            ? String((sourceContext as any).sourceMemoExcerpts).slice(0, 24000)
            : '',
          sourcePolicy: (sourceContext as any).sourcePolicy || null,
        }
      : {};

    const provenanceInstruction = `
ترتيب المصادر الإلزامي للمذكرة:
1) المنهاج الرسمي وبيانات المنصة/التدرج،
2) الوثيقة المرافقة،
3) كتاب دليل الأستاذ،
4) المذكرات/الموارد التربوية،
5) مرفقات الأستاذ،
6) الويب عند الحاجة فقط،
7) مكتبة النماذج للهيكلة فقط،
8) الذكاء الاصطناعي للاقتراحات غير المثبتة.

لا تنسب أي معلومة إلى المنهاج أو الوثيقة المرافقة أو دليل الأستاذ إلا إذا كانت موجودة فعلاً في السياق أو في مرفق مصنف بذلك المصدر.
إذا لم يكن محتوى الوثيقة المرافقة/دليل الأستاذ مرفقاً أو متاحاً في السياق، سجّل المصدر كـ«غير متاح» ولا تدّعِ أنك استعملته.
مقتطفات المصدر الكامل للمذكرات تُستخدم للتحقق من عناوين الأنشطة والتقويم وبنية الحصة، ولا تُستخدم لتغيير الميدان/المقطع/المورد الرسمي المثبت في المنهاج والتدرج.
لا تجعل الويب أو النموذج اللغوي يتغلب على مصدر رسمي متاح.
عند استعمال قيمة من سياق المصدر، سجلها في sourceTrace مع نوع المصدر واسمه.
إذا تعذر إثبات قيمة من المصادر الداخلية، لا تخترعها؛ يمكن اقتراحها فقط كـ sourceType="ai" وsourceLabel="اقتراح AI — يحتاج مراجعة الأستاذ".
`;

    const systemPrompt = buildGeminiSystemPrompt(gradeLevel, topic, safeModelSections) + `\n\n${provenanceInstruction}\nسياق المصادر الداخلي المرسل من الواجهة:\n${JSON.stringify(safeSourceContext, null, 2).slice(0, 50000)}\n\nقاعدة المعرفة الداخلية الحالية:\n${JSON.stringify(getKnowledgeSnapshot(), null, 2).slice(0, 30000)}`;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const userInstruction = `قم بتوليد المذكرة البيداغوجية الرسمية التامة لمستوى [${gradeLevel}] في مادة علوم الطبيعة والحياة حول: "${topic}". التزم بإخراج كائن JSON فقط طبقاً للشروط والتعليمات. إذا وُجدت مصادر مرفقة، اعتبرها مصادر الأستاذ ولا تخترع بيانات مخالفة لها.`;

    // بدون مرفقات وبدون بحث ويب يمكن استخدام أي مزود نصي مهيأ، مما يمنع توقف المنصة عند انتهاء حصة Gemini.
    if (attachmentParts.length === 0 && !useWebResearch) {
      const generated = await generateTextWithGateway(`${systemPrompt}\n\n${userInstruction}`);
      return res.json({ json: generated.text, provider: generated.provider, usedWeb: false });
    }

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: userInstruction }, ...attachmentParts] }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        tools: useWebResearch ? [{ googleSearch: {} }] : undefined,
      },
    });

    const grounding = response.candidates?.[0]?.groundingMetadata;
    const sources = Array.isArray(grounding?.groundingChunks)
      ? grounding.groundingChunks.map((chunk: any) => chunk?.web).filter((web: any) => web?.uri)
          .map((web: any) => ({ title: web.title || web.uri, uri: web.uri }))
          .filter((source: any, index: number, arr: any[]) => arr.findIndex((x) => x.uri === source.uri) === index)
          .slice(0, 10)
      : [];
    return res.json({
      json: response.text || '',
      provider: 'gemini',
      sources,
      webSearchQueries: grounding?.webSearchQueries || [],
      usedWeb: sources.length > 0 || Boolean(grounding?.webSearchQueries?.length),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Gemini Pedagogical Note Server Error]:', message);
    return res.status(500).json({ error: message });
  }
});
