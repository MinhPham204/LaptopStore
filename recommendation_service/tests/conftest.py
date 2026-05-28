"""
Pytest fixtures for Flask app tests without loading recommend.py artifacts at import-time.
"""
import sys
import types

import pytest

DEFAULT_HEALTH = {"ok": True, "items": 50, "x_all_shape": [50, 2]}


def _default_health_info():
    return dict(DEFAULT_HEALTH)


def _default_recommend_core(variation_id):
    return [], 200


# Stub core.recommend before app.py imports the real module (loads pickle/joblib/npy).
if "core.recommend" not in sys.modules:
    _core_pkg = types.ModuleType("core")
    _core_pkg.__path__ = []
    _recommend_mod = types.ModuleType("core.recommend")
    _recommend_mod.health_info = _default_health_info
    _recommend_mod.recommend_core = _default_recommend_core
    _core_pkg.recommend = _recommend_mod
    sys.modules["core"] = _core_pkg
    sys.modules["core.recommend"] = _recommend_mod

import app as app_module  # noqa: E402
from app import app  # noqa: E402


@pytest.fixture
def client():
    app.config["TESTING"] = True
    return app.test_client()


@pytest.fixture(autouse=True)
def reset_app_hooks(monkeypatch):
    """Restore default mocks on app-bound functions after each test."""
    monkeypatch.setattr(app_module, "health_info", _default_health_info)
    monkeypatch.setattr(app_module, "recommend_core", _default_recommend_core)


@pytest.fixture
def sample_recommendations():
    return [
        {
            "variation_id": 45,
            "product_id": 12,
            "product_name": "Laptop XYZ",
            "price": 22000000.0,
            "performance_score": 82.5,
            "cpu_source": "json-exact",
            "gpu_source": "json-contains",
            "score_source": "cpu:json-exact,gpu:json-contains",
            "source": "indexed",
        }
    ]
