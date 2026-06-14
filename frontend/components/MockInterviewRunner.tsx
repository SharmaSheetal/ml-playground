'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { ask, type LLMSource } from '@/lib/llm';
import { InterviewPDFModal, type SessionAnswer } from './InterviewPDFModal';

/* ── Shared types ─────────────────────────────────────────────────────────── */
export interface InterviewQ {
  id?:         string;
  difficulty:  'junior' | 'mid' | 'senior';
  question:    string;
  answer?:     string;
  modelAnswer?: string;
  keyPoints:   string[];
  trap?:       string;
}

export interface StudySection { heading: string; body: string; }

type DynamicQ = { isDynamic: true; question: string; difficulty: 'senior'; keyPoints: [] };

type Message =
  | { id: string; kind: 'question';      q: InterviewQ | DynamicQ }
  | { id: string; kind: 'user';          text: string }
  | { id: string; kind: 'thinking' }
  | { id: string; kind: 'gen-question' }
  | { id: string; kind: 'feedback';      parsed: ParsedFeedback; source: LLMSource; warn: string; qIdx: number };

type SignalLevel = 'pass' | 'borderline' | 'fail';

interface ParsedFeedback {
  gotRight: string;
  missed:   string;
  followUp: string;
  signal:   string;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function signalLevel(sig: string): SignalLevel {
  if (/strong pass/i.test(sig)) return 'pass';
  if (/borderline/i.test(sig))  return 'borderline';
  return 'fail';
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseResponse(text: string): ParsedFeedback {
  const get = (key: string) => {
    const m = text.match(new RegExp(`${key}:([\\s\\S]*?)(?=GOT RIGHT:|MISSED:|FOLLOW-UP:|SIGNAL:|$)`, 'i'));
    return m ? m[1].trim() : '';
  };
  return {
    gotRight: get('GOT RIGHT'),
    missed:   get('MISSED'),
    followUp: get('FOLLOW-UP'),
    signal:   get('SIGNAL'),
  };
}

function buildPrompt(q: InterviewQ | DynamicQ, answer: string, moduleContext: string): string {
  const hasPts = q.keyPoints.length > 0;
  return `You are a senior ML engineer conducting a technical interview.

Question: "${q.question}"
${hasPts
    ? `\nKey points a strong answer covers:\n${q.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}${(q as InterviewQ).trap ? `\nCommon trap: ${(q as InterviewQ).trap}` : ''}`
    : `\nReference material:\n${moduleContext.slice(0, 3000)}`
  }

Candidate's answer: "${answer}"

Respond in this exact format - be specific, reference their actual words:

GOT RIGHT:
[bullet points of what they covered, or "- Nothing substantial" if weak]

MISSED:
[bullet points of key gaps, or "- Nothing major" if complete]

FOLLOW-UP:
[one sharp follow-up question]

SIGNAL: [Strong pass / Borderline / Would not pass] - [one sentence why]`;
}

function buildFallback(q: InterviewQ | DynamicQ, answer: string): string {
  if (q.keyPoints.length === 0) {
    const words     = answer.toLowerCase().split(/\W+/).filter(w => w.length > 5);
    const technical = ['canary','traffic','latency','p99','rollback','deploy','model','inference','serving','monitor','gate','psi','drift'].filter(t => words.includes(t));
    const signal    = technical.length >= 4 ? 'Strong pass' : technical.length >= 2 ? 'Borderline' : 'Would not pass';
    return `GOT RIGHT:\n• Addressed the question with relevant concepts\n\nMISSED:\n• Specific production numbers and failure mode details\n\nFOLLOW-UP:\nHow would you validate this decision in a real production rollout?\n\nSIGNAL: ${signal} - Based on technical depth detected.`;
  }
  const lower  = answer.toLowerCase();
  const hits   = q.keyPoints.filter(kp => kp.toLowerCase().split(/\s+/).some(w => w.length > 5 && lower.includes(w)));
  const misses = q.keyPoints.filter(kp => !hits.includes(kp));
  const ratio  = hits.length / Math.max(q.keyPoints.length, 1);
  const signal = ratio >= 0.7 ? 'Strong pass' : ratio >= 0.4 ? 'Borderline' : 'Would not pass';
  return [
    `GOT RIGHT:\n${hits.length ? hits.map(h => `• ${h}`).join('\n') : '• - Nothing substantial detected'}`,
    `MISSED:\n${misses.length ? misses.map(m => `• ${m}`).join('\n') : '• - Nothing major'}`,
    (q as InterviewQ).trap ? `FOLLOW-UP:\n${(q as InterviewQ).trap}` : 'FOLLOW-UP:\nCan you walk me through a real example from your experience?',
    `SIGNAL: ${signal} - Based on keyword coverage of key points.`,
  ].join('\n\n');
}

/* ── Bubble components ────────────────────────────────────────────────────── */
const DIFFICULTY_STYLE = {
  junior: 'text-green-700  border-green-200  bg-green-50',
  mid:    'text-amber-700  border-amber-200  bg-amber-50',
  senior: 'text-red-700    border-red-200    bg-red-50',
};

function InterviewerBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-white border border-blue-200 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-xs text-blue-600 font-bold">AI</span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] bg-blue-50 border border-blue-200 rounded-2xl rounded-tr-sm px-4 py-3">
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <InterviewerBubble>
      <div className="inline-flex items-center gap-1.5 px-4 py-3 bg-white border border-gray-200 rounded-2xl rounded-tl-sm">
        {[0, 0.2, 0.4].map(delay => (
          <motion.span
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-gray-300"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
            transition={{ duration: 0.9, delay, repeat: Infinity }}
          />
        ))}
      </div>
    </InterviewerBubble>
  );
}

