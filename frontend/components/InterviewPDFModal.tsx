'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { ask } from '@/lib/llm';
import { X, FileText, Download, Loader2, Check, Circle, ChevronRight } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Question {
  question:     string;
  difficulty:   'junior' | 'mid' | 'senior';
  keyPoints:    string[];
  trap?:        string;
  answer?:      string;
  modelAnswer?: string;
}

export interface SessionAnswer {
  question:   string;
  difficulty: 'junior' | 'mid' | 'senior';
  userAnswer: string;
  gotRight:   string;
  missed:     string;
  followUp:   string;
  signal:     'pass' | 'borderline' | 'fail';
}

interface PDFItem {
  question:           string;
  difficulty:         'junior' | 'mid' | 'senior';
  keyPoints:          string[];
  trap?:              string;
  technicalAnswer:    string;
  behavioralQ:        string;
  starSituation:      string;
  starTask:           string;
  starAction:         string;
  starResult:         string;
  noExperienceAnswer: string;
  userAnswer?:        string;
  userSignal?:        'pass' | 'borderline' | 'fail';
  userGotRight?:      string;
  userMissed?:        string;
}

export interface InterviewPDFModalProps {
  interviewQA:    Question[];
  moduleTitle:    string;
  moduleCategory: string;
  sessionAnswers: SessionAnswer[];
  onClose:        () => void;
}

// ── Content builders ──────────────────────────────────────────────────────────

function buildTechnicalAnswer(q: Question): string {
  if (q.answer || q.modelAnswer) return q.answer ?? q.modelAnswer ?? '';
  if (!q.keyPoints.length) {
    return 'Address this by discussing the core trade-offs, specific implementation details, production failure modes, and measurable outcomes you would target.';
  }
  const bullets = q.keyPoints.map(kp => `  • ${kp}`).join('\n');
  const trap = q.trap ? `\nCommon mistake to avoid: ${q.trap}` : '';
  return `A strong answer covers:\n${bullets}${trap}`;
}

function buildSTARFallback(q: Question, moduleTitle: string) {
  const topic = moduleTitle.toLowerCase();
  return {
    behavioralQ:        `Tell me about a time you worked on a system involving ${topic}. What was your approach?`,
    starSituation:      `[Describe the context: "In my [role/project], I was working on a system that required ${topic} considerations. We were facing [specific challenge]…"]`,
    starTask:           `[Your responsibility: "My task was to [design / implement / optimize / debug] the [component] to achieve [goal]…"]`,
    starAction:         `[What you did: "I approached this by first analyzing [X], then choosing [approach] because [rationale]. I implemented [Y] using [tools/techniques]…"]`,
    starResult:         `[Outcome: "This resulted in [measurable improvement]. The key learning was [insight]…"]`,
    noExperienceAnswer: `While I haven't worked with ${topic} directly in production, I have studied these concepts through [coursework / personal projects / open-source contributions]. I understand the core trade-offs - particularly around [key point from question]. In an academic project on [related area], I applied similar principles by [specific action], which taught me [lesson directly relevant to the question].`,
  };
}

// ── AI prompt ─────────────────────────────────────────────────────────────────

function buildAIPrompt(questions: Question[], moduleTitle: string, moduleCategory: string): string {
  const qList = questions
    .map((q, i) => {
      const kp = q.keyPoints.length ? `\n   Key aspects: ${q.keyPoints.slice(0, 3).join(' | ')}` : '';
      const trap = q.trap ? `\n   Trap: ${q.trap}` : '';
      return `${i + 1}. [${q.difficulty.toUpperCase()}] ${q.question}${kp}${trap}`;
    })
    .join('\n\n');

  return `Create an interview preparation guide for: ${moduleTitle} (${moduleCategory}).

For EACH of the ${questions.length} questions below, return a JSON object with these exact fields:
- "behavioral_q": A behavioral question starting with "Tell me about a time..." or "Describe a project where..." that maps to this topic
- "star_situation": 2–3 sentences, first-person, describing the context (e.g., "I was working on a recommendation system at…")
- "star_task": 1–2 sentences on your specific responsibility
- "star_action": 3–4 sentences on actions taken, tools used, key decisions made - include concrete technical choices
- "star_result": 2–3 sentences on outcome and learning - include a metric if possible
- "no_experience": 3–4 sentences for a candidate without direct production experience - use coursework, personal/academic projects, or transferable skills; start with "While I haven't worked with this directly in production…"

Questions:
${qList}

Return ONLY a valid JSON array of ${questions.length} objects. No markdown, no commentary.`;
}

