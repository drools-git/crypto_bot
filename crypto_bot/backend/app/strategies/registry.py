"""
Strategy Registry — Singleton that maps strategy_id → strategy class.

New strategies register themselves with @registry.register; the core engine
never needs to be modified.

Usage:
    from app.strategies.registry import registry

    @registry.register
    class MyNewStrategy(BaseStrategy):
        strategy_id = "my_new"
        ...
"""
from typing import Dict, Type
from loguru import logger
from app.strategies.base import BaseStrategy


class StrategyRegistry:
    def __init__(self):
        self._strategies: Dict[str, Type[BaseStrategy]] = {}

    def register(self, cls: Type[BaseStrategy]) -> Type[BaseStrategy]:
        """Decorator — register a strategy class by its strategy_id."""
        sid = cls.strategy_id
        if sid in self._strategies:
            logger.warning(f"[Registry] Overwriting existing strategy '{sid}'")
        self._strategies[sid] = cls
        logger.debug(f"[Registry] Registered strategy '{sid}' ({cls.strategy_name})")
        return cls

    def get(self, strategy_id: str) -> Type[BaseStrategy]:
        if strategy_id not in self._strategies:
            raise KeyError(f"Strategy '{strategy_id}' is not registered.")
        return self._strategies[strategy_id]

    def list_all(self) -> Dict[str, Type[BaseStrategy]]:
        return dict(self._strategies)

    def all_ids(self) -> list:
        return list(self._strategies.keys())


# Global singleton
registry = StrategyRegistry()
