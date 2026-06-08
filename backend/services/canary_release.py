import random


def _rand(base: float, pct: float) -> float:
    return round(base + (random.random() - 0.5) * 2 * base * pct, 2)


def champion_metrics() -> dict:
    return {
        'p99':        _rand(80, 0.03),
        'error_rate': _rand(0.2, 0.1),
        'psi':        0.0,
    }


def canary_metrics(fault: str) -> dict:
    if fault == 'latency':
        return {'p99': _rand(128, 0.12), 'error_rate': _rand(0.28, 0.3), 'psi': _rand(0.03, 0.4)}
    if fault == 'errors':
        return {'p99': _rand(84,  0.08), 'error_rate': _rand(3.8,  0.2), 'psi': _rand(0.04, 0.3)}
    if fault == 'drift':
        return {'p99': _rand(83,  0.08), 'error_rate': _rand(0.28, 0.3), 'psi': _rand(0.19, 0.15)}
    return     {'p99': _rand(82,  0.07), 'error_rate': _rand(0.25, 0.3), 'psi': _rand(0.02, 0.5)}


def eval_gates(champion: dict, canary: dict) -> dict:
    return {
        'p99':        'pass' if canary['p99'] / champion['p99'] <= 1.05 else 'fail',
        'error_rate': 'pass' if canary['error_rate'] < 1.0             else 'fail',
        'psi':        'pass' if canary['psi'] < 0.1                    else 'fail',
    }


def simulate(stage_pct: int, fault: str) -> dict:
    champion = champion_metrics()
    canary   = canary_metrics(fault)
    gates    = eval_gates(champion, canary)
    return {'champion': champion, 'canary': canary, 'gates': gates}
