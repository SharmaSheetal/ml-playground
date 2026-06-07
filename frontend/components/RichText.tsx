'use client';

import { Fragment } from 'react';
import { Tooltip, JARGON } from '@/modules/deployment/traffic-split/Tooltip';

// Map of exact string (case-sensitive match attempted, then case-insensitive) → JARGON key.
// Longer phrases must come before shorter ones so they match first.
const TERM_MAP: Array<{ pattern: string; key: keyof typeof JARGON }> = [
  // Multi-word phrases first (longer → shorter to avoid partial matches)
  { pattern: 'champion/challenger',   key: 'champChallenger'   },
  { pattern: 'Champion/Challenger',   key: 'champChallenger'   },
  { pattern: 'distribution shift',    key: 'distributionShift' },
  { pattern: 'Distribution shift',    key: 'distributionShift' },
  { pattern: 'Distribution Shift',    key: 'distributionShift' },
  { pattern: 'feedback loop',         key: 'feedbackLoop'      },
  { pattern: 'Feedback loop',         key: 'feedbackLoop'      },
  { pattern: 'Feedback Loop',         key: 'feedbackLoop'      },
  { pattern: 'dynamic batching',      key: 'dynamicBatching'   },
  { pattern: 'Dynamic batching',      key: 'dynamicBatching'   },
  { pattern: 'Dynamic Batching',      key: 'dynamicBatching'   },
  { pattern: 'feature store',         key: 'featureStore'      },
  { pattern: 'Feature store',         key: 'featureStore'      },
  { pattern: 'Feature Store',         key: 'featureStore'      },
  { pattern: 'feature flag',          key: 'featureFlag'       },
  { pattern: 'Feature flag',          key: 'featureFlag'       },
  { pattern: 'Feature Flag',          key: 'featureFlag'       },
  { pattern: 'dark launch',           key: 'darkLaunch'        },
  { pattern: 'Dark launch',           key: 'darkLaunch'        },
  { pattern: 'Dark Launch',           key: 'darkLaunch'        },
  { pattern: 'liveness probe',        key: 'liveness'          },
  { pattern: 'Liveness probe',        key: 'liveness'          },
  { pattern: 'Liveness Probe',        key: 'liveness'          },
  { pattern: 'readiness probe',       key: 'readiness'         },
  { pattern: 'Readiness probe',       key: 'readiness'         },
  { pattern: 'Readiness Probe',       key: 'readiness'         },
  { pattern: 'shadow mode',           key: 'shadowMode'        },
  { pattern: 'Shadow mode',           key: 'shadowMode'        },
  { pattern: 'Shadow Mode',           key: 'shadowMode'        },
  { pattern: 'blue/green',            key: 'blueGreen'         },
  { pattern: 'Blue/Green',            key: 'blueGreen'         },
  { pattern: 'Blue/green',            key: 'blueGreen'         },
  { pattern: 'error rate',            key: 'errorRate'         },
  { pattern: 'Error rate',            key: 'errorRate'         },
  { pattern: 'Error Rate',            key: 'errorRate'         },
  // New multi-word phrases (longer → shorter)
  { pattern: 'speculative decoding',       key: 'speculativeDecoding' },
  { pattern: 'Speculative decoding',       key: 'speculativeDecoding' },
  { pattern: 'Speculative Decoding',       key: 'speculativeDecoding' },
  { pattern: 'knowledge distillation',     key: 'distillation'        },
  { pattern: 'Knowledge distillation',     key: 'distillation'        },
  { pattern: 'Knowledge Distillation',     key: 'distillation'        },
  { pattern: 'model registry',             key: 'modelRegistry'       },
  { pattern: 'Model registry',             key: 'modelRegistry'       },
  { pattern: 'Model Registry',             key: 'modelRegistry'       },
  { pattern: 'multi-armed bandit',         key: 'mab'                 },
  { pattern: 'Multi-armed bandit',         key: 'mab'                 },
  { pattern: 'Multi-Armed Bandit',         key: 'mab'                 },
  { pattern: 'post-training quantization', key: 'ptq'                 },
  { pattern: 'Post-Training Quantization', key: 'ptq'                 },
  { pattern: 'quantization-aware training', key: 'qat'                },
  { pattern: 'Quantization-Aware Training', key: 'qat'                },
  // Single words last
  { pattern: 'rollback',              key: 'rollback'          },
  { pattern: 'Rollback',              key: 'rollback'          },
  { pattern: 'PSI',                   key: 'psi'               },
  { pattern: 'SLO',                   key: 'slo'               },
  { pattern: 'SLOs',                  key: 'slo'               },
  { pattern: 'canary',                key: 'canary'            },
  { pattern: 'Canary',                key: 'canary'            },
  { pattern: 'P99',                   key: 'p99'               },
  { pattern: 'P95',                   key: 'p95'               },
  { pattern: 'P50',                   key: 'p50'               },
  { pattern: 'RPS',                   key: 'rps'               },
  { pattern: 'degraded',              key: 'degraded'          },
  { pattern: 'Degraded',              key: 'degraded'          },
  { pattern: 'KEDA',                  key: 'keda'              },
  { pattern: 'PTQ',                   key: 'ptq'               },
  { pattern: 'QAT',                   key: 'qat'               },
  { pattern: 'OpenTelemetry',         key: 'openTelemetry'     },
];

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build one regex that matches any term (longer phrases first to avoid partial matches)
const PATTERN = new RegExp(
  `(${TERM_MAP.map(t => escapeRegex(t.pattern)).join('|')})`,
  'g'
);

function processLine(line: string): React.ReactNode {
  const parts = line.split(PATTERN);
  return parts.map((part, i) => {
    const entry = TERM_MAP.find(t => t.pattern === part);
    if (entry) {
      const meta = JARGON[entry.key];
      return (
        <Tooltip key={i} term={meta.term} definition={meta.definition}>
          {part}
        </Tooltip>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

interface RichTextProps {
  text: string;
  className?: string;
}

export function RichText({ text, className }: RichTextProps) {
  const lines = text.split('\n');
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {processLine(line)}
          {i < lines.length - 1 && '\n'}
        </Fragment>
      ))}
    </span>
  );
}