function QuestionBubble({ q, moduleCategory, moduleTitle }: {
  q: InterviewQ | DynamicQ;
  moduleCategory: string;
  moduleTitle: string;
}) {
  const isDyn = (q as DynamicQ).isDynamic;
  return (
    <InterviewerBubble>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {isDyn ? 'AI Generated' : `${moduleCategory} · ${moduleTitle}`}
          </span>
          <span className={clsx('text-xs px-2 py-0.5 rounded border',
            isDyn ? 'text-violet-700 border-violet-200 bg-violet-50' : DIFFICULTY_STYLE[q.difficulty])}>
            {isDyn ? 'extended' : q.difficulty}
          </span>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3.5">
          <p className="text-gray-900 text-sm leading-relaxed">{q.question}</p>
        </div>
      </div>
    </InterviewerBubble>
  );
}

function FeedbackBubble({ parsed, source, warn }: { parsed: ParsedFeedback; source: LLMSource; warn: string }) {
  const isPass       = /strong pass/i.test(parsed.signal);
  const isBorderline = /borderline/i.test(parsed.signal);

  const cards = [
    { label: 'Got Right', text: parsed.gotRight, cls: 'border-green-200 bg-green-50', labelCls: 'text-green-700', bodyCls: 'text-gray-700' },
    { label: 'Missed',    text: parsed.missed,   cls: 'border-red-200   bg-red-50',   labelCls: 'text-red-700',   bodyCls: 'text-gray-700' },
    { label: 'Follow-up', text: parsed.followUp, cls: 'border-blue-200  bg-blue-50',  labelCls: 'text-blue-700',  bodyCls: 'text-gray-700 italic' },
  ].filter(c => c.text);

  return (
    <InterviewerBubble>
      <div className="space-y-2.5 max-w-[90%]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">
            {source === 'user-key' ? 'Your API key' : source === 'server-key' ? 'Server AI' : 'Auto-evaluated'}
          </span>
          {warn && <span className="text-xs text-amber-600">{warn}</span>}
        </div>

        {cards.map(({ label, text, cls, labelCls, bodyCls }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12, duration: 0.2 }}
            className={clsx('rounded-lg border px-4 py-3 space-y-1.5', cls)}
          >
            <p className={clsx('text-xs font-semibold uppercase tracking-wider', labelCls)}>{label}</p>
            <p className={clsx('text-sm leading-relaxed whitespace-pre-line', bodyCls)}>{text}</p>
          </motion.div>
        ))}

        {parsed.signal && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: cards.length * 0.12, duration: 0.2 }}
            className={clsx(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-medium',
              isPass       ? 'border-green-200 bg-green-50  text-green-700' :
              isBorderline ? 'border-amber-200 bg-amber-50  text-amber-700' :
                             'border-red-200   bg-red-50    text-red-700'
            )}
          >
            <span className={clsx('w-1.5 h-1.5 rounded-full', isPass ? 'bg-green-500' : isBorderline ? 'bg-amber-500' : 'bg-red-500')} />
            {parsed.signal}
          </motion.div>
        )}
      </div>
    </InterviewerBubble>
  );
}

