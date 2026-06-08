import random

TOTAL_RPS = 500


def _rand(base: float, pct: float) -> float:
    return round(base + (random.random() - 0.5) * 2 * base * pct, 2)


def champion_metrics() -> dict:
    return {
        'p99':        _rand(85, 0.05),
        'error_rate': _rand(0.3, 0.15),
        'rps':        TOTAL_RPS,
    }


def shadow_metrics(fault: str, mirror_pct: int) -> dict:
    shadow_rps = round(TOTAL_RPS * mirror_pct / 100)
    if fault == 'latency':
        return {'p99': _rand(160, 0.10), 'error_rate': _rand(0.4,  0.15), 'rps': shadow_rps}
    if fault == 'errors':
        return {'p99': _rand(90,  0.08), 'error_rate': _rand(4.5,  0.20), 'rps': shadow_rps}
    if fault == 'divergence':
        return {'p99': _rand(88,  0.06), 'error_rate': _rand(0.4,  0.15), 'rps': shadow_rps}
    return         {'p99': _rand(87,  0.07), 'error_rate': _rand(0.35, 0.15), 'rps': shadow_rps}


def divergence_metrics(fault: str) -> dict:
    if fault == 'divergence':
        return {'exact_match': _rand(61, 0.08), 'delta_p95': _rand(0.18, 0.15), 'ndcg': _rand(0.72, 0.08)}
    if fault == 'latency':
        return {'exact_match': _rand(91, 0.04), 'delta_p95': _rand(0.04, 0.20), 'ndcg': _rand(0.94, 0.03)}
    if fault == 'errors':
        return {'exact_match': _rand(88, 0.05), 'delta_p95': _rand(0.05, 0.20), 'ndcg': _rand(0.92, 0.03)}
    return         {'exact_match': _rand(94, 0.03), 'delta_p95': _rand(0.03, 0.25), 'ndcg': _rand(0.96, 0.02)}


def eval_gates(champion: dict, shadow: dict, div: dict) -> dict:
    return {
        'latency':    'pass' if shadow['p99'] / champion['p99'] <= 1.2 else 'fail',
        'errors':     'pass' if shadow['error_rate'] < 2.0             else 'fail',
        'divergence': 'pass' if div['exact_match'] >= 80               else 'fail',
        'ndcg':       'pass' if div['ndcg'] >= 0.85                    else 'fail',
    }


def simulate(mirror_pct: int, fault: str) -> dict:
    champion = champion_metrics()
    shadow   = shadow_metrics(fault, mirror_pct)
    div      = divergence_metrics(fault)
    gates    = eval_gates(champion, shadow, div)
    return {'champion': champion, 'shadow': shadow, 'divergence': div, 'gates': gates}