function parseAIResponse(text: string, questions: Question[], moduleTitle: string): Partial<PDFItem>[] {
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const json = JSON.parse(cleaned);
    if (Array.isArray(json)) {
      return json.map((item: Record<string, string>) => ({
        behavioralQ:        item.behavioral_q   ?? item.behavioralQ   ?? '',
        starSituation:      item.star_situation  ?? item.starSituation ?? '',
        starTask:           item.star_task       ?? item.starTask      ?? '',
        starAction:         item.star_action     ?? item.starAction    ?? '',
        starResult:         item.star_result     ?? item.starResult    ?? '',
        noExperienceAnswer: item.no_experience   ?? item.noExperience  ?? '',
      }));
    }
  } catch {
    // fall through to per-question fallback
  }
  return questions.map(q => buildSTARFallback(q, moduleTitle));
}

// ── HTML document builder ─────────────────────────────────────────────────────

function buildHTMLDocument(items: PDFItem[], moduleTitle: string, moduleCategory: string): string {
  const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const order = { junior: 0, mid: 1, senior: 2 } as const;
  const sorted = [...items].sort((a, b) => order[a.difficulty] - order[b.difficulty]);

  const questionsHTML = sorted.map((item, i) => {
    const sessionBlock = item.userAnswer ? `
      <div class="section session-section">
        <p class="section-label">Your answer &mdash; ${item.userSignal ?? ''}</p>
        <p class="body-text">${escapeHTML(item.userAnswer)}</p>
        ${item.userGotRight ? `<p class="feedback-line"><strong>Got right:</strong> ${escapeHTML(item.userGotRight)}</p>` : ''}
        ${item.userMissed   ? `<p class="feedback-line"><strong>Missed:</strong> ${escapeHTML(item.userMissed)}</p>` : ''}
      </div>` : '';

    return `
<div class="q-block">
  <div class="q-header">
    <span class="q-num">Q${i + 1}</span>
    <span class="diff-tag">${item.difficulty}</span>
  </div>
  <p class="q-text">${escapeHTML(item.question)}</p>

  ${sessionBlock}

  <div class="section">
    <p class="section-label">Technical answer</p>
    <p class="body-text pre">${escapeHTML(item.technicalAnswer)}</p>
  </div>

  <div class="section">
    <p class="section-label">Behavioral question</p>
    <p class="beh-q">${escapeHTML(item.behavioralQ)}</p>
  </div>

  <div class="section">
    <p class="section-label">STAR response</p>
    <div class="star-grid">
      <div class="star-row"><span class="star-key">Situation</span><p>${escapeHTML(item.starSituation)}</p></div>
      <div class="star-row"><span class="star-key">Task</span><p>${escapeHTML(item.starTask)}</p></div>
      <div class="star-row"><span class="star-key">Action</span><p>${escapeHTML(item.starAction)}</p></div>
      <div class="star-row"><span class="star-key">Result</span><p>${escapeHTML(item.starResult)}</p></div>
    </div>
  </div>

  <div class="section alt-section">
    <p class="section-label">If you have no direct experience</p>
    <p class="body-text">${escapeHTML(item.noExperienceAnswer)}</p>
  </div>
</div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Interview Guide - ${moduleTitle}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,'Times New Roman',serif;color:#111;background:#fff;font-size:13px;line-height:1.75}
.cover{padding:64px 72px 40px}
.cover-eyebrow{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px}
.cover-title{font-size:28px;font-weight:700;color:#111;line-height:1.2;margin-bottom:6px}
.cover-sub{font-size:13px;color:#555;margin-bottom:28px;font-style:italic}
.cover-rule{border:none;border-top:2px solid #111;margin-bottom:20px}
.stats{display:flex;gap:36px;margin-bottom:4px}
.stat strong{display:block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:18px;font-weight:800;color:#111;line-height:1.1}
.stat span{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:10px;color:#777;text-transform:uppercase;letter-spacing:.05em}
.content{padding:32px 72px 80px}
.q-block{margin-bottom:44px;padding-bottom:44px;border-bottom:1px solid #ddd;page-break-inside:avoid}
.q-block:last-child{border-bottom:none}
.q-header{display:flex;align-items:baseline;gap:10px;margin-bottom:8px}
.q-num{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:10px;font-weight:700;color:#999;letter-spacing:.05em}
.diff-tag{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:10px;font-weight:600;color:#555;border:1px solid #ccc;padding:1px 7px;border-radius:3px}
.q-text{font-size:15px;font-weight:700;color:#111;margin-bottom:18px;line-height:1.45}
.section{margin-bottom:16px}
.section-label{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#777;margin-bottom:5px}
.session-section{border-left:2px solid #999;padding-left:12px;margin-bottom:16px}
.alt-section{border-left:2px solid #ddd;padding-left:12px}
.body-text{font-size:13px;color:#222;line-height:1.75}
.body-text.pre{white-space:pre-line}
.feedback-line{font-size:12px;color:#444;margin-top:6px;line-height:1.6}
.beh-q{font-size:13px;font-style:italic;color:#222;line-height:1.7}
.star-grid{display:grid;gap:10px;margin-top:6px}
.star-row{display:grid;grid-template-columns:90px 1fr;gap:10px;align-items:start}
.star-key{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em;padding-top:3px}
.star-row p{font-size:12.5px;color:#222;line-height:1.7}
.print-btn{position:fixed;bottom:24px;right:24px;background:#111;color:#fff;border:none;padding:10px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:.02em}
.print-btn:hover{background:#333}
@media print{
  .print-btn{display:none}
  .cover{padding:40px 56px 28px}
  .content{padding:20px 56px 60px}
  .q-block{break-inside:avoid}
}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Print / Save as PDF</button>

<div class="cover">
  <p class="cover-eyebrow">${moduleCategory} &mdash; Interview Preparation Guide</p>
  <h1 class="cover-title">${moduleTitle}</h1>
  <p class="cover-sub">Technical and behavioral questions with STAR-method answers</p>
  <hr class="cover-rule">
  <div class="stats">
    <div class="stat"><strong>${sorted.length}</strong><span>Questions</span></div>
    <div class="stat"><strong>${sorted.filter(i => i.difficulty === 'junior').length}</strong><span>Junior</span></div>
    <div class="stat"><strong>${sorted.filter(i => i.difficulty === 'mid').length}</strong><span>Mid-level</span></div>
    <div class="stat"><strong>${sorted.filter(i => i.difficulty === 'senior').length}</strong><span>Senior</span></div>
    ${sorted.filter(i => i.userAnswer).length > 0 ? `<div class="stat"><strong>${sorted.filter(i => i.userAnswer).length}</strong><span>Answered</span></div>` : ''}
    <div class="stat"><strong>${now}</strong><span>Generated</span></div>
  </div>
</div>

<div class="content">
${questionsHTML}
</div>
</body>
</html>`;
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InterviewPDFModal({
  interviewQA, moduleTitle, moduleCategory, sessionAnswers, onClose,
}: InterviewPDFModalProps) {
  const [phase,      setPhase]      = useState<'intro' | 'generating' | 'ready'>('intro');
  const [progress,   setProgress]   = useState(0);
  const [items,      setItems]      = useState<PDFItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    return () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); };
  }, []);

  async function generate() {
    setPhase('generating');
    setProgress(15);

    const sessionMap = new Map<string, SessionAnswer>();
    for (const sa of sessionAnswers) sessionMap.set(sa.question, sa);

    setProgress(25);

    let enriched: Partial<PDFItem>[];
    try {
      const res = await ask(
        buildAIPrompt(interviewQA, moduleTitle, moduleCategory),
        JSON.stringify(interviewQA.map(q => buildSTARFallback(q, moduleTitle))),
      );
      setProgress(80);
      enriched = parseAIResponse(res.text, interviewQA, moduleTitle);
    } catch {
      enriched = interviewQA.map(q => buildSTARFallback(q, moduleTitle));
    }

    setProgress(92);

    const merged: PDFItem[] = interviewQA.map((q, i) => {
      const e  = enriched[i] ?? buildSTARFallback(q, moduleTitle);
      const sa = sessionMap.get(q.question);
      const fb = buildSTARFallback(q, moduleTitle);
      return {
        question:           q.question,
        difficulty:         q.difficulty,
        keyPoints:          q.keyPoints,
        trap:               q.trap,
        technicalAnswer:    buildTechnicalAnswer(q),
        behavioralQ:        (e.behavioralQ        as string) || fb.behavioralQ,
        starSituation:      (e.starSituation      as string) || fb.starSituation,
        starTask:           (e.starTask           as string) || fb.starTask,
        starAction:         (e.starAction         as string) || fb.starAction,
        starResult:         (e.starResult         as string) || fb.starResult,
        noExperienceAnswer: (e.noExperienceAnswer as string) || fb.noExperienceAnswer,
        userAnswer:  sa?.userAnswer,
        userSignal:  sa?.signal,
        userGotRight: sa?.gotRight,
        userMissed:   sa?.missed,
      };
    });

    setProgress(100);

    const html = buildHTMLDocument(merged, moduleTitle, moduleCategory);
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    blobRef.current = url;
    setPreviewUrl(url);

    setItems(merged);
    setPhase('ready');
  }

  function openPDF() {
    const html = buildHTMLDocument(items, moduleTitle, moduleCategory);
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (!win) { alert('Allow popups to open the PDF document.'); return; }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function previewWithSampleData() {
    const sample = interviewQA.slice(0, 3).map(q => {
      const fb = buildSTARFallback(q, moduleTitle);
      return {
        question:           q.question,
        difficulty:         q.difficulty,
        keyPoints:          q.keyPoints,
        trap:               q.trap,
        technicalAnswer:    buildTechnicalAnswer(q),
        behavioralQ:        fb.behavioralQ,
        starSituation:      fb.starSituation,
        starTask:           fb.starTask,
        starAction:         fb.starAction,
        starResult:         fb.starResult,
        noExperienceAnswer: fb.noExperienceAnswer,
      } satisfies PDFItem;
    });

    const html = buildHTMLDocument(sample, moduleTitle, moduleCategory);
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    blobRef.current = url;
    setPreviewUrl(url);
    setItems(sample);
    setPhase('ready');
  }

  const STEPS = [
    { label: 'Collecting questions',                   done: progress >= 25  },
    { label: 'Generating professional answers (AI)',   done: progress >= 80  },
    { label: 'Building behavioral + STAR responses',   done: progress >= 92  },
    { label: 'Formatting document',                    done: progress >= 100 },
  ];

  const isReady = phase === 'ready';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        onClick={phase !== 'generating' ? onClose : undefined}
      />

      <motion.div
        className={[
          'relative z-10 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden flex flex-col',
          isReady ? 'max-w-5xl h-[88vh]' : 'max-w-md',
        ].join(' ')}
        layout
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-900">Interview Preparation Guide</span>
          </div>
          {phase !== 'generating' && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        {!isReady ? (
          <div className="px-6 py-6 space-y-5">

            {/* ── Intro ── */}
            {phase === 'intro' && (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {moduleTitle} <span className="text-gray-400 font-normal">· {moduleCategory}</span>
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Generates a print-ready PDF with professional answers, behavioral questions, and STAR-method
                    responses for all {interviewQA.length} questions in this module.
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Included in this guide</p>
                  {[
                    `${interviewQA.length} technical questions with polished answers`,
                    `${interviewQA.length} behavioral variants ("Tell me about a time…")`,
                    'STAR-method response for every question',
                    'Alternative framing for candidates without direct experience',
                    ...(sessionAnswers.length > 0
                      ? [`Your ${sessionAnswers.length} session answer${sessionAnswers.length > 1 ? 's' : ''} + AI feedback`]
                      : []),
                  ].map((line, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <Check className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                      {line}
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-gray-400">
                  Requires AI to be enabled for best results. Falls back to key-point templates if AI is unavailable.
                </p>

                <button
                  onClick={generate}
                  className="w-full py-2.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 active:scale-95 transition-all"
                >
                  Generate Guide
                </button>

                <button
                  onClick={previewWithSampleData}
                  className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Preview layout (sample data, no AI)
                </button>
              </>
            )}

            {/* ── Generating ── */}
            {phase === 'generating' && (
              <>
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Generating…</p>
                    <p className="text-xs text-gray-400 mt-0.5">AI is writing behavioral questions and STAR answers for {interviewQA.length} questions</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-blue-500 rounded-full"
                      initial={{ width: '15%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 text-right tabular-nums">{progress}%</p>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-2.5">
                  {STEPS.map(({ label, done }) => (
                    <div key={label} className="flex items-center gap-2.5">
                      {done
                        ? <Check className="w-3 h-3 text-green-500 shrink-0" />
                        : <Circle className="w-3 h-3 text-gray-300 shrink-0" />}
                      <span className={clsx('text-xs', done ? 'text-gray-700' : 'text-gray-400')}>{label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

          </div>
        ) : (
          /* ── Ready: side-by-side preview layout ── */
          <div className="flex flex-1 min-h-0">

            {/* Left panel: actions */}
            <div className="w-72 shrink-0 border-r border-gray-100 px-6 py-6 flex flex-col gap-5 overflow-y-auto">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Check className="w-4 h-4 text-green-500" />
                  <p className="text-sm font-semibold text-gray-900">Guide ready</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-0.5">
                  <p className="text-xs font-semibold text-green-700">
                    {items.length} questions
                  </p>
                  <p className="text-[11px] text-green-600">
                    {items.filter(i => i.difficulty === 'senior').length} senior ·{' '}
                    {items.filter(i => i.difficulty === 'mid').length} mid ·{' '}
                    {items.filter(i => i.difficulty === 'junior').length} junior
                  </p>
                  {items.filter(i => i.userAnswer).length > 0 && (
                    <p className="text-[11px] text-green-600">
                      {items.filter(i => i.userAnswer).length} session answers included
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-xs text-gray-500">
                <p className="font-medium text-gray-700 text-[11px] uppercase tracking-wider">Each question includes</p>
                {[
                  'Technical answer with key points',
                  'Behavioral variant (Tell me about…)',
                  'Full STAR-method response',
                  'No-experience fallback answer',
                ].map(line => (
                  <div key={line} className="flex items-start gap-1.5">
                    <ChevronRight className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                    {line}
                  </div>
                ))}
              </div>

              <div className="mt-auto space-y-2">
                <button
                  onClick={openPDF}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 active:scale-95 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Open to Print / Save PDF
                </button>
                <p className="text-[10px] text-gray-400 text-center">
                  In the new tab: Ctrl+P (or Cmd+P) → Save as PDF
                </p>
                <button
                  onClick={onClose}
                  className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Right panel: document preview */}
            <div className="flex-1 min-w-0 flex flex-col bg-gray-100">
              <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center gap-2 shrink-0">
                <div className="flex gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <span className="text-[11px] text-gray-400 font-mono truncate ml-1">
                  {moduleTitle} — Interview Preparation Guide
                </span>
              </div>
              {previewUrl && (
                <iframe
                  src={previewUrl}
                  className="flex-1 w-full border-0"
                  title="PDF Preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              )}
            </div>

          </div>
        )}

      </motion.div>
    </motion.div>
  );
}
