import io
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab import rl_config
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.schemas.ai_tool import FIELD_LABELS_FR, STATUS_LABELS_FR, Fact, Tool
from app.schemas.passport import (
    DEPARTMENT_LABELS,
    DISCLAIMER_FR,
    LEVEL_LABELS,
    Declaration,
    PassportDocument,
)

INK = colors.HexColor("#121110")
MUTED = colors.HexColor("#5b5750")
GOLD = colors.HexColor("#f2b705")
GOLD_SOFT = colors.HexColor("#fdf3cf")
LINE = colors.HexColor("#c9c4ba")
QUOTE_CHARS = 240


def clean(text: str | None) -> str:
    """Texte sûr pour ReportLab : échappé, et limité aux caractères que la police intégrée sait écrire
    (latin, accents français, « », œ). Le reste devient « ? » plutôt que d'afficher un carré vide.
    Limite connue : l'arabe n'est pas pris en charge (il faudrait une police et le sens de lecture)."""
    if not text:
        return ""
    safe = text.replace(" ", " ").encode("cp1252", errors="replace").decode("cp1252")
    return escape(safe)


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()["Normal"]
    mk = lambda name, **kw: ParagraphStyle(name, parent=base, **kw)
    return {
        "title": mk("title", fontName="Helvetica-Bold", fontSize=24, leading=28, textColor=INK),
        "h2": mk(
            "h2",
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            spaceBefore=12,
            spaceAfter=5,
            textColor=INK,
        ),
        "body": mk("body", fontSize=9.5, leading=13, textColor=INK, alignment=TA_LEFT),
        "small": mk("small", fontSize=8, leading=10.5, textColor=MUTED),
        "cell": mk("cell", fontSize=8.5, leading=11, textColor=INK),
        "cellb": mk("cellb", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=INK),
        "quote": mk(
            "quote",
            fontName="Helvetica-Oblique",
            fontSize=7.8,
            leading=10,
            textColor=MUTED,
            leftIndent=8,
        ),
        "notice": mk("notice", fontName="Helvetica-Bold", fontSize=10, leading=14, textColor=INK),
    }


def _date(d: datetime) -> str:
    return d.strftime("%d/%m/%Y")


def _review_line(tool: Tool) -> str:
    if tool.review_state == "verifie":
        who = f" par {clean(tool.reviewed_by)}" if tool.reviewed_by else ""
        when = f" le {tool.reviewed_at[:10]}" if tool.reviewed_at else ""
        return f"Fiche relue par une personne{who}{when}."
    return "Fiche NON relue par une personne : résultat d'une recherche automatique ou d'un chargement initial."


def _fact_flowables(fact: Fact, st: dict[str, ParagraphStyle]) -> list:
    confirmed = fact.quote_verified or fact.human_confirmed
    plan = "" if fact.plan == "all" else f" (offre : {clean(fact.plan)})"
    flag = "" if confirmed else " <b>[non vérifié]</b>"
    quote = fact.quote if len(fact.quote) <= QUOTE_CHARS else fact.quote[: QUOTE_CHARS - 1] + "…"
    return [
        Paragraph(
            f"<b>{clean(FIELD_LABELS_FR[fact.field])}</b>{plan}{flag} : {clean(fact.value_fr)}",
            st["cell"],
        ),
        Paragraph(f"« {clean(quote)} »", st["quote"]),
        Paragraph(f"Source : {clean(fact.source_url)}", st["small"]),
        Spacer(1, 3),
    ]


def _tool_sheet(tool: Tool | None, declared_name: str, st: dict[str, ParagraphStyle]):
    if tool is None:
        return KeepTogether(
            [
                Paragraph(f"{clean(declared_name)} — outil hors catalogue", st["cellb"]),
                Paragraph(
                    "Aucune documentation n'a été vérifiée pour cet outil. Statut : <b>Non documenté</b>. "
                    "Ce n'est pas une accusation : nous n'avons simplement pas de source à citer.",
                    st["cell"],
                ),
                Spacer(1, 8),
            ]
        )
    head = [
        Paragraph(
            f"{clean(tool.name)} ({clean(tool.vendor)}) — statut : <b>{STATUS_LABELS_FR[tool.status]}</b>",
            st["cellb"],
        ),
        Paragraph(_review_line(tool), st["small"]),
    ]
    if tool.terms_updated:
        head.append(Paragraph(f"Conditions lues datées : {clean(tool.terms_updated)}", st["small"]))
    if tool.checked_at:
        head.append(Paragraph(f"Fiche vérifiée le {tool.checked_at[:10]}.", st["small"]))
    if tool.note_fr:
        head.append(Paragraph(clean(tool.note_fr), st["small"]))
    head.append(Spacer(1, 3))
    body: list = []
    for fact in tool.facts:
        body += _fact_flowables(fact, st)
    if not tool.facts:
        body.append(Paragraph("Aucun fait sourcé pour cet outil.", st["cell"]))
    # La fiche d'un outil peut être longue : on garde l'en-tête avec son premier fait seulement.
    return [KeepTogether(head + body[:4])] + body[4:] + [Spacer(1, 8)]


