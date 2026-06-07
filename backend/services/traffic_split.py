import random
from models.deployment import VersionProfile


def _jitter(base: float, pct: float = 0.12) -> float:
    return round(base * (1 + (random.random() * 2 - 1) * pct), 1)


def _degradation_multipliers(mode: str, ticks: int) -> dict:
    if mode == 'latency':
        return {'p50': 8, 'p99': 9, 'err': 3}
    if mode == 'errors':
        return {'p50': 1.2, 'p99': 2, 'err': 60}
    # gradual
    m = min(10.0, 1 + ticks * 0.2)
    return {'p50': m, 'p99': m * 1.25, 'err': m * 2}


def compute_metrics(
    degraded:  bool,
    traffic:   int,
    profile:   VersionProfile,
    mode:      str,
    ticks:     int,
    total_rps: int,
) -> dict:
    p50  = profile.p50
    p99  = profile.p99
    err  = profile.error_rate

    if degraded:
        m   = _degradation_multipliers(mode, ticks)
        p50 = profile.p50 * m['p50']
        p99 = profile.p99 * m['p99']
        err = max(profile.error_rate * m['err'], 15) if mode == 'errors' else profile.error_rate * m['err']

    p95 = p50 + (p99 - p50) * 0.55

    return {
        'p50':        _jitter(p50),
        'p95':        _jitter(p95),
        'p99':        _jitter(p99),
        'error_rate': round(err * (1 + (random.random() - 0.5) * 0.2), 2),
        'rps':        round((traffic / 100) * total_rps),
        'status':     'degraded' if degraded else 'healthy',
    }


def simulate(
    v1_traffic:       int,
    v1_degraded:      bool,
    v2_degraded:      bool,
    degradation_mode: str,
    v1_profile:       VersionProfile,
    v2_profile:       VersionProfile,
    total_rps:        int = 1000,
    ticks_v1:         int = 0,
    ticks_v2:         int = 0,
) -> dict:
    return {
        'v1': compute_metrics(v1_degraded, v1_traffic,       v1_profile, degradation_mode, ticks_v1, total_rps),
        'v2': compute_metrics(v2_degraded, 100 - v1_traffic, v2_profile, degradation_mode, ticks_v2, total_rps),
    }
