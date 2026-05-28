"""FR_TrainRecommendationModelOffline — pure functions and mocked main() pipeline."""
import numpy as np
import pandas as pd
import pytest

import train_recommend as tr


@pytest.fixture
def sample_training_df():
    return pd.DataFrame(
        [
            {
                "variation_id": 101,
                "product_id": 10,
                "product_name": "Laptop Alpha",
                "processor": "Intel Core i7",
                "ram": "16GB",
                "storage": "512GB SSD",
                "graphics_card": "NVIDIA GeForce RTX 4060",
                "price": 22_000_000,
            },
            {
                "variation_id": 102,
                "product_id": 11,
                "product_name": "Laptop Beta",
                "processor": "AMD Ryzen 5",
                "ram": "32GB",
                "storage": "1TB SSD",
                "graphics_card": "NVIDIA GeForce RTX 4070",
                "price": 28_000_000,
            },
        ]
    )


@pytest.fixture
def cpu_bench_exact_row():
    simple = tr.simplify_cpu_name("Intel Core i7")
    return pd.DataFrame(
        [
            {
                "name": "Intel Core i7-12700",
                "name_lc": "intel core i7-12700",
                "simple": simple,
                "tokens": tr.tokens(simple),
                "score": 2500.0,
                "count": 100,
            }
        ]
    )


@pytest.fixture
def gpu_bench_fuzzy_rows():
    simple_match = tr.simplify_gpu_name("GeForce RTX 4060")
    return pd.DataFrame(
        [
            {
                "name": "GTX 1050",
                "name_lc": "gtx 1050",
                "simple": "gtx 1050",
                "tokens": tr.tokens("gtx 1050"),
                "score": 1200.0,
                "count": 50,
            },
            {
                "name": "GeForce RTX 4060",
                "name_lc": "geforce rtx 4060",
                "simple": simple_match,
                "tokens": tr.tokens(simple_match),
                "score": 4800.0,
                "count": 200,
            },
        ]
    )


class TestTextHelpers:
    def test_jaccard_identical_sets_returns_one(self):
        s = {"intel", "core", "i7"}
        assert tr.jaccard(s, s) == 1.0

    def test_jaccard_empty_set_returns_zero(self):
        assert tr.jaccard(set(), {"a"}) == 0.0
        assert tr.jaccard({"a"}, set()) == 0.0

    def test_simplify_cpu_name_normalizes_intel_core(self):
        result = tr.simplify_cpu_name("Intel Core i7")
        assert "i7" in result
        assert "intel" not in result
        assert "core" not in result


class TestBestMatchScore:
    def test_best_match_score_empty_query_returns_none(self, cpu_bench_exact_row):
        assert tr.best_match_score("", cpu_bench_exact_row, is_cpu=True) == (None, None)
        assert tr.best_match_score(None, cpu_bench_exact_row, is_cpu=True) == (None, None)

    def test_best_match_score_exact_match_returns_json_exact(self, cpu_bench_exact_row):
        score, source = tr.best_match_score("Intel Core i7", cpu_bench_exact_row, is_cpu=True)

        assert source == "json-exact"
        assert score == 2500.0

    def test_best_match_score_fuzzy_returns_json_contains(self, gpu_bench_fuzzy_rows):
        score, source = tr.best_match_score(
            "NVIDIA GeForce RTX 4060 8GB",
            gpu_bench_fuzzy_rows,
            is_cpu=False,
        )

        assert source == "json-contains"
        assert score == 4800.0


class TestRuleScores:
    def test_score_ram_16gb_returns_rule_score(self):
        assert tr.score_ram("16GB") == 70

    def test_score_storage_1tb_returns_rule_score(self):
        assert tr.score_storage("1TB SSD") == 80

    def test_fallback_cpu_score_tier(self):
        assert tr.fallback_cpu_score("Intel Core i7") == 80
        assert tr.fallback_cpu_score("Unknown Celeron") == 40

    def test_fallback_gpu_score_tier(self):
        assert tr.fallback_gpu_score("NVIDIA RTX 4060") == 85
        assert tr.fallback_gpu_score("Unknown GPU") == 20


class TestMainPipeline:
    def test_main_writes_four_artifact_files(
        self, tmp_path, monkeypatch, sample_training_df
    ):
        monkeypatch.setattr(tr, "ARTIFACTS_DIR", str(tmp_path))
        monkeypatch.setattr(tr, "fetch_data_from_db", lambda: sample_training_df)
        monkeypatch.setattr(
            tr, "load_benchmarks", lambda path, is_cpu=True: pd.DataFrame()
        )

        tr.main()

        assert (tmp_path / "scaler.joblib").is_file()
        assert (tmp_path / "products_df_from_db.pkl").is_file()
        assert (tmp_path / "knn_X_all.npy").is_file()
        assert (tmp_path / "knn_variation_ids.npy").is_file()

        X = np.load(tmp_path / "knn_X_all.npy")
        var_ids = np.load(tmp_path / "knn_variation_ids.npy")
        assert X.shape[0] == 2
        assert X.shape[1] == 2
        assert len(var_ids) == 2

    def test_main_returns_early_when_db_dataframe_empty(self, tmp_path, monkeypatch):
        monkeypatch.setattr(tr, "ARTIFACTS_DIR", str(tmp_path))
        monkeypatch.setattr(tr, "fetch_data_from_db", lambda: pd.DataFrame())

        tr.main()

        assert not (tmp_path / "scaler.joblib").exists()

    def test_main_propagates_when_fetch_data_from_db_raises(self, monkeypatch):
        def _boom():
            raise RuntimeError("DATABASE_URL missing in .env")

        monkeypatch.setattr(tr, "fetch_data_from_db", _boom)

        with pytest.raises(RuntimeError, match="DATABASE_URL missing"):
            tr.main()