/* ── Completion modal ─────────────────────────────────────────────────────── */
function CompletionModal({ total, signals, onFresh, onContinue, onShowPDF }: {
  total:      number;
  signals:    (SignalLevel | undefined)[];
  onFresh:    () => void;
  onContinue: () => void;
  onShowPDF:  () => void;
}) {
  const answered    = signals.filter(Boolean).length;
  const passes      = signals.filter(s => s === 'pass').length;
  const borderlines = signals.filter(s => s === 'borderline').length;
  const fails       = signals.filter(s => s === 'fail').length;
  const allStrong   = passes === answered && answered > 0;

  const DOT: Record<string, string> = {
    pass: 'bg-green-500', borderline: 'bg-amber-400', fail: 'bg-red-400', undefined: 'bg-gray-200',
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onContinue} />
      <motion.div
        className="relative z-10 w-full max-w-sm bg-white border border-gray-200 rounded-xl p-7 shadow-xl shadow-gray-200/60"
        initial={{ scale: 0.88, opacity: 0, y: 20 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.88, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        <div className="flex justify-center mb-5">
          <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
            <span className="text-xl font-bold text-blue-600">{allStrong ? '★' : '✓'}</span>
          </div>
        </div>

        <h2 className="text-center text-base font-semibold text-gray-900 mb-1">
          {allStrong ? 'Outstanding!' : 'Session complete'}
        </h2>
        <p className="text-center text-xs text-gray-500 mb-5">
          {allStrong
            ? `All ${answered} questions - Strong pass`
            : `You covered all ${total} topics in this round`}
        </p>

        <div className="flex justify-center gap-1.5 flex-wrap mb-4">
          {signals.map((s, i) => (
            <motion.div
              key={i}
              className={clsx('w-2.5 h-2.5 rounded-full', DOT[s ?? 'undefined'])}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 400 }}
              title={s ?? 'unanswered'}
            />
          ))}
        </div>

        {answered > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-6">
            {[
              { label: 'Strong',     count: passes,      cls: 'text-green-700 border-green-200 bg-green-50' },
              { label: 'Borderline', count: borderlines,  cls: 'text-amber-700 border-amber-200 bg-amber-50' },
              { label: 'Weak',       count: fails,        cls: 'text-red-700   border-red-200   bg-red-50'   },
            ].map(({ label, count, cls }) => (
              <motion.div key={label} className={clsx('rounded-lg border px-2 py-2.5 text-center', cls)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <p className="text-lg font-bold tabular-nums">{count}</p>
                <p className="text-xs opacity-70">{label}</p>
              </motion.div>
            ))}
          </div>
        )}

        <div className="space-y-2.5">
          <button onClick={onContinue} className="w-full py-2.5 rounded-lg border border-blue-300 text-blue-700 bg-blue-50 text-sm font-medium hover:bg-blue-100 active:scale-95 transition-all">
            Keep going
          </button>
          <button onClick={onShowPDF} className="w-full py-2.5 rounded-lg border border-gray-200 text-gray-700 bg-white text-sm font-medium hover:border-gray-300 hover:bg-gray-50 active:scale-95 transition-all">
            Interview preparation guide
          </button>
          <button onClick={onFresh} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Start fresh
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */
export interface MockInterviewRunnerProps {
  interviewQA:    InterviewQ[];
  studyContent:   StudySection[];
  moduleTitle:    string;
  moduleCategory: string;
}

export function MockInterviewRunner({
  interviewQA, studyContent, moduleTitle, moduleCategory,
}: MockInterviewRunnerProps) {
  const moduleContext = studyContent.map(s => `## ${s.heading}\n${s.body}`).join('\n\n');
  const staticCount   = interviewQA.length;

  const [questions,      setQuestions]      = useState<InterviewQ[]>(() => shuffled(interviewQA));
  const [idx,            setIdx]            = useState(0);
  const [messages,       setMessages]       = useState<Message[]>([{ id: 'q0', kind: 'question', q: questions[0] }]);
  const [signals,        setSignals]        = useState<(SignalLevel | undefined)[]>(() => new Array(staticCount).fill(undefined));
  const [input,          setInput]          = useState('');
  const [waiting,        setWaiting]        = useState(false);
  const [showModel,      setShowModel]      = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showPDFModal,   setShowPDFModal]   = useState(false);
  const [sessionAnswers, setSessionAnswers] = useState<SessionAnswer[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function nextQuestion() {
    const next = idx + 1;
    if (next >= questions.length) {
      setShowCompletion(true);
      return;
    }
    setIdx(next);
    setMessages(prev => [...prev, { id: `q${next}`, kind: 'question', q: questions[next] }]);
    setInput('');
    setShowModel(false);
  }

  async function handleKeepGoing() {
    setShowCompletion(false);
    const genId   = `gen${Date.now()}`;
    const nextIdx = questions.length;

    setMessages(prev => [...prev, { id: genId, kind: 'gen-question' }]);
    setInput('');
    setShowModel(false);

    const coveredTopics = studyContent.map(s => s.heading).join(', ');
    const prompt = `You are a senior ML engineer conducting an extended technical interview on ${moduleCategory} - ${moduleTitle}.

The candidate has already answered questions covering: ${coveredTopics}.

Generate ONE new advanced question that probes an aspect not yet covered - focus on system design trade-offs, cross-cutting concerns, debugging production incidents, or nuanced edge cases specific to ${moduleTitle}.

Return only the question. No preamble.`;

    const fallback = `An ML model you deployed 3 months ago suddenly shows a 20% drop in a business metric but all infrastructure SLOs look healthy. Walk me through how you diagnose this.`;

    const res  = await ask(prompt, fallback);
    const dynQ: DynamicQ = { isDynamic: true, question: res.text.trim(), difficulty: 'senior', keyPoints: [] };

    setQuestions(prev => [...prev, dynQ as unknown as InterviewQ]);
    setSignals(prev  => [...prev, undefined]);
    setIdx(nextIdx);
    setMessages(prev => [
      ...prev.filter(m => m.id !== genId),
      { id: `q${nextIdx}`, kind: 'question', q: dynQ },
    ]);
  }

  function handleStartFresh() {
    const freshQs = shuffled(interviewQA);
    setQuestions(freshQs);
    setSignals(new Array(freshQs.length).fill(undefined));
    setIdx(0);
    setMessages([{ id: 'q0', kind: 'question', q: freshQs[0] }]);
    setInput('');
    setShowModel(false);
    setShowCompletion(false);
    setShowPDFModal(false);
    setSessionAnswers([]);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || waiting) return;

    const q      = questions[idx];
    const qIndex = idx;
    const uid    = `u${Date.now()}`;
    const tid    = `t${Date.now()}`;

    setMessages(prev => [...prev, { id: uid, kind: 'user', text }, { id: tid, kind: 'thinking' }]);
    setInput('');
    setWaiting(true);

    let warn = '';
    const res    = await ask(buildPrompt(q, text, moduleContext), buildFallback(q, text), w => { warn = w; });
    const parsed = parseResponse(res.text);

    setSignals(prev => {
      const next = [...prev];
      next[qIndex] = signalLevel(parsed.signal);
      return next;
    });

    if (qIndex < staticCount) {
      setSessionAnswers(prev => {
        const filtered = prev.filter(sa => sa.question !== q.question);
        return [...filtered, {
          question:   q.question,
          difficulty: q.difficulty,
          userAnswer: text,
          gotRight:   parsed.gotRight,
          missed:     parsed.missed,
          followUp:   parsed.followUp,
          signal:     signalLevel(parsed.signal),
        }];
      });
    }

    setMessages(prev => [
      ...prev.filter(m => m.id !== tid),
      { id: `f${Date.now()}`, kind: 'feedback', parsed, source: res.source, warn, qIdx: qIndex },
    ]);
    setWaiting(false);
  }

  const lastMsg       = messages[messages.length - 1];
  const feedbackShown = lastMsg?.kind === 'feedback';
  const currentQ      = questions[idx] as (InterviewQ & { isDynamic?: boolean });
  const isLastStatic  = idx >= staticCount - 1 && !(currentQ as unknown as DynamicQ).isDynamic;

  const dotColor = (i: number) => {
    const s = signals[i];
    if (s === 'pass')       return 'bg-green-500';
    if (s === 'borderline') return 'bg-amber-400';
    if (s === 'fail')       return 'bg-red-400';
    if (i === idx)          return 'bg-blue-500 ring-2 ring-blue-200';
    return 'bg-gray-200';
  };

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              {moduleCategory} · {moduleTitle}
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">
              Answer as you would in a real interview. AI evaluates your response.
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {questions.slice(0, staticCount).map((_, i) => (
              <motion.div
                key={i}
                className={clsx('w-2 h-2 rounded-full transition-colors duration-500', dotColor(i))}
                animate={i === idx ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.4 }}
              />
            ))}
            <span className="text-xs text-gray-400 ml-1 tabular-nums">
              {idx + 1}/{staticCount}
              {questions.length > staticCount && (
                <span className="text-violet-600"> +{questions.length - staticCount}</span>
              )}
            </span>
          </div>
        </div>

        {/* Chat window */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2">
          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {msg.kind === 'question' && (
                  <QuestionBubble q={msg.q as InterviewQ} moduleCategory={moduleCategory} moduleTitle={moduleTitle} />
                )}
                {msg.kind === 'user'         && <UserBubble text={msg.text} />}
                {msg.kind === 'thinking'     && <ThinkingBubble />}
                {msg.kind === 'gen-question' && (
                  <InterviewerBubble>
                    <div className="flex items-center gap-2 px-4 py-3 bg-white border border-violet-200 rounded-2xl rounded-tl-sm">
                      {[0, 0.2, 0.4].map(d => (
                        <motion.span key={d} className="w-1.5 h-1.5 rounded-full bg-violet-400"
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                          transition={{ duration: 0.9, delay: d, repeat: Infinity }} />
                      ))}
                      <span className="text-xs text-violet-600 ml-1">Generating next question…</span>
                    </div>
                  </InterviewerBubble>
                )}
                {msg.kind === 'feedback' && (
                  <FeedbackBubble parsed={msg.parsed} source={msg.source} warn={msg.warn} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Model answer */}
          {feedbackShown && !currentQ.isDynamic && (currentQ.answer || currentQ.modelAnswer || currentQ.keyPoints.length > 0) && (
            <div className="pl-10">
              <button
                onClick={() => setShowModel(v => !v)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showModel ? '▲ Hide model answer' : '▼ See model answer + key points'}
              </button>
              <AnimatePresence>
                {showModel && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-3 border-l-2 border-gray-200 pl-4">
                      {(currentQ.answer || currentQ.modelAnswer) && (
                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                          {currentQ.answer ?? currentQ.modelAnswer}
                        </p>
                      )}
                      <div className="space-y-1">
                        {currentQ.keyPoints.map((kp, i) => (
                          <div key={i} className="flex gap-2 text-xs text-gray-500">
                            <span className="text-blue-500 shrink-0">•</span>
                            <span>{kp}</span>
                          </div>
                        ))}
                      </div>
                      {currentQ.trap && (
                        <div className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50">
                          <p className="text-xs font-semibold text-amber-700 mb-0.5">TRAP</p>
                          <p className="text-xs text-gray-600">{currentQ.trap}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="shrink-0 pt-3 border-t border-gray-200 space-y-2">
          {feedbackShown ? (
            <div className="flex justify-between items-center">
              {!currentQ.isDynamic && (currentQ.answer || currentQ.modelAnswer || currentQ.keyPoints.length > 0) ? (
                <button
                  onClick={() => setShowModel(v => !v)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showModel ? 'Hide answer' : 'Model answer'}
                </button>
              ) : <div />}
              <button
                onClick={nextQuestion}
                className="px-5 py-2 rounded-lg border border-blue-300 text-blue-700 bg-blue-50 text-xs font-medium hover:bg-blue-100 active:scale-95 transition-all"
              >
                {isLastStatic ? 'See results' : 'Next question'}
              </button>
            </div>
          ) : (
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(); }}
                placeholder="Type your answer… (Cmd+Enter to send)"
                rows={3}
                disabled={waiting}
                className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 leading-relaxed focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 resize-none transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || waiting}
                className={clsx(
                  'px-4 py-3 rounded-lg border text-xs font-medium transition-all self-end',
                  !input.trim() || waiting
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-white'
                    : 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 active:scale-95'
                )}
              >
                {waiting ? '…' : 'Send'}
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Completion modal */}
      <AnimatePresence>
        {showCompletion && !showPDFModal && (
          <CompletionModal
            total={staticCount}
            signals={signals.slice(0, staticCount)}
            onFresh={handleStartFresh}
            onContinue={handleKeepGoing}
            onShowPDF={() => { setShowCompletion(false); setShowPDFModal(true); }}
          />
        )}
      </AnimatePresence>

      {/* Interview PDF modal */}
      <AnimatePresence>
        {showPDFModal && (
          <InterviewPDFModal
            interviewQA={interviewQA}
            moduleTitle={moduleTitle}
            moduleCategory={moduleCategory}
            sessionAnswers={sessionAnswers}
            onClose={() => setShowPDFModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
