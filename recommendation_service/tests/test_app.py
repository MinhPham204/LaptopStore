"""FR_MLServiceRecommendEndpoint — Flask routes (app.py) with mocked recommend_core / health_info."""
from unittest.mock import MagicMock

import app as app_module


class TestHealth:
    def test_get_health_returns_200_with_health_info_fields(self, client, monkeypatch):
        monkeypatch.setattr(
            app_module,
            "health_info",
            lambda: {"ok": True, "items": 150, "x_all_shape": [150, 2]},
        )

        res = client.get("/health")

        assert res.status_code == 200
        data = res.get_json()
        assert data["ok"] is True
        assert data["items"] == 150
        assert data["x_all_shape"] == [150, 2]


class TestRecommendQuery:
    def test_get_recommend_query_returns_200_json_array(self, client, monkeypatch, sample_recommendations):
        mock_core = MagicMock(return_value=(sample_recommendations, 200))
        monkeypatch.setattr(app_module, "recommend_core", mock_core)

        res = client.get("/recommend?variation_id=42")

        assert res.status_code == 200
        assert res.get_json() == sample_recommendations
        mock_core.assert_called_once_with(42)

    def test_get_recommend_missing_variation_id_returns_400(self, client):
        res = client.get("/recommend")

        assert res.status_code == 400
        assert res.get_json() == {"error": "variation_id is required"}

    def test_get_recommend_invalid_variation_id_returns_400(self, client):
        res = client.get("/recommend?variation_id=abc")

        assert res.status_code == 400
        assert res.get_json() == {"error": "variation_id is required"}

    def test_get_recommend_not_found_returns_404(self, client, monkeypatch):
        monkeypatch.setattr(app_module, "recommend_core", lambda vid: (None, 404))

        res = client.get("/recommend?variation_id=999")

        assert res.status_code == 404
        assert res.get_json() == {"error": "variation_id not found"}


class TestRecommendPath:
    def test_get_recommend_path_returns_200_json_array(self, client, monkeypatch, sample_recommendations):
        mock_core = MagicMock(return_value=(sample_recommendations, 200))
        monkeypatch.setattr(app_module, "recommend_core", mock_core)

        res = client.get("/recommend/42")

        assert res.status_code == 200
        assert res.get_json() == sample_recommendations
        mock_core.assert_called_once_with(42)

    def test_get_recommend_path_not_found_returns_404(self, client, monkeypatch):
        monkeypatch.setattr(app_module, "recommend_core", lambda vid: (None, 404))

        res = client.get("/recommend/999")

        assert res.status_code == 404
        assert res.get_json() == {"error": "variation_id not found"}
