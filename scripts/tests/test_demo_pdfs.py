import importlib.util
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("demo_pdfs", ROOT / "scripts/generate-demo-pdfs.py")
demo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(demo)


class DemoPdfTests(unittest.TestCase):
    def test_reissue_changes_identity_but_preserves_products_and_reproducibility(self):
        original = demo.load_scenario()
        first = demo.load_scenario("visitor-a")
        repeated = demo.load_scenario("visitor-a")
        second = demo.load_scenario("visitor-b")
        self.assertEqual(first, repeated)
        keys = set()
        for scenario in [original, first, second]:
            for kind in ["initial", "followup"]:
                invoice = scenario[kind]
                self.assertRegex(invoice["accessKey"], r"^\d{44}$")
                self.assertEqual(invoice["products"], original[kind]["products"])
                keys.add(invoice["accessKey"])
        self.assertEqual(len(keys), 6)

    def test_pdfs_contain_complete_synthetic_document_without_clipping_to_extra_pages(self):
        with tempfile.TemporaryDirectory() as directory:
            scenario = demo.load_scenario("test-render")
            demo.generate(Path(directory), scenario)
            for kind, name in [("initial", "demo-inicial.pdf"), ("followup", "demo-completa.pdf")]:
                reader = PdfReader(Path(directory) / name)
                self.assertEqual(len(reader.pages), 1)
                text = reader.pages[0].extract_text()
                self.assertIn("SEM VALOR FISCAL", text)
                self.assertIn(scenario[kind]["accessKey"], text)
                for product in scenario[kind]["products"]:
                    self.assertIn(product["code"], text)
                    self.assertIn(product["description"], text)


if __name__ == "__main__":
    unittest.main()
