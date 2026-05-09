"""Quick script to trigger strategy consensus and show the generated log."""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def main():
    import numpy as np
    import pandas as pd
    from app.strategies.manager import strategy_manager
    from app.market.market_data_manager import market_data_engine
    from app.indicators.engine import indicator_engine

    print("Fetching market data...")
    klines = await market_data_engine.get_historical_ohlcv("BTC/USDT", "1h", 400)
    df = pd.DataFrame([{
        "time": k.time, "open": k.open, "high": k.high,
        "low": k.low, "close": k.close, "volume": k.volume,
    } for k in klines])

    print(f"Enriching {len(df)} candles with indicators...")
    df = indicator_engine.add_indicators(df)
    df = df.replace([np.inf, -np.inf], np.nan)

    print("Running strategies...")
    signals = strategy_manager.run_all(df, "BTC/USDT", "1h")
    consensus = strategy_manager.get_consensus(signals)

    print(f"\n✓ Done. Generated logs in data/logs/strategies/")
    print(f"  Direction : {consensus['direction']}")
    print(f"  Confidence: {consensus['confidence']*100:.1f}%")
    print(f"  Votes     : {consensus['votes']}")

asyncio.run(main())
