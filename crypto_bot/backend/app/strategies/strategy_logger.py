"""
Strategy Execution Logger — Human-Readable Reports
────────────────────────────────────────────────────
Generates a plain-English analysis report in:
  data/logs/strategies/analysis.log   ← one combined human-readable report per run
  data/logs/strategies/<id>.log       ← per-strategy technical log (optional)

Controls:
  strategy_logger.enabled            = True/False  (master switch)
  strategy_logger.verbose            = True/False  (include raw indicator values)
  strategy_logger.per_strategy_files = True/False  (individual files per strategy)
"""

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from loguru import logger as _sys_logger
from app.core.config import settings
from app.strategies.models import Signal, SignalType

# ── Directory ──────────────────────────────────────────────────────────── #
STRATEGY_LOG_DIR = os.path.join(settings.LOG_DIR, "strategies")
os.makedirs(STRATEGY_LOG_DIR, exist_ok=True)

# ── Helpers ────────────────────────────────────────────────────────────── #
_ARROWS = {SignalType.LONG: "▲ COMPRAR", SignalType.SHORT: "▼ VENDER",
           SignalType.EXIT: "◄ SALIR",   SignalType.HOLD:  "● ESPERAR"}

_CONF_LABEL = {
    (0.0, 0.3):  "Muy baja — señal débil, mejor ignorar",
    (0.3, 0.5):  "Baja — posible movimiento, sin confirmación",
    (0.5, 0.7):  "Moderada — señal válida pero con incertidumbre",
    (0.7, 0.85): "Alta — buena confirmación, riesgo aceptable",
    (0.85, 1.01): "Muy alta — señal fuerte, múltiples factores alineados",
}

def _conf_text(c: float) -> str:
    for (lo, hi), label in _CONF_LABEL.items():
        if lo <= c < hi:
            return label
    return "Desconocida"

def _bar(value: float, width: int = 20, fill: str = "█", empty: str = "░") -> str:
    filled = round(value * width)
    return fill * filled + empty * (width - filled)

def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

def _write(path: str, text: str):
    """Append directly to file — avoids loguru filter complexity."""
    with open(path, "a", encoding="utf-8") as f:
        f.write(text + "\n")


