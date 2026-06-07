'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { ask, type LLMSource } from '@/lib/llm';
import { RichText } from '@/components/RichText';
import {
  popQuestion, pushQuestions, needsRefill,
  quizKey, practiceKey, buildBatchPrompt, parseQuestionBatch,
} from '@/lib/questionCache';
import type { StudySection } from '@/modules/deployment/traffic-split/content';

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
  if (sig.toLowerCase().includes('strong')) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/8';
  if (sig.toLowerCase().includes('borderline')) return 'text-amber-400 border-amber-500/30 bg-amber-500/8';
  return 'text-red-400 border-red-500/30 bg-red-500/8';
}

// ── SectionCard ───────────────────────────────────────────────────────────────

function SectionCard({ section }: { section: StudySection }) {
  const [open,      setOpen]      = useState(false);
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
    setOpen(true); setActiveTab('quiz');
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
    <div className="border border-slate-800 rounded-xl overflow-visible">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-900/40 transition-colors rounded-xl"
      >
        <span className="text-sm font-semibold text-slate-200">{section.heading}</span>
        <span className="text-slate-600 text-xs ml-4 shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-visible"
          >
            <div className="px-5 pb-5 border-t border-slate-800 space-y-4">
              <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line pt-4">
                <RichText text={section.body} />
              </p>

              <div className="border-t border-slate-800/60 pt-3">
                <div className="flex items-center gap-1 mb-3">
                  {(['quiz', 'practice', 'ask'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={clsx(
                        'px-3 py-1.5 text-xs font-mono rounded-lg border transition-all',
                        activeTab === tab
                          ? tab === 'practice'
                            ? 'border-violet-500/50 bg-violet-500/8 text-violet-400'
                            : 'border-indigo-500/50 bg-indigo-500/8 text-indigo-400'
                          : 'border-slate-800 text-slate-600 hover:text-slate-400 hover:border-slate-700'
                      )}
                    >
                      {tab === 'quiz' ? '✦ Quiz me' : tab === 'practice' ? '⚡ Practice' : '✧ Ask AI'}
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
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all',
                        quiz.phase === 'loading'
                          ? 'border-indigo-600/30 text-indigo-400/50 cursor-not-allowed'
                          : 'border-indigo-600/50 text-indigo-400 hover:border-indigo-400 hover:bg-indigo-500/5 active:scale-95'
                      )}
                    >
                      {quiz.phase === 'loading' ? (
                        <>
                          <motion.span className="w-1.5 h-1.5 rounded-full bg-indigo-400"
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
                          className="relative px-4 py-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5"
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500/50 rounded-l-xl" />
                          <p className="text-xs font-mono text-indigo-400 uppercase tracking-widest mb-2">Interview question</p>
                          {quiz.warn && <p className="text-xs text-amber-400 font-mono mb-1">{quiz.warn}</p>}
                          <p className="text-sm text-slate-200 leading-relaxed">{quiz.question}</p>
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
                        <p className="text-xs text-slate-500 font-mono">
                          AI generates a question → you answer → AI evaluates with structured feedback.
                        </p>
                        <button
                          onClick={handleStartPractice}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-600/50 text-violet-400 text-xs font-mono hover:border-violet-400 hover:bg-violet-500/5 active:scale-95 transition-all"
                        >
                          ⚡ Start interview practice
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
                        <span className="text-xs text-violet-400 font-mono">Generating question…</span>
                      </div>
                    )}

                    {practice.phase === 'answering' && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                        <div className="relative px-4 py-3.5 rounded-xl border border-violet-500/25 bg-violet-500/5">
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-500/60 rounded-l-xl" />
                          <p className="text-xs font-mono text-violet-400 uppercase tracking-widest mb-2">Question</p>
                          <p className="text-sm text-slate-200 leading-relaxed">{practice.question}</p>
                        </div>
                        <textarea
                          ref={answerRef}
                          value={practice.answer}
                          onChange={e => setPractice(p => ({ ...p, answer: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitAnswer(); }}
                          placeholder="Type your answer… (⌘ Enter to submit)"
                          rows={4}
                          className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 font-mono leading-relaxed focus:outline-none focus:border-violet-500/50 resize-none transition-colors"
                        />
                        <button
                          onClick={handleSubmitAnswer}
                          disabled={!practice.answer.trim()}
                          className={clsx(
                            'px-4 py-2 rounded-lg border text-xs font-mono font-semibold transition-all',
                            !practice.answer.trim()
                              ? 'border-slate-800 text-slate-700 cursor-not-allowed'
                              : 'border-violet-600/50 text-violet-400 hover:border-violet-400 hover:bg-violet-500/5 active:scale-95'
                          )}
                        >
                          Submit answer
                        </button>
                      </motion.div>
                    )}

                    {practice.phase === 'evaluating' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                        <div className="relative px-4 py-3.5 rounded-xl border border-violet-500/25 bg-violet-500/5">
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-500/60 rounded-l-xl" />
                          <p className="text-xs font-mono text-violet-400 uppercase tracking-widest mb-2">Question</p>
                          <p className="text-sm text-slate-200 leading-relaxed">{practice.question}</p>
                        </div>
                        <div className="px-4 py-3 rounded-xl border border-slate-800 bg-slate-900/30 opacity-60">
                          <p className="text-xs text-slate-500 font-mono mb-1">Your answer</p>
                          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">{practice.answer}</p>
                        </div>
                        <div className="flex items-center gap-2 py-1">
                          {[0, 0.15, 0.3].map(d => (
                            <motion.span key={d} className="w-1.5 h-1.5 rounded-full bg-violet-400"
                              animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
                              transition={{ duration: 0.8, delay: d, repeat: Infinity }} />
                          ))}
                          <span className="text-xs text-violet-400 font-mono">Evaluating…</span>
                        </div>
                      </motion.div>
                    )}

                    {practice.phase === 'done' && practice.feedback && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                        <div className="relative px-4 py-3 rounded-xl border border-violet-500/20 bg-violet-500/4">
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-500/50 rounded-l-xl" />
                          <p className="text-xs font-mono text-violet-400 mb-1">Question</p>
                          <p className="text-xs text-slate-300 leading-relaxed">{practice.question}</p>
                        </div>
                        <div className="px-4 py-3 rounded-xl border border-slate-800 bg-slate-900/20">
                          <p className="text-xs text-slate-600 font-mono mb-1">Your answer</p>
                          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">{practice.answer}</p>
                        </div>
                        {practice.warn && <p className="text-xs text-amber-400 font-mono px-1">{practice.warn}</p>}
                        <div className="px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                          <p className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest mb-2">Got right</p>
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{practice.feedback.gotRight}</p>
                        </div>
                        <div className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
                          <p className="text-xs font-mono font-bold text-red-400 uppercase tracking-widest mb-2">Missed</p>
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{practice.feedback.missed}</p>
                        </div>
                        <div className="px-4 py-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
                          <p className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest mb-2">Follow-up</p>
                          <p className="text-xs text-slate-300 leading-relaxed">{practice.feedback.followUp}</p>
                        </div>
                        <div className={clsx('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono font-semibold', signalColor(practice.feedback.signal))}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                          {practice.feedback.signal}
                        </div>
                        <button
                          onClick={handleStartPractice}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-600/40 text-violet-400/70 text-xs font-mono hover:border-violet-500/60 hover:text-violet-400 hover:bg-violet-500/5 active:scale-95 transition-all"
                        >
                          ⚡ New question
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Ask AI tab */}
                {activeTab === 'ask' && (
                  <div className="space-y-3">
                    {miniMsgs.length > 0 && (
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        <AnimatePresence initial={false}>
                          {miniMsgs.map(msg => (
                            <motion.div key={msg.id}
                              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              {msg.role === 'user' && (
                                <div className="flex justify-end">
                                  <div className="max-w-[80%] bg-indigo-600/12 border border-indigo-500/20 rounded-xl rounded-tr-sm px-3 py-2">
                                    <p className="text-xs text-slate-300 leading-relaxed">{msg.text}</p>
                                  </div>
                                </div>
                              )}
                              {msg.role === 'thinking' && (
                                <div className="flex gap-2 items-center">
                                  <div className="w-5 h-5 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                                    <span className="text-indigo-400 font-bold" style={{ fontSize: 8 }}>AI</span>
                                  </div>
                                  <div className="inline-flex gap-1 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl rounded-tl-sm">
                                    {[0, 0.2, 0.4].map(d => (
                                      <motion.span key={d} className="w-1 h-1 rounded-full bg-slate-500"
                                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                                        transition={{ duration: 0.9, delay: d, repeat: Infinity }} />
                                    ))}
                                  </div>
                                </div>
                              )}
                              {msg.role === 'ai' && (
                                <div className="flex gap-2 items-start">
                                  <div className="w-5 h-5 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-indigo-400 font-bold" style={{ fontSize: 8 }}>AI</span>
                                  </div>
                                  <div className="bg-slate-800/60 border border-slate-700 rounded-xl rounded-tl-sm px-3 py-2">
                                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{msg.text}</p>
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
                        className="flex-1 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-indigo-500/50 transition-colors"
                      />
                      <button
                        onClick={handleAskSend}
                        disabled={!miniInput.trim() || miniWait}
                        className={clsx(
                          'px-3 py-2 rounded-lg border text-xs font-mono transition-all',
                          !miniInput.trim() || miniWait
                            ? 'border-slate-800 text-slate-700 cursor-not-allowed'
                            : 'border-indigo-600/50 text-indigo-400 hover:border-indigo-400 hover:bg-indigo-500/5 active:scale-95'
                        )}
                      >
                        {miniWait ? '…' : 'Ask'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
    <div className="border border-indigo-500/20 rounded-xl overflow-hidden bg-indigo-500/3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-indigo-500/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <span className="text-xs text-indigo-400 font-bold font-mono">AI</span>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-200">Ask AI</p>
            <p className="text-xs text-slate-500 mt-0.5">Clarify anything from this module</p>
          </div>
        </div>
        <span className="text-slate-600 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-indigo-500/15"
          >
            <div className="px-4 py-4 space-y-3 max-h-80 overflow-y-auto">
              {messages.length === 0 && (
                <p className="text-xs text-slate-600 text-center font-mono py-4">
                  Ask anything about this module — concepts, trade-offs, examples…
                </p>
              )}
              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                    {msg.role === 'user' && (
                      <div className="flex justify-end">
                        <div className="max-w-[80%] bg-indigo-600/15 border border-indigo-500/25 rounded-2xl rounded-tr-sm px-3.5 py-2.5">
                          <p className="text-sm text-slate-200 leading-relaxed">{msg.text}</p>
                        </div>
                      </div>
                    )}
                    {msg.role === 'thinking' && (
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs text-indigo-400 font-bold font-mono">AI</span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800/60 border border-slate-700 rounded-2xl rounded-tl-sm">
                          {[0, 0.2, 0.4].map(d => (
                            <motion.span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-500"
                              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                              transition={{ duration: 0.9, delay: d, repeat: Infinity }} />
                          ))}
                        </div>
                      </div>
                    )}
                    {msg.role === 'ai' && (
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs text-indigo-400 font-bold font-mono">AI</span>
                        </div>
                        <div className="flex-1 space-y-1">
                          {msg.warn && <p className="text-xs text-amber-400 font-mono">{msg.warn}</p>}
                          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{msg.text}</p>
                          </div>
                          <p className="text-xs font-mono text-slate-700 pl-1">
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

            <div className="px-4 pb-4 flex gap-2 items-end border-t border-indigo-500/10 pt-3">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(); }}
                placeholder="Ask a question… (⌘ Enter to send)"
                rows={2}
                disabled={waiting}
                className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 font-mono leading-relaxed focus:outline-none focus:border-indigo-500/50 resize-none transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || waiting}
                className={clsx(
                  'px-4 py-2.5 rounded-xl border text-xs font-mono font-semibold transition-all self-end',
                  !input.trim() || waiting
                    ? 'border-slate-800 text-slate-700 cursor-not-allowed'
                    : 'border-indigo-600/50 text-indigo-400 hover:border-indigo-400 hover:bg-indigo-500/5 active:scale-95'
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
  studyContent:     StudySection[];
  moduleTitle:      string;
  moduleCategory:   string;
  accentColor?:     string; // tailwind color name e.g. 'blue', 'amber'
  sectionCount?:    number;
}

export function StudyGuideViewer({
  studyContent, moduleTitle, moduleCategory, accentColor = 'indigo',
}: StudyGuideViewerProps) {
  return (
    <div className="space-y-6">
      {/* Module label */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full bg-${accentColor}-500`} />
        <span className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-widest">
          {moduleCategory} — {moduleTitle}
        </span>
        <span className="ml-auto text-xs text-slate-600">{studyContent.length} sections</span>
      </div>

      {/* Section cards */}
      <div className="space-y-3">
        {studyContent.map(section => (
          <SectionCard key={section.heading} section={section} />
        ))}
      </div>

      {/* Module-level Ask AI */}
      <AskAIChat studyContent={studyContent} />
    </div>
  );
}
