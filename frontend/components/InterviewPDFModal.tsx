'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { ask } from '@/lib/llm';
import { X, FileText, Download, Loader2 } from 'lucide-react';

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
    noExperienceAnswer: `While I haven't worked with ${topic} directly in production, I have studied these concepts through [coursework / personal projects / open-source contributions]. I understand the core trade-offs — particularly around [key point from question]. In an academic project on [related area], I applied similar principles by [specific action], which taught me [lesson directly relevant to the question].`,
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
- "star_action": 3–4 sentences on actions taken, tools used, key decisions made — include concrete technical choices
- "star_result": 2–3 sentences on outcome and learning — include a metric if possible
- "no_experience": 3–4 sentences for a candidate without direct production experience — use coursework, personal/academic projects, or transferable skills; start with "While I haven't worked with this directly in production…"

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

  const diffColor = (d: string) => d === 'junior' ? '#065f46' : d === 'mid' ? '#92400e' : '#991b1b';
  const diffBg    = (d: string) => d === 'junior' ? '#d1fae5' : d === 'mid' ? '#fef3c7' : '#fee2e2';
  const sigColor  = (s?: string) => s === 'pass' ? '#065f46' : s === 'borderline' ? '#92400e' : '#991b1b';
  const sigBg     = (s?: string) => s === 'pass' ? '#d1fae5' : s === 'borderline' ? '#fef3c7' : '#fee2e2';

  const questionsHTML = sorted.map((item, i) => {
    const sessionBlock = item.userAnswer ? `
      <div class="box session-box">
        <div class="box-label" style="color:${sigColor(item.userSignal)};background:${sigBg(item.userSignal)}">
          YOUR SESSION ANSWER · ${(item.userSignal ?? '').toUpperCase()}
        </div>
        <p class="body-text">${escapeHTML(item.userAnswer)}</p>
        ${item.userGotRight ? `<p class="feedback-line"><strong>Got right:</strong> ${escapeHTML(item.userGotRight)}</p>` : ''}
        ${item.userMissed   ? `<p class="feedback-line"><strong>Missed:</strong> ${escapeHTML(item.userMissed)}</p>` : ''}
      </div>` : '';

    return `
<div class="q-block">
  <div class="q-header">
    <span class="q-num">Q${i + 1}</span>
    <span class="diff-badge" style="background:${diffBg(item.difficulty)};color:${diffColor(item.difficulty)}">${item.difficulty.toUpperCase()}</span>
  </div>
  <p class="q-text">${escapeHTML(item.question)}</p>

  ${sessionBlock}

  <div class="box tech-box">
    <div class="box-label">TECHNICAL ANSWER</div>
    <p class="body-text pre">${escapeHTML(item.technicalAnswer)}</p>
  </div>

  <div class="box beh-box">
    <div class="box-label beh-label">BEHAVIORAL QUESTION</div>
    <p class="beh-q">"${escapeHTML(item.behavioralQ)}"</p>
    <div class="box-label star-label" style="margin-top:14px">STAR RESPONSE</div>
    <div class="star-grid">
      <div class="star-row"><span class="star-key">S — Situation</span><p>${escapeHTML(item.starSituation)}</p></div>
      <div class="star-row"><span class="star-key">T — Task</span><p>${escapeHTML(item.starTask)}</p></div>
      <div class="star-row"><span class="star-key">A — Action</span><p>${escapeHTML(item.starAction)}</p></div>
      <div class="star-row"><span class="star-key">R — Result</span><p>${escapeHTML(item.starResult)}</p></div>
    </div>
  </div>

  <div class="box alt-box">
    <div class="box-label alt-label">IF NO DIRECT EXPERIENCE</div>
    <p class="body-text">${escapeHTML(item.noExperienceAnswer)}</p>
  </div>
</div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Interview Guide — ${moduleTitle}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;background:#fff;font-size:13px;line-height:1.7}
.cover{padding:72px 64px 48px;border-bottom:2px solid #e5e7eb}
.eyebrow{font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.09em;margin-bottom:14px}
.cover-title{font-size:30px;font-weight:800;color:#111827;line-height:1.2;margin-bottom:6px}
.cover-sub{font-size:15px;color:#6b7280;margin-bottom:32px}
.stats{display:flex;gap:32px}
.stat strong{display:block;font-size:22px;font-weight:800;color:#111827}
.stat span{font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em}
.content{padding:40px 64px 80px}
.q-block{margin-bottom:40px;padding:24px;border:1px solid #e5e7eb;border-radius:10px;page-break-inside:avoid}
.q-header{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.q-num{font-size:11px;font-weight:700;color:#9ca3af;font-variant-numeric:tabular-nums}
.diff-badge{font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px}
.q-text{font-size:14px;font-weight:600;color:#111827;margin-bottom:16px;line-height:1.5}
.box{padding:14px 16px;border-radius:0 6px 6px 0;margin-bottom:10px}
.box-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:2px 8px;border-radius:4px;display:inline-block;margin-bottom:8px;color:#374151;background:#f1f5f9}
.body-text{font-size:13px;color:#374151;line-height:1.7}
.body-text.pre{white-space:pre-line}
.tech-box{background:#f0f9ff;border-left:3px solid #2563eb}
.beh-box{background:#faf5ff;border-left:3px solid #7c3aed}
.beh-label{color:#5b21b6;background:#ede9fe}
.star-label{color:#5b21b6;background:#ede9fe}
.beh-q{font-size:13px;font-style:italic;color:#374151;margin-bottom:4px}
.star-grid{display:grid;gap:8px;margin-top:10px}
.star-row{display:grid;grid-template-columns:120px 1fr;gap:8px;align-items:start}
.star-key{font-size:11px;font-weight:700;color:#6d28d9;padding-top:3px}
.star-row p{font-size:12px;color:#4b5563;line-height:1.6}
.alt-box{background:#eff6ff;border-left:3px solid #93c5fd}
.alt-label{color:#1e40af;background:#dbeafe}
.session-box{background:#f8fafc;border-left:3px solid #94a3b8}
.feedback-line{font-size:12px;color:#374151;margin-top:5px}
.print-fab{position:fixed;bottom:28px;right:28px;background:#111827;color:#fff;border:none;padding:12px 22px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25);z-index:999;letter-spacing:.01em}
.print-fab:hover{background:#374151}
@media print{
  .print-fab{display:none}
  body{font-size:11px}
  .cover{padding:40px}
  .content{padding:20px 40px 40px}
  .q-block{break-inside:avoid}
}
</style>
</head>
<body>
<button class="print-fab" onclick="window.print()">Print / Save as PDF</button>

<div class="cover">
  <p class="eyebrow">${moduleCategory} · Interview Preparation Guide</p>
  <h1 class="cover-title">${moduleTitle}</h1>
  <p class="cover-sub">Technical + Behavioral Questions with STAR-Method Answers</p>
  <div class="stats">
    <div class="stat"><strong>${sorted.length}</strong><span>questions</span></div>
    <div class="stat"><strong>${sorted.filter(i => i.difficulty === 'junior').length}</strong><span>junior</span></div>
    <div class="stat"><strong>${sorted.filter(i => i.difficulty === 'mid').length}</strong><span>mid-level</span></div>
    <div class="stat"><strong>${sorted.filter(i => i.difficulty === 'senior').length}</strong><span>senior</span></div>
    <div class="stat"><strong>${sorted.filter(i => i.userAnswer).length}</strong><span>answered</span></div>
    <div class="stat"><strong>${now}</strong><span>generated</span></div>
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
  const [phase,    setPhase]    = useState<'intro' | 'generating' | 'ready'>('intro');
  const [progress, setProgress] = useState(0);
  const [items,    setItems]    = useState<PDFItem[]>([]);

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
    setItems(merged);
    setPhase('ready');
  }

  function openPDF() {
    const html = buildHTMLDocument(items, moduleTitle, moduleCategory);
    const win  = window.open('', '_blank');
    if (!win) { alert('Allow popups to open the PDF document.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
  }

  const STEPS = [
    { label: 'Collecting questions',                   done: progress >= 25  },
    { label: 'Generating professional answers (AI)',   done: progress >= 80  },
    { label: 'Building behavioral + STAR responses',   done: progress >= 92  },
    { label: 'Formatting document',                    done: progress >= 100 },
  ];

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
        className="relative z-10 w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
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
                    <span className="text-green-500 shrink-0 mt-0.5">✓</span>
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
                    <span className={clsx('text-xs shrink-0 w-3', done ? 'text-green-500' : 'text-gray-300')}>
                      {done ? '✓' : '○'}
                    </span>
                    <span className={clsx('text-xs', done ? 'text-gray-700' : 'text-gray-400')}>{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Ready ── */}
          {phase === 'ready' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-green-500 text-base">✓</span>
                <p className="text-sm font-semibold text-gray-900">Guide ready</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-0.5">
                <p className="text-xs font-semibold text-green-700">
                  {items.length} questions · {items.filter(i => i.difficulty === 'senior').length} senior · {items.filter(i => i.difficulty === 'mid').length} mid · {items.filter(i => i.difficulty === 'junior').length} junior
                </p>
                <p className="text-[11px] text-green-600">
                  {items.filter(i => i.userAnswer).length > 0
                    ? `Includes your ${items.filter(i => i.userAnswer).length} session answers · `
                    : ''}
                  Organized by difficulty level
                </p>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                Opens in a new tab. Use your browser's Print dialog (Ctrl+P / Cmd+P) and choose
                <strong className="text-gray-700"> Save as PDF</strong> to download.
              </p>

              <button
                onClick={openPDF}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 active:scale-95 transition-all"
              >
                <Download className="w-4 h-4" />
                Open PDF
              </button>

              <button
                onClick={onClose}
                className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Close
              </button>
            </>
          )}

        </div>
      </motion.div>
    </motion.div>
  );
}
