"""Convocation d'une personne en PDF (pièce jointe de l'e-mail).

A4, texte sélectionnable, couleurs de l'app ; en haut de chaque page le film, la personne et la
date, en bas le numéro de page. Une scène n'est jamais coupée entre deux pages.
Polices : Helvetica (polices PDF standard) ; l'app utilise Inter, que le serveur n'embarque pas.
"""

import re
import unicodedata
from datetime import date

from fpdf import FPDF

from app.schemas.callsheet import CallsheetDraft, DraftScene
from app.services.callsheet.render import date_fr, hour_fr

INK = (18, 17, 16)
MUTED = (85, 82, 76)
GOLD = (255, 200, 46)
LINE = (217, 215, 209)

# Les polices PDF standard ne connaissent que le latin-1 : on remplace le reste
_LATIN1 = str.maketrans(
    {
        "’": "'",
        "‘": "'",
        "“": '"',
        "”": '"',
        "–": "-",
        "—": "-",
        "…": "...",
        "œ": "oe",
        "Œ": "OE",
        " ": " ",
    }
)


def latin1(text: str) -> str:
    return text.translate(_LATIN1).encode("latin-1", "replace").decode("latin-1")


def file_slug(text: str) -> str:
    """« Le dernier ferry » → « Le-dernier-ferry »."""
    # Seuls les accents sont retirés ; tout autre signe (’, !, espace) devient un tiret, comme le front
    plain = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    return re.sub(r"[^A-Za-z0-9]+", "-", plain).strip("-") or "document"


def pdf_filename(film: str, member_name: str) -> str:
    first = member_name.split()[0] if member_name.split() else member_name
    return f"{file_slug(film)}_convocation_{file_slug(first)}.pdf"


class _Sheet(FPDF):
    def __init__(self, film: str, person: str, edited: date):
        super().__init__(format="A4", unit="mm")
        self.film, self.person, self.edited = film, person, edited
        self.set_margins(16, 26, 16)
        self.set_auto_page_break(True, margin=18)
        self.alias_nb_pages()
        self.set_title(latin1(f"{film} - Convocation de {person}"))
        self.set_creator("Encadré")

    def header(self) -> None:
        self.set_y(10)
        self.set_text_color(*INK)
        self.set_font("Helvetica", "B", 11)
        self.cell(0, 6, latin1(self.film), new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*MUTED)
        self.cell(0, 5, latin1(f"Convocation de {self.person} - éditée le {date_fr(self.edited)}"))
        self.set_draw_color(*GOLD)
        self.set_line_width(1.2)
        self.line(16, 23, 194, 23)
        self.set_y(26)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 5, latin1(self.film), align="L")
        self.set_x(16)
        self.cell(0, 5, f"Page {self.page_no()} / {{nb}}", align="R")

    # --- mise en page ---------------------------------------------------------------

    def _height(self, text: str, line_h: float) -> float:
        lines = self.multi_cell(0, line_h, latin1(text), dry_run=True, output="LINES")
        return len(lines) * line_h

    def keep_together(self, height: float) -> None:
        if self.get_y() + height > self.page_break_trigger:
            self.add_page()

    def para(
        self, text: str, size: float = 10, style: str = "", color=INK, line_h: float = 5
    ) -> None:
        self.set_font("Helvetica", style, size)
        self.set_text_color(*color)
        self.multi_cell(0, line_h, latin1(text), new_x="LMARGIN", new_y="NEXT")


def _scene_lines(s: DraftScene) -> list[tuple[str, float, str, tuple[int, int, int]]]:
    """(texte, taille, style, couleur) des lignes d'une scène."""
    timing = f" - de {hour_fr(s.start)} à {hour_fr(s.end)}" if s.start and s.end else ""
    head = f"Scène {s.number}" + (f" : {s.title}" if s.title else "")
    lines = [(head, 11, "B", INK), (f"{s.moment_label}{timing}", 10, "", INK)]
    if s.characters:
        lines.append((f"Personnages : {', '.join(s.characters)}", 10, "", MUTED))
    if s.notes:
        lines.append((f"À savoir : {s.notes}", 10, "", INK))
    if s.text:
        lines.append((f"Texte de la scène :\n{s.text}", 9, "I", MUTED))
    return lines


def build_callsheet_pdf(
    draft: CallsheetDraft, film: str, director: str = "", today: date | None = None
) -> bytes:
    pdf = _Sheet(film, draft.name, today or date.today())
    pdf.add_page()

    role = "Acteur ou actrice" if draft.role == "acteur" else "Équipe technique"
    pdf.para(role.upper(), size=8, style="B", color=MUTED)
    pdf.para(draft.name, size=22, style="B", line_h=10)
    days = sorted({s.date for s in draft.scenes})
    pdf.para(
        f"{len(days)} jour{'s' if len(days) > 1 else ''} de tournage"
        + (f" - contact : {director}" if director else ""),
        color=MUTED,
    )
    pdf.ln(4)

    for day in days:
        items = [s for s in draft.scenes if s.date == day]
        call = min(s.call_time for s in items)
        places = list(
            dict.fromkeys(
                f"{s.location_name}, {s.address}" if s.address else s.location_name for s in items
            )
        )
        # Le jour, son rendez-vous et sa première scène restent ensemble
        first = sum(pdf._height(t, 5) for t, *_ in _scene_lines(items[0]))
        pdf.keep_together(8 + 9 + pdf._height(" / ".join(places), 5) + first + 8)
        pdf.para(date_fr(day).capitalize(), size=14, style="B", line_h=8)
        pdf.set_fill_color(*GOLD)
        pdf.set_text_color(*INK)
        pdf.set_font("Helvetica", "B", 11)
        label = latin1(f"Rendez-vous à {hour_fr(call)}")
        pdf.cell(
            pdf.get_string_width(label) + 6, 8, label, fill=True, new_x="LMARGIN", new_y="NEXT"
        )
        pdf.ln(1)
        pdf.para(" / ".join(places), color=INK)
        pdf.ln(2)
        for s in items:
            lines = _scene_lines(s)
            pdf.keep_together(sum(pdf._height(t, 5) for t, *_ in lines) + 4)
            for text, size, style, color in lines:
                pdf.para(text, size=size, style=style, color=color)
            pdf.set_draw_color(*LINE)
            pdf.set_line_width(0.3)
            pdf.ln(1.5)
            pdf.line(16, pdf.get_y(), 194, pdf.get_y())
            pdf.ln(2.5)
        pdf.ln(3)
    return bytes(pdf.output())
