'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ask, type LLMSource } from '@/lib/llm';
import { RichText } from '@/components/RichText';
import {
  popQuestion, pushQuestions, needsRefill,
  quizKey, practiceKey, buildBatchPrompt, parseQuestionBatch,
} from '@/lib/questionCache';
import type { StudySection } from '@/modules/deployment/traffic-split/content';

// ── Accent color lookup (literal strings — required for Tailwind purge) ───────
const ACCENT: Record<string, { activeBg: string; bar: string; numOn: string; numOff: string }> = {
  blue:   { activeBg: 'bg-blue-50',   bar: 'bg-blue-500',   numOn: 'bg-blue-100 text-blue-700',   numOff: 'bg-gray-100 text-gray-400' },
  amber:  { activeBg: 'bg-amber-50',  bar: 'bg-amber-500',  numOn: 'bg-amber-100 text-amber-700',  numOff: 'bg-gray-100 text-gray-400' },
  cyan:   { activeBg: 'bg-cyan-50',   bar: 'bg-cyan-500',   numOn: 'bg-cyan-100 text-cyan-700',   numOff: 'bg-gray-100 text-gray-400' },
  orange: { activeBg: 'bg-orange-50', bar: 'bg-orange-500', numOn: 'bg-orange-100 text-orange-700', numOff: 'bg-gray-100 text-gray-400' },
  indigo: { activeBg: 'bg-blue-50',   bar: 'bg-blue-500',   numOn: 'bg-blue-100 text-blue-700',   numOff: 'bg-gray-100 text-gray-400' },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuizState {
  phase:    'idle' | 'loading' | 'done';
  question: string;
  source:   LLMSource | null;
  warn:     string;
}

interface ParsedFeedback {
  gotRight: string;
  missed:   string;
  followUp: string;
  signal:   string;
}

interface PracticeState {
  phase:    'idle' | 'generating' | 'answering' | 'evaluating' | 'done';
  question: string;
  answer:   string;
  feedback: ParsedFeedback | null;
  source:   LLMSource | null;
  warn:     string;
}

type MiniMsg =
  | { id: string; role: 'user';     text: string }
  | { id: string; role: 'ai';       text: string }
  | { id: string; role: 'thinking' };

type ChatMsg =
  | { id: string; role: 'user';    text: string }
  | { id: string; role: 'ai';      text: string; source: LLMSource; warn: string }
  | { id: string; role: 'thinking' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePracticeFeedback(raw: string): ParsedFeedback {
  const get = (label: string) => {
    const re = new RegExp(`${label}:[\\s]*([\\s\\S]*?)(?=\\n[A-Z -]+:|$)`, 'i');
    return raw.match(re)?.[1]?.trim() ?? '—';
  };
  return {
    gotRight: get('GOT RIGHT'),
    missed:   get('MISSED'),
    followUp: get('FOLLOW-UP'),
    signal:   get('SIGNAL'),
  };
}

function buildPracticeEvalPrompt(section: StudySection, question: string, answer: string): string {
  return `You are a senior ML engineer evaluating a technical interview answer.

Reference material:
## ${section.heading}
${section.body}

Question asked: "${question}"

Candidate's answer: "${answer}"

Evaluate using this exact format — be specific, reference their actual words:

GOT RIGHT:
[bullet points of what they covered correctly, or "— Nothing substantial" if weak]

MISSED:
[bullet points of key gaps vs. the reference material, or "— Nothing major" if complete]

FOLLOW-UP:
[one sharp follow-up question to probe deeper]

SIGNAL: [Strong pass / Borderline / Would not pass] — [one sentence why]`;
}

function buildPracticeEvalFallback(section: StudySection, answer: string): string {
  const lower = answer.toLowerCase();
  const bodyWords = Array.from(new Set(
    section.body.toLowerCase().split(/\W+/).filter(w => w.length > 5)
  ));
  const hits = bodyWords.filter(w => lower.includes(w));
  const coverage = hits.length / Math.max(bodyWords.length, 1);
  if (coverage > 0.25) {
    return `GOT RIGHT:\n— Touched on key concepts from "${section.heading}"\n— Showed awareness of the core idea\n\nMISSED:\n— Production implications and specific failure modes\n— Concrete numbers or thresholds\n\nFOLLOW-UP:\nWhat would you monitor in production to detect if this breaks?\n\nSIGNAL: Borderline — Good foundation but needs more specificity on trade-offs`;
  }
  return `GOT RIGHT:\n— Attempted to address the question\n\nMISSED:\n— More specificity on "${section.heading}" concepts\n— Trade-offs, failure modes, and production implications\n\nFOLLOW-UP:\nCan you walk me through a specific scenario where this matters in production?\n\nSIGNAL: Would not pass — Needs more depth on core concepts`;
}

function buildSectionFallback(heading: string): string {
  return `That's a good question about ${heading}. The key trade-off here is between risk and validation signal — moving faster means less data at each stage, while moving slower gives more confidence before increasing exposure.`;
}

function signalColor(sig: string) {
  if (sig.toLowerCase().includes('strong'))     return 'text-green-700 border-green-200 bg-green-50';
  if (sig.toLowerCase().includes('borderline')) return 'text-amber-700 border-amber-200 bg-amber-50';
  return 'text-red-700 border-red-200 bg-red-50';
}

// ── Section content (shown in main panel) ─────────────────────────────────────

function SectionContent({ section }: { section: StudySection }) {
  const [activeTab, setActiveTab] = useState<'quiz' | 'practice' | 'ask'>('quiz');
  const [quiz,      setQuiz]      = useState<QuizState>({ phase: 'idle', question: '', source: null, warn: '' });
  const [miniMsgs,  setMiniMsgs]  = useState<MiniMsg[]>([]);
  const [miniInput, setMiniInput] = useState('');
  const [miniWait,  setMiniWait]  = useState(false);
  const [practice,  setPractice]  = useState<PracticeState>({
    phase: 'idle', question: '', answer: '', feedback: null, source: null, warn: '',
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const answerRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [miniMsgs]);
  useEffect(() => {
    if (practice.phase === 'answering') setTimeout(() => answerRef.current?.focus(), 100);
  }, [practice.phase]);

  async function handleQuiz() {
    setActiveTab('quiz');
    setQuiz({ phase: 'loading', question: '', source: null, warn: '' });
    const cacheK = quizKey(section.heading);
    const cached = popQuestion(cacheK);
    if (cached) {
      setQuiz({ phase: 'done', question: cached, source: null, warn: '' });
      if (needsRefill(cacheK)) {
        ask(buildBatchPrompt(section.heading, section.body, 'quiz'), section.heading).then(r => {
          pushQuestions(cacheK, parseQuestionBatch(r.text));
        });
      }
      return;
    }
    const res = await ask(
      buildBatchPrompt(section.heading, section.body, 'quiz'),
      section.heading,
      (w) => setQuiz(q => ({ ...q, warn: w })),
    );
    const questions = parseQuestionBatch(res.text);
    const [first, ...rest] = questions;
    if (rest.length) pushQuestions(cacheK, rest);
    setQuiz({ phase: 'done', question: first ?? res.text, source: res.source, warn: '' });
  }

  async function handleAskSend() {
    const text = miniInput.trim();
    if (!text || miniWait) return;
    const uid = `u${Date.now()}`; const tid = `t${Date.now()}`;
    setMiniMsgs(prev => [...prev, { id: uid, role: 'user', text }, { id: tid, role: 'thinking' }]);
    setMiniInput(''); setMiniWait(true);
    const prompt = `You are an expert ML engineer tutor. A student is reading about this specific concept:\n\n## ${section.heading}\n${section.body}\n\nAnswer their question in 2–4 sentences. Be concrete and practical.\nStudent: ${text}\nTutor:`;
    const res = await ask(prompt, buildSectionFallback(section.heading));
    setMiniMsgs(prev => [
      ...prev.filter(m => m.id !== tid),
      { id: `a${Date.now()}`, role: 'ai', text: res.text },
    ]);
    setMiniWait(false);
  }

  async function handleStartPractice() {
    setPractice({ phase: 'generating', question: '', answer: '', feedback: null, source: null, warn: '' });
    const cacheK = practiceKey(section.heading);
    const cached = popQuestion(cacheK);
    if (cached) {
      setPractice(p => ({ ...p, phase: 'answering', question: cached }));
      if (needsRefill(cacheK)) {
        ask(buildBatchPrompt(section.heading, section.body, 'practice'), section.heading).then(r => {
          pushQuestions(cacheK, parseQuestionBatch(r.text));
        });
      }
      return;
    }
    const res = await ask(buildBatchPrompt(section.heading, section.body, 'practice'), section.heading);
    const questions = parseQuestionBatch(res.text);
    const [first, ...rest] = questions;
    if (rest.length) pushQuestions(cacheK, rest);
    setPractice(p => ({ ...p, phase: 'answering', question: first ?? res.text }));
  }

  async function handleSubmitAnswer() {
    const ans = practice.answer.trim();
    if (!ans || practice.phase !== 'answering') return;
    setPractice(p => ({ ...p, phase: 'evaluating' }));
    let warn = '';
    const res = await ask(
      buildPracticeEvalPrompt(section, practice.question, ans),
      buildPracticeEvalFallback(section, ans),
      w => { warn = w; },
    );
    setPractice(p => ({ ...p, phase: 'done', feedback: parsePracticeFeedback(res.text), source: res.source, warn }));
  }

  return (
    <div className="space-y-6">
      {/* Body */}
      <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
        <RichText text={section.body} />
      </div>

      {/* Practice tools */}
      <div className="border-t border-gray-100 pt-5">
        <div className="flex items-center gap-1 mb-4">
          {(['quiz', 'practice', 'ask'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium rounded border transition-all',
                activeTab === tab
                  ? tab === 'practice'
                    ? 'border-violet-300 bg-violet-50 text-violet-700'
                    : 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 bg-white'
              )}
            >
              {tab === 'quiz' ? 'Quiz me' : tab === 'practice' ? 'Practice' : 'Ask AI'}
            </button>
          ))}
        </div>

        {/* Quiz tab */}
        {activeTab === 'quiz' && (
          <div className="space-y-3">
            <button
              onClick={handleQuiz}
              disabled={quiz.phase === 'loading'}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-all',
                quiz.phase === 'loading'
                  ? 'border-blue-200 text-blue-400 cursor-not-allowed bg-blue-50/50'
                  : 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 active:scale-95'
              )}
            >
              {quiz.phase === 'loading' ? (
                <>
                  <motion.span className="w-1.5 h-1.5 rounded-full bg-blue-400"
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 0.9, repeat: Infinity }} />
                  Generating…
                </>
              ) : quiz.phase === 'done' ? 'New question' : 'Generate question'}
            </button>

            <AnimatePresence>
              {quiz.phase === 'done' && quiz.question && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                  className="relative px-4 py-3.5 rounded-lg border border-blue-200 bg-blue-50"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-400 rounded-l-lg" />
                  <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest mb-2">Interview question</p>
                  {quiz.warn && <p className="text-xs text-amber-600 mb-1">{quiz.warn}</p>}
                  <p className="text-sm text-gray-800 leading-relaxed">{quiz.question}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Practice tab */}
        {activeTab === 'practice' && (
          <div className="space-y-3">
            {practice.phase === 'idle' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  AI generates a question, you answer, AI evaluates with structured feedback.
                </p>
                <button
                  onClick={handleStartPractice}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-violet-300 text-violet-700 bg-violet-50 text-xs font-medium hover:bg-violet-100 active:scale-95 transition-all"
                >
                  Start practice
                </button>
              </div>
            )}

            {practice.phase === 'generating' && (
              <div className="flex items-center gap-2 py-2">
                {[0, 0.15, 0.3].map(d => (
                  <motion.span key={d} className="w-1.5 h-1.5 rounded-full bg-violet-400"
                    animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
                    transition={{ duration: 0.8, delay: d, repeat: Infinity }} />
                ))}
                <span className="text-xs text-violet-600">Generating question…</span>
              </div>
            )}

            {practice.phase === 'answering' && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="relative px-4 py-3.5 rounded-lg border border-violet-200 bg-violet-50">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-400 rounded-l-lg" />
                  <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-widest mb-2">Question</p>
                  <p className="text-sm text-gray-800 leading-relaxed">{practice.question}</p>
                </div>
                <textarea
                  ref={answerRef}
                  value={practice.answer}
                  onChange={e => setPractice(p => ({ ...p, answer: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitAnswer(); }}
                  placeholder="Type your answer… (Cmd+Enter to submit)"
                  rows={5}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 leading-relaxed focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 resize-none transition-colors"
                />
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!practice.answer.trim()}
                  className={clsx(
                    'px-4 py-2 rounded border text-xs font-medium transition-all',
                    !practice.answer.trim()
                      ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-white'
                      : 'border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100 active:scale-95'
                  )}
                >
                  Submit answer
                </button>
              </motion.div>
            )}

            {practice.phase === 'evaluating' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="relative px-4 py-3.5 rounded-lg border border-violet-200 bg-violet-50">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-400 rounded-l-lg" />
                  <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-widest mb-2">Question</p>
                  <p className="text-sm text-gray-800 leading-relaxed">{practice.question}</p>
                </div>
                <div className="px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 opacity-60">
                  <p className="text-xs text-gray-500 mb-1">Your answer</p>
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{practice.answer}</p>
                </div>
                <div className="flex items-center gap-2 py-1">
                  {[0, 0.15, 0.3].map(d => (
                    <motion.span key={d} className="w-1.5 h-1.5 rounded-full bg-violet-400"
                      animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
                      transition={{ duration: 0.8, delay: d, repeat: Infinity }} />
                  ))}
                  <span className="text-xs text-violet-600">Evaluating…</span>
                </div>
              </motion.div>
            )}

            {practice.phase === 'done' && practice.feedback && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="relative px-4 py-3 rounded-lg border border-violet-200 bg-violet-50">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-400 rounded-l-lg" />
                  <p className="text-[10px] font-semibold text-violet-600 mb-1">Question</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{practice.question}</p>
                </div>
                <div className="px-4 py-3 rounded-lg border border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-400 mb-1">Your answer</p>
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{practice.answer}</p>
                </div>
                {practice.warn && <p className="text-xs text-amber-600 px-1">{practice.warn}</p>}
                <div className="px-4 py-3 rounded-lg border border-green-200 bg-green-50">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">Got right</p>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{practice.feedback.gotRight}</p>
                </div>
                <div className="px-4 py-3 rounded-lg border border-red-200 bg-red-50">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">Missed</p>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{practice.feedback.missed}</p>
                </div>
                <div className="px-4 py-3 rounded-lg border border-blue-200 bg-blue-50">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Follow-up</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{practice.feedback.followUp}</p>
                </div>
                <div className={clsx('inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium', signalColor(practice.feedback.signal))}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                  {practice.feedback.signal}
                </div>
                <button
                  onClick={handleStartPractice}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-violet-200 text-violet-600 text-xs font-medium hover:bg-violet-50 hover:border-violet-300 active:scale-95 transition-all"
                >
                  New question
                </button>
              </motion.div>
            )}
          </div>
        )}

        {/* Ask AI tab */}
        {activeTab === 'ask' && (
          <div className="space-y-3">
            {miniMsgs.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {miniMsgs.map(msg => (
                    <motion.div key={msg.id}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {msg.role === 'user' && (
                        <div className="flex justify-end">
                          <div className="max-w-[80%] bg-blue-50 border border-blue-200 rounded-xl rounded-tr-sm px-3 py-2">
                            <p className="text-xs text-gray-800 leading-relaxed">{msg.text}</p>
                          </div>
                        </div>
                      )}
                      {msg.role === 'thinking' && (
                        <div className="flex gap-2 items-center">
                          <div className="w-5 h-5 rounded-full bg-white border border-blue-200 flex items-center justify-center shrink-0">
                            <span className="text-blue-600 font-bold" style={{ fontSize: 8 }}>AI</span>
                          </div>
                          <div className="inline-flex gap-1 px-3 py-2 bg-white border border-gray-200 rounded-xl rounded-tl-sm">
                            {[0, 0.2, 0.4].map(d => (
                              <motion.span key={d} className="w-1 h-1 rounded-full bg-gray-400"
                                animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                                transition={{ duration: 0.9, delay: d, repeat: Infinity }} />
                            ))}
                          </div>
                        </div>
                      )}
                      {msg.role === 'ai' && (
                        <div className="flex gap-2 items-start">
                          <div className="w-5 h-5 rounded-full bg-white border border-blue-200 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-blue-600 font-bold" style={{ fontSize: 8 }}>AI</span>
                          </div>
                          <div className="bg-white border border-gray-200 rounded-xl rounded-tl-sm px-3 py-2">
                            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{msg.text}</p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={chatEndRef} />
              </div>
            )}
            <div className="flex gap-2 items-end">
              <input
                type="text"
                value={miniInput}
                onChange={e => setMiniInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAskSend(); }}
                placeholder={`Ask about "${section.heading}"…`}
                disabled={miniWait}
                className="flex-1 bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors"
              />
              <button
                onClick={handleAskSend}
                disabled={!miniInput.trim() || miniWait}
                className={clsx(
                  'px-3 py-2 rounded border text-xs font-medium transition-all',
                  !miniInput.trim() || miniWait
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-white'
                    : 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 active:scale-95'
                )}
              >
                {miniWait ? '…' : 'Ask'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Module-level Ask AI chat ──────────────────────────────────────────────────

function AskAIChat({ studyContent }: { studyContent: StudySection[] }) {
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input,    setInput]    = useState('');
  const [waiting,  setWaiting]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const moduleContext = studyContent.map(s => `## ${s.heading}\n${s.body}`).join('\n\n');

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function buildAskPrompt(history: ChatMsg[], question: string) {
    const prior = history
      .filter((m): m is Extract<ChatMsg, { role: 'user' | 'ai' }> => m.role === 'user' || m.role === 'ai')
      .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.text}`)
      .join('\n');
    return `You are an expert ML engineer helping a student. Use the module content below as your primary reference. Be concise and practical — focus on production implications.\n\nMODULE CONTENT:\n${moduleContext}\n\n${prior ? `CONVERSATION SO FAR:\n${prior}\n` : ''}Student: ${question}\nTutor:`;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || waiting) return;
    const uid = `u${Date.now()}`; const tid = `t${Date.now()}`;
    setMessages(prev => [...prev, { id: uid, role: 'user', text }, { id: tid, role: 'thinking' }]);
    setInput(''); setWaiting(true);
    let warn = '';
    const res = await ask(buildAskPrompt(messages, text), buildSectionFallback(text), w => { warn = w; });
    setMessages(prev => [
      ...prev.filter(m => m.id !== tid),
      { id: `a${Date.now()}`, role: 'ai', text: res.text, source: res.source, warn },
    ]);
    setWaiting(false);
  }

  return (
    <div className="border border-blue-200 rounded-lg overflow-hidden bg-blue-50/30">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-blue-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-white border border-blue-200 flex items-center justify-center">
            <span className="text-xs text-blue-600 font-bold">AI</span>
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">Ask AI about this module</p>
            <p className="text-xs text-gray-500 mt-0.5">Covers all sections — trade-offs, edge cases, production context</p>
          </div>
        </div>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-blue-100"
          >
            <div className="px-4 py-4 space-y-3 max-h-80 overflow-y-auto bg-white">
              {messages.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  Ask anything about this module — concepts, trade-offs, examples…
                </p>
              )}
              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                    {msg.role === 'user' && (
                      <div className="flex justify-end">
                        <div className="max-w-[80%] bg-blue-50 border border-blue-200 rounded-2xl rounded-tr-sm px-3.5 py-2.5">
                          <p className="text-sm text-gray-800 leading-relaxed">{msg.text}</p>
                        </div>
                      </div>
                    )}
                    {msg.role === 'thinking' && (
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-white border border-blue-200 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs text-blue-600 font-bold">AI</span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-gray-200 rounded-2xl rounded-tl-sm">
                          {[0, 0.2, 0.4].map(d => (
                            <motion.span key={d} className="w-1.5 h-1.5 rounded-full bg-gray-300"
                              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                              transition={{ duration: 0.9, delay: d, repeat: Infinity }} />
                          ))}
                        </div>
                      </div>
                    )}
                    {msg.role === 'ai' && (
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-white border border-blue-200 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs text-blue-600 font-bold">AI</span>
                        </div>
                        <div className="flex-1 space-y-1">
                          {msg.warn && <p className="text-xs text-amber-600">{msg.warn}</p>}
                          <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{msg.text}</p>
                          </div>
                          <p className="text-xs text-gray-400 pl-1">
                            {msg.source === 'user-key' ? 'Your API key' : msg.source === 'server-key' ? 'Server AI' : 'Auto-answer'}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={bottomRef} />
            </div>

            <div className="px-4 pb-4 flex gap-2 items-end border-t border-gray-100 pt-3 bg-white">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(); }}
                placeholder="Ask a question… (Cmd+Enter to send)"
                rows={2}
                disabled={waiting}
                className="flex-1 bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 leading-relaxed focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 resize-none transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || waiting}
                className={clsx(
                  'px-4 py-2.5 rounded border text-xs font-medium transition-all self-end',
                  !input.trim() || waiting
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-white'
                    : 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 active:scale-95'
                )}
              >
                {waiting ? '…' : 'Send'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface StudyGuideViewerProps {
  studyContent:   StudySection[];
  moduleTitle:    string;
  moduleCategory: string;
  moduleDesc?:    string;
  accentColor?:   string;
  sectionCount?:  number;
}

export function StudyGuideViewer({
  studyContent, moduleTitle, moduleCategory, moduleDesc, accentColor = 'blue',
}: StudyGuideViewerProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [visited,     setVisited]     = useState<Set<number>>(() => { const s = new Set<number>(); s.add(0); return s; });
  const contentRef = useRef<HTMLDivElement>(null);

  const accent  = ACCENT[accentColor] ?? ACCENT.blue;
  const section = studyContent[selectedIdx];

  function goTo(i: number) {
    setSelectedIdx(i);
    setVisited(v => { const next = new Set(v); next.add(i); return next; });
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="flex border-t border-gray-200" style={{ height: 'calc(100vh - 48px)' }}>

      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-4 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <Link
            href="/study-guide"
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-3"
          >
            <ChevronLeft className="w-3 h-3" />
            Study Guide
          </Link>
          <h2 className="text-sm font-semibold text-gray-900 leading-snug">{moduleTitle}</h2>
          <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">{moduleCategory}</p>
          {moduleDesc && (
            <p className="text-[11px] text-gray-500 mt-2 leading-relaxed line-clamp-3">{moduleDesc}</p>
          )}
        </div>

        {/* Section list */}
        <nav className="flex-1 overflow-y-auto py-1">
          {studyContent.map((sec, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={clsx(
                'relative w-full text-left flex items-start gap-2.5 px-4 py-2.5 transition-colors',
                selectedIdx === i
                  ? accent.activeBg
                  : 'hover:bg-gray-50'
              )}
            >
              {selectedIdx === i && (
                <div className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r ${accent.bar}`} />
              )}
              <span className={clsx(
                'w-4 h-4 rounded-full shrink-0 flex items-center justify-center font-medium mt-0.5',
                'text-[9px]',
                selectedIdx === i
                  ? accent.numOn
                  : visited.has(i)
                  ? 'bg-gray-200 text-gray-500'
                  : accent.numOff
              )}>
                {i + 1}
              </span>
              <span className={clsx(
                'text-[11px] leading-relaxed line-clamp-2 flex-1',
                selectedIdx === i ? 'text-gray-900 font-medium' : visited.has(i) ? 'text-gray-600' : 'text-gray-400'
              )}>
                {sec.heading}
              </span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 shrink-0">
          <p className="text-[10px] text-gray-400">
            {visited.size} / {studyContent.length} sections visited
          </p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main ref={contentRef} className="flex-1 min-w-0 overflow-y-auto bg-gray-50/40">
        <div className="max-w-2xl mx-auto px-10 py-8">

          {/* Section header */}
          <div className="mb-6">
            <p className="text-[10px] text-gray-400 mb-1.5 uppercase tracking-wider font-medium">
              {selectedIdx + 1} of {studyContent.length}
            </p>
            <h1 className="text-lg font-semibold text-gray-900 leading-snug">
              {section.heading}
            </h1>
          </div>

          {/* Section content + tools — key resets state on navigation */}
          <SectionContent key={section.heading} section={section} />

          {/* Prev / Next navigation */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-200">
            <button
              onClick={() => goTo(Math.max(0, selectedIdx - 1))}
              disabled={selectedIdx === 0}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded border text-xs font-medium transition-all',
                selectedIdx === 0
                  ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 active:scale-95'
              )}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>

            <span className="text-xs text-gray-400 tabular-nums">
              {selectedIdx + 1} / {studyContent.length}
            </span>

            <button
              onClick={() => goTo(Math.min(studyContent.length - 1, selectedIdx + 1))}
              disabled={selectedIdx === studyContent.length - 1}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded border text-xs font-medium transition-all',
                selectedIdx === studyContent.length - 1
                  ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 active:scale-95'
              )}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Module-level Ask AI */}
          <div className="mt-8">
            <AskAIChat studyContent={studyContent} />
          </div>

        </div>
      </main>

    </div>
  );
}