def _declaration_rows(decls: list[Declaration], tools: dict[str, Tool], st):
    rows = [
        [
            Paragraph(h, st["cellb"])
            for h in (
                "Département",
                "IA ?",
                "Outil",
                "Niveau",
                "Ce que l'IA a fait",
                "Décisions humaines",
            )
        ]
    ]
    for d in decls:
        if d.tool_slug and d.tool_slug in tools:
            tool_name = tools[d.tool_slug].name
        else:
            tool_name = d.custom_tool or d.tool_slug or ""
        rows.append(
            [
                Paragraph(clean(DEPARTMENT_LABELS[d.department]), st["cellb"]),
                Paragraph("Oui" if d.used_ai else "Non", st["cell"]),
                Paragraph(clean(tool_name) or "—", st["cell"]),
                Paragraph(clean(LEVEL_LABELS.get(d.level or "", "")) or "—", st["cell"]),
                Paragraph(clean(d.what) or "—", st["cell"]),
                Paragraph(clean(d.human_decisions) or "—", st["cell"]),
            ]
        )
    table = Table(
        rows, colWidths=[24 * mm, 11 * mm, 27 * mm, 24 * mm, 46 * mm, 42 * mm], repeatRows=1
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GOLD),
                ("GRID", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def render_pdf(doc: PassportDocument, tools: dict[str, Tool], compress: bool = True) -> bytes:
    """Fabrique le PDF du Passeport IA. Même entrée, mêmes octets (`invariant`) : pratique pour les
    tests et pour comparer deux émissions. Aucun appel réseau, aucune IA."""
    st = _styles()
    buf = io.BytesIO()

    def footer(canvas, pdf):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(
            18 * mm, 10 * mm, clean(f"Passeport IA {doc.badge_code}").replace("&amp;", "&")
        )
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {pdf.page}")
        canvas.restoreState()

    pdf = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
        title=f"Passeport IA — {doc.film_title}", author="Premier Plan", subject="Déclaration d'usage de l'IA",
        invariant=1,
        pageCompression=1 if compress else 0,
    )  # fmt: skip

    flow: list = [
        Paragraph("PASSEPORT IA", st["small"]),
        Paragraph(clean(doc.film_title), st["title"]),
        Spacer(1, 4),
        Paragraph(
            f"Réalisation : <b>{clean(doc.director)}</b> · Émis le {_date(doc.issued_at)}",
            st["body"],
        ),
        Paragraph(
            f"Badge : <b>{clean(doc.badge_code)}</b> · Identifiant : {clean(doc.passport_id)}",
            st["body"],
        ),
    ]
    if doc.verify_url:
        flow.append(Paragraph(f"Vérification : {clean(doc.verify_url)}", st["body"]))
    if doc.film_sha256:
        flow.append(
            Paragraph(f"Empreinte SHA-256 du film déclaré : {doc.film_sha256}", st["small"])
        )
    flow += [
        Spacer(1, 8),
        Table(
            [[Paragraph(clean(DISCLAIMER_FR), st["notice"])]],
            colWidths=[174 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), GOLD_SOFT),
                    ("BOX", (0, 0), (-1, -1), 1, INK),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]
            ),
        ),
        Spacer(1, 4),
        Paragraph(
            "Un statut « Non divulgué » ou « Non documenté » est un statut valide : il signifie que nous n'avons pas "
            "trouvé de source à citer, pas que l'outil est interdit ou dangereux.",
            st["small"],
        ),
        Paragraph("Ce que le cinéaste déclare", st["h2"]),
        _declaration_rows(doc.declarations, tools, st),
        Paragraph("Fiches des outils déclarés", st["h2"]),
        Paragraph(
            "Chaque information est suivie de la phrase exacte de la page officielle et de son adresse. "
            "Les conditions des outils changent : la date de lecture est indiquée.",
            st["small"],
        ),
        Spacer(1, 6),
    ]
    seen: set[str] = set()
    for d in doc.declarations:
        if not d.used_ai:
            continue
        key = d.tool_slug or f"custom:{d.custom_tool}"
        if key in seen or not (d.tool_slug or d.custom_tool):
            continue
        seen.add(key)
        sheet = _tool_sheet(tools.get(d.tool_slug or ""), d.custom_tool or d.tool_slug or "", st)
        flow += sheet if isinstance(sheet, list) else [sheet]
    if not seen:
        flow.append(Paragraph("Aucun outil d'IA déclaré.", st["body"]))
    flow += [
        Paragraph("Intégrité de ce document", st["h2"]),
        Paragraph(
            "Ce PDF porte une signature C2PA (Content Credentials) qui permet de vérifier qu'il n'a pas été modifié "
            "depuis son émission. Le fichier doit rester intact : toute modification, même d'un seul caractère, "
            "invalide la signature. La signature atteste de l'émission par Premier Plan, pas de l'exactitude "
            "des déclarations du cinéaste.",
            st["small"],
        ),
    ]
    # Sans compression, on retire aussi l'encodage ASCII85 : le texte devient lisible dans les octets (tests).
    previous = rl_config.useA85
    rl_config.useA85 = 1 if compress else 0
    try:
        pdf.build(flow, onFirstPage=footer, onLaterPages=footer)
    finally:
        rl_config.useA85 = previous
    return buf.getvalue()
