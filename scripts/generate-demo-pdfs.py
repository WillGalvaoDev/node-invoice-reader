"""Gera exemplos locais; não acessa banco, API nem credenciais."""
import argparse
import hashlib
import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]


def load_scenario(run_id=None):
    scenario = json.loads((ROOT / "examples/demo/scenario.json").read_text(encoding="utf-8"))
    if run_id is not None:
        for kind, invoice in scenario.items():
            digest = hashlib.sha256(f"docscan-demo:{run_id}:{kind}".encode()).digest()
            invoice["accessKey"] = f"{int.from_bytes(digest) % (10 ** 44):044d}"
    return scenario


def money(value):
    return f"{value:.2f}".replace(".", ",")


def generate(output_dir, scenario):
    output_dir.mkdir(parents=True, exist_ok=True)
    navy = colors.HexColor("#17324D")
    body = ParagraphStyle("body", fontName="Helvetica", fontSize=10, leading=15, textColor=navy)
    title = ParagraphStyle("title", parent=body, fontName="Helvetica-Bold", fontSize=23, leading=29)
    small = ParagraphStyle("small", parent=body, fontSize=8, leading=12)
    cell = ParagraphStyle("cell", parent=body, fontSize=9, leading=12)
    for kind, filename in [("initial", "demo-inicial.pdf"), ("followup", "demo-completa.pdf")]:
        invoice = scenario[kind]
        document = SimpleDocTemplate(str(output_dir / filename), pagesize=A4,
                                     rightMargin=42, leftMargin=42, topMargin=42, bottomMargin=42,
                                     title="DocScan - documento sintetico sem valor fiscal", author="DocScan")
        story = [
            Paragraph("DOCSCAN / DEMONSTRACAO", small), Spacer(1, 16),
            Paragraph("DANFE SINTETICO", title), Spacer(1, 10),
            Paragraph("<b>SEM VALOR FISCAL - DADOS PARA TESTE</b>", body),
            Paragraph("Documento ficticio para demonstrar extracao e revisao de produtos. "
                      "Nao representa uma operacao comercial nem uma NF-e autorizada.", small),
            Spacer(1, 26), Paragraph("<b>EMITENTE SINTETICO</b>", body),
            Paragraph(invoice["supplier"]["name"], body),
            Paragraph(f'CNPJ de teste: {invoice["supplier"]["cnpj"]}', body),
            Spacer(1, 18),
            Paragraph(f'Numero: <b>{invoice["invoiceNumber"]}</b> &nbsp;&nbsp; '
                      f'Serie: <b>{invoice["series"]}</b> &nbsp;&nbsp; Emissao: <b>{invoice["issuedAt"]}</b>', body),
            Spacer(1, 14), Paragraph("CHAVE DE ACESSO SINTETICA (44 DIGITOS)", small),
            Paragraph(invoice["accessKey"], ParagraphStyle("key", parent=body, fontName="Courier", fontSize=10)),
            Spacer(1, 25), Paragraph("<b>PRODUTOS</b>", body), Spacer(1, 8),
        ]
        rows = [["Codigo", "Descricao", "UN", "Qtd.", "Unitario R$", "Total R$"]]
        for item in invoice["products"]:
            rows.append([item["code"], Paragraph(item["description"], cell), item["unitMeasurement"],
                         str(item["quantity"]), money(item["unitPrice"]), money(item["totalPrice"])])
        table = Table(rows, colWidths=[65, 216, 30, 40, 80, 80], repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), navy), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#EFF4F8"), colors.white]),
            ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
            ("LINEBELOW", (0, -1), (-1, -1), 0.5, colors.HexColor("#CDD8E2")),
        ]))
        story.extend([table, Spacer(1, 20),
                      Paragraph(f'<b>VALOR TOTAL DO DOCUMENTO: R$ {money(invoice["totalValue"])}</b>', body),
                      Spacer(1, 30), Paragraph("Uso exclusivo na demonstracao DocScan. Todos os dados deste documento sao sinteticos.", small)])
        document.build(story)
    (output_dir / "demo-manifest.json").write_text(json.dumps(scenario, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", help="Identificador da sessao; produz novas chaves sinteticas reproduziveis.")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "output/pdf")
    args = parser.parse_args()
    generate(args.output_dir, load_scenario(args.run_id))
    print(f"PDFs e manifesto gerados em {args.output_dir.resolve()}")