class StrategyExecutionLogger:
    """
    Human-readable strategy execution logger.

    Attributes
    ----------
    enabled            : master switch (bool)
    verbose            : include raw indicator values (bool)
    per_strategy_files : write one .log per strategy_id (bool)
    """

    def __init__(
        self,
        enabled: bool = True,
        verbose: bool = False,
        per_strategy_files: bool = True,
    ):
        self.enabled             = enabled
        self.verbose             = verbose
        self.per_strategy_files  = per_strategy_files

        self._analysis_path  = os.path.join(STRATEGY_LOG_DIR, "analysis.log")
        self._consensus_path = os.path.join(STRATEGY_LOG_DIR, "consensus.log")

    # ─── Public API ──────────────────────────────────────────────────────── #

    def log_run_start(self, symbol: str, timeframe: str, n_candles: int, strategies: List[str]):
        if not self.enabled:
            return
        header = (
            f"\n{'═'*72}\n"
            f"  ANÁLISIS DE MERCADO  │  {symbol}  │  Temporalidad: {timeframe}\n"
            f"  {_ts()}  │  Velas analizadas: {n_candles}  │  Estrategias: {len(strategies)}\n"
            f"{'═'*72}"
        )
        _write(self._analysis_path, header)

    def log_signal(
        self,
        signal: Signal,
        indicator_snapshot: Optional[Dict[str, Any]] = None,
        enabled: Optional[bool] = None,
    ):
        if not (self.enabled if enabled is None else enabled):
            return

        text = self._format_human_signal(signal, indicator_snapshot)
        _write(self._analysis_path, text)

        if self.per_strategy_files:
            path = os.path.join(STRATEGY_LOG_DIR, f"{signal.strategy_id}.log")
            _write(path, text)

    def log_consensus(
        self,
        consensus: Dict[str, Any],
        enabled: Optional[bool] = None,
    ):
        if not (self.enabled if enabled is None else enabled):
            return

        text = self._format_human_consensus(consensus)
        _write(self._analysis_path, text)
        _write(self._consensus_path, text)

    # ─── Formatting ──────────────────────────────────────────────────────── #

    def _format_human_signal(
        self,
        sig: Signal,
        snapshot: Optional[Dict[str, Any]],
    ) -> str:
        conf_pct  = sig.confidence * 100
        conf_bar  = _bar(sig.confidence)
        conf_desc = _conf_text(sig.confidence)
        arrow     = _ARROWS.get(sig.signal, "?")

        lines = [
            f"\n  ┌─ {sig.strategy_name.upper()} ─────────────────────────────────────────",
            f"  │  Señal:       {arrow}",
            f"  │  Confianza:   {conf_pct:5.1f}%  [{conf_bar}]",
            f"  │               → {conf_desc}",
            f"  │",
            f"  │  Análisis:    {sig.reasoning}",
            f"  │",
            f"  │  Gestión de riesgo:",
            f"  │    Stop Loss      : {sig.risk.get('stop_loss_pct', 0)*100:.2f}%  "
                f"(si el precio baja {sig.risk.get('stop_loss_pct', 0)*100:.2f}%, salir automáticamente)",
            f"  │    Take Profit    : {sig.risk.get('take_profit_pct', 0)*100:.2f}%  "
                f"(objetivo de ganancia)",
            f"  │    Tamaño máximo  : {sig.risk.get('max_position_pct', 0)*100:.0f}% del portafolio",
        ]

        # Per-strategy sub-score explanation
        extra = self._strategy_explanation(sig, snapshot)
        if extra:
            lines.append(f"  │")
            lines.append(f"  │  Factores parciales:")
            for e in extra:
                lines.append(f"  │    {e}")

        if self.verbose and snapshot:
            lines.append(f"  │")
            lines.append(f"  │  Indicadores en la última vela:")
            skip = {"time", "open", "high", "low", "close", "volume"}
            for k, v in snapshot.items():
                if k not in skip and v is not None:
                    val = f"{v:.4f}" if isinstance(v, float) else str(v)
                    lines.append(f"  │    {k:<22} {val}")

        lines.append(f"  └──────────────────────────────────────────────────────────────")
        return "\n".join(lines)

    def _strategy_explanation(
        self, sig: Signal, snapshot: Optional[Dict[str, Any]]
    ) -> List[str]:
        """Return human-readable partial factor breakdown per strategy."""
        if snapshot is None:
            return []

        sid = sig.strategy_id
        lines: List[str] = []

        def pct(v): return f"{v*100:.1f}%"
        def bar(v, lo, hi):
            """Position bar from lo to hi."""
            if hi == lo:
                return "░░░░░░░░░░"
            ratio = max(0.0, min(1.0, (v - lo) / (hi - lo)))
            return _bar(ratio, width=10)

        if sid == "trend_following":
            ema20  = snapshot.get("ema_20")
            ema50  = snapshot.get("ema_50")
            ema200 = snapshot.get("ema_200")
            adx    = snapshot.get("adx", 0) or 0
            macd   = snapshot.get("macd", 0) or 0
            price  = snapshot.get("close", 0)
            adx_thr = sig.risk.get("adx_threshold", 25)

            if ema20 and ema50 and ema200:
                stack_ok = price > ema20 > ema50 > ema200
                stack_label = "✓ Alcista (precio > EMA20 > EMA50 > EMA200)" if stack_ok else \
                              "✗ Sin alineación completa de EMAs"
                lines.append(f"Alineación de tendencia : {stack_label}")

            adx_label = f"✓ Tendencia fuerte ({adx:.1f} > {adx_thr})" if adx > adx_thr \
                        else f"✗ Tendencia débil ({adx:.1f} < {adx_thr} — umbral mínimo)"
            lines.append(f"Fuerza de tendencia (ADX): {adx_label}  [{bar(adx, 0, 60)}]")

            macd_label = "✓ Impulso alcista" if macd > 0 else "✗ Impulso bajista"
            lines.append(f"Impulso (MACD)           : {macd_label}  ({macd:.2f})")

        elif sid == "mean_reversion":
            rsi     = snapshot.get("rsi", 50) or 50
            bb_high = snapshot.get("bb_high")
            bb_low  = snapshot.get("bb_low")
            price   = snapshot.get("close", 0)
            ovs     = sig.risk.get("rsi_oversold", 30)
            ovb     = sig.risk.get("rsi_overbought", 70)

            rsi_label = (
                f"✓ Sobrevendido ({rsi:.1f} < {ovs}) — posible rebote alcista" if rsi < ovs else
                f"✓ Sobrecomprado ({rsi:.1f} > {ovb}) — posible corrección bajista" if rsi > ovb else
                f"● Neutral ({rsi:.1f}) — entre {ovs} y {ovb}"
            )
            lines.append(f"RSI [{bar(rsi/100, 0, 1)}] {rsi:.1f}/100  →  {rsi_label}")

            if bb_high and bb_low:
                bb_pos = (price - bb_low) / (bb_high - bb_low) if bb_high != bb_low else 0.5
                pos_desc = (
                    "cerca del límite inferior (zona de compra)" if bb_pos < 0.2 else
                    "cerca del límite superior (zona de venta)" if bb_pos > 0.8 else
                    "dentro de las bandas (zona neutral)"
                )
                lines.append(
                    f"Posición en Bollinger  : {bb_pos*100:.0f}% del ancho  →  {pos_desc}"
                )

        elif sid == "breakout_volume":
            vol     = snapshot.get("volume", 0) or 0
            vol_sma = snapshot.get("volume_sma", 1) or 1
            obv     = snapshot.get("obv", 0) or 0
            resist  = snapshot.get("resistance")
            support = snapshot.get("support")
            price   = snapshot.get("close", 0)
            mult    = vol / vol_sma

            lines.append(
                f"Volumen vs promedio : {mult:.1f}×  {'✓ Pico de volumen detectado' if mult >= 1.5 else '✗ Volumen insuficiente para confirmar'}"
            )
            if resist:
                dist_r = (price / resist - 1) * 100
                lines.append(
                    f"Distancia a resistencia: {dist_r:+.2f}%  "
                    f"({'✓ POR ENCIMA — ruptura' if dist_r > 0.2 else '● Por debajo — sin ruptura'})"
                )
            if support:
                dist_s = (price / support - 1) * 100
                lines.append(
                    f"Distancia a soporte    : {dist_s:+.2f}%  "
                    f"({'✓ POR DEBAJO — quiebre' if dist_s < -0.2 else '● Por encima — soporte respetado'})"
                )
            lines.append(
                f"OBV (flujo acumulado)  : {obv:,.0f}  "
                f"({'▲ acumulación' if obv > 0 else '▼ distribución'})"
            )

        elif sid == "order_flow":
            meta = sig.metadata
            score = meta.get("score", 0)
            rsi   = meta.get("rsi", 50) or 50
            macd  = meta.get("macd", 0) or 0
            adxp  = meta.get("adx_pos", 0) or 0
            adxn  = meta.get("adx_neg", 0) or 0
            vwap  = meta.get("vwap")
            price = meta.get("price", 0)

            lines.append(f"Puntuación de consenso : {score}/4  ({_bar(abs(score)/4, width=12)})")
            lines.append(f"  • MACD vs señal      : {'✓ alcista' if macd > 0 else '✗ bajista'}  ({macd:.2f})")
            lines.append(f"  • RSI momentum       : {'✓ >55 alcista' if rsi > 55 else '✗ <45 bajista' if rsi < 45 else '● neutral'}  ({rsi:.1f})")
            lines.append(f"  • ADX D+/D-          : {'✓ comprador' if adxp > adxn else '✗ vendedor'}  (+DI={adxp:.1f} / -DI={adxn:.1f})")
            if vwap:
                lines.append(
                    f"  • Precio vs VWAP     : {'✓ por encima (institucional alcista)' if price > vwap else '✗ por debajo (institucional bajista)'}  (VWAP={vwap:.2f})"
                )

        return lines

    def _format_human_consensus(self, consensus: Dict[str, Any]) -> str:
        direction = consensus.get("direction", "HOLD")
        conf      = consensus.get("confidence", 0.0)
        votes     = consensus.get("votes", {})
        n         = consensus.get("n_signals", 0)
        signals   = consensus.get("signals", [])

        # Direction label
        dir_labels = {
            "LONG":  "COMPRAR  ▲  (sesgo alcista)",
            "SHORT": "VENDER   ▼  (sesgo bajista)",
            "EXIT":  "SALIR    ◄  (cerrar posición)",
            "HOLD":  "ESPERAR  ●  (sin señal clara)",
        }
        dir_label = dir_labels.get(direction, direction)
        conf_desc = _conf_text(conf)

        # Vote table
        total_votes = sum(votes.values()) or 1.0
        vote_lines  = []
        for label, vote_key, icon in [
            ("Comprar (LONG)",   "LONG",  "▲"),
            ("Vender  (SHORT)",  "SHORT", "▼"),
            ("Salir   (EXIT)",   "EXIT",  "◄"),
            ("Esperar (HOLD)",   "HOLD",  "●"),
        ]:
            v    = votes.get(vote_key, 0.0)
            pct  = (v / total_votes) * 100
            bar  = _bar(pct / 100, width=16)
            vote_lines.append(f"  │  {icon} {label:<18} {pct:5.1f}%  [{bar}]  peso={v:.2f}")

        # Per-signal summary table
        sig_table = []
        for s in signals:
            sname = s.get("strategy_name", "?")[:22]
            ssig  = s.get("signal", "HOLD")
            # Handle both enum and string representations
            if hasattr(ssig, "value"):
                ssig = ssig.value
            elif isinstance(ssig, str) and ssig.startswith("SignalType."):
                ssig = ssig.split(".")[-1]
            sconf = s.get("confidence", 0.0) * 100
            arr   = {"LONG": "▲", "SHORT": "▼", "EXIT": "◄", "HOLD": "●"}.get(ssig, "?")
            sig_table.append(
                f"  │  {arr} {sname:<25}  {ssig:<6}  {sconf:5.1f}%  [{_bar(s.get('confidence',0), width=12)}]"
            )

        body = "\n".join([
            f"\n{'═'*72}",
            f"  RECOMENDACIÓN FINAL  │  {_ts()}",
            f"{'═'*72}",
            f"  Decisión    : {dir_label}",
            f"  Confianza   : {conf*100:.1f}%  [{_bar(conf)}]",
            f"               → {conf_desc}",
            f"  Estrategias : {n} analizadas",
            f"",
            f"  Desglose de votos:",
            *vote_lines,
            f"",
            f"  Detalle por estrategia:",
            *sig_table,
            f"{'─'*72}",
        ])
        return body


# Global singleton
strategy_logger = StrategyExecutionLogger(
    enabled=True,
    verbose=False,
    per_strategy_files=True,
)
