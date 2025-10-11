import io
import base64
import json
from typing import List

import fitz  # PyMuPDF
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/merge", tags=["merge"])


def pdf_to_json(file_bytes: bytes):
    """Convert PDF to JSON format with text and images"""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    output = []

    for page_num in range(doc.page_count):
        page = doc.load_page(page_num)
        blocks = []

        # Extract text blocks
        text_dict = page.get_text("dict")
        for block in text_dict.get("blocks", []):
            if block.get("type") == 0:  # Text block
                blocks.append({
                    "type": "text",
                    "bbox": block.get("bbox"),
                    "lines": block.get("lines", []),
                })

        # Extract all images
        image_list = page.get_images(full=True)
        for img in image_list:
            try:
                xref = img[0]
                base_image = doc.extract_image(xref)
                img_bytes = base_image.get("image")
                ext = base_image.get("ext") or "png"
                b64 = base64.b64encode(img_bytes).decode("utf-8")
                mime = f"image/{ext.lower()}"

                # Get bounding box of this image instance if possible
                try:
                    bbox_rect = page.get_image_bbox(xref)
                    bbox = [bbox_rect.x0, bbox_rect.y0, bbox_rect.x1, bbox_rect.y1]
                except Exception:
                    bbox = [50, 50, 100, 100]

                blocks.append({
                    "type": "image",
                    "bbox": bbox,
                    "src": f"{mime};base64,{b64}",
                    "xref": xref,
                })
            except Exception:
                continue

        output.append({"page": page_num + 1, "blocks": blocks})

    doc.close()
    return output


def _canonical_base14_family(alias: str) -> str:
    a = (alias or "").lower()
    if "times" in a:
        return "times-roman"
    if "cour" in a or "courier" in a:
        return "courier"
    if "helv" in a or "arial" in a or "helvetica" in a:
        return "helvetica"
    return "helvetica"


def get_font_name(font: str):
    # Map incoming font names to canonical base-14 family names
    return _canonical_base14_family(str(font))


def get_color(color_val):
    try:
        if isinstance(color_val, int):
            r = ((color_val >> 16) & 0xFF) / 255.0
            g = ((color_val >> 8) & 0xFF) / 255.0
            b = (color_val & 0xFF) / 255.0
            return (r, g, b)
    except Exception:
        pass
    return (0, 0, 0)


def page_main_text(page_data):
    blocks = page_data.get("blocks", [])
    if not blocks:
        return ""
    return " ".join(
        span.get("text", "").strip()
        for block in blocks
        if block.get("type") == "text"
        for line in block.get("lines", []) if line
        for span in line.get("spans", []) if span
        if span.get("text")
    )


def is_unwanted_page(content):
    c = content.strip().lower()
    return (not c) or (len(c.split()) < 10)


def extract_headings_from_pages(pages):
    """Extract headings with improved detection"""
    toc_entries = []
    doc_titles_seen = 0

    for page_num, pg in enumerate(pages, start=1):
        for block in pg.get("blocks", []):
            if block.get("type") != "text":
                continue

            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    size = span.get("size", 10)
                    flags = span.get("flags", 0)

                    if not text or len(text) < 2:
                        continue

                    bbox = span.get("bbox", [0, 0, 0, 0])
                    # Skip headers/footers
                    if bbox[1] < 40 or bbox[1] > 800:
                        continue

                    is_bold = bool(flags & 16)
                    text_clean = text.strip()

                    # Very large titles (20pt+)
                    if size >= 20 and len(text_clean.split()) <= 15:
                        if doc_titles_seen > 0:
                            toc_entries.append(("SEPARATOR", page_num, 0))
                        doc_titles_seen += 1
                        toc_entries.append((text_clean, page_num, 0))
                        continue

                    # Roman numerals (I., II., III., ...)
                    if len(text_clean) >= 2 and text_clean[0] in "IVX" and "." in text_clean[:10]:
                        parts = text_clean.split(".", 1)
                        if len(parts) >= 2 and all(c in "IVXLCDM " for c in parts[0]):
                            toc_entries.append((text_clean, page_num, 1))
                            continue

                    # Letter sections (A., B., C., ...)
                    if len(text_clean) >= 3 and text_clean[0].isupper() and text_clean[1] == ".":
                        if text_clean[0] in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
                            toc_entries.append((text_clean, page_num, 2))
                            continue

                    # Chapter numbers (1., 2., 3., ...)
                    if text_clean[:3].replace(".", "").isdigit() and "." in text_clean[:4]:
                        num = text_clean.split(".")[0]
                        if num.isdigit() and 1 <= int(num) <= 30:
                            toc_entries.append((text_clean, page_num, 1))
                            continue

                    # Important sections
                    keywords = [
                        "introduction:", "postscript:", "endnotes", "acknowledgement",
                        "acknowledgment", "references", "conclusion", "abstract",
                    ]
                    if (any(text_clean.lower().startswith(kw) for kw in keywords)
                            and size >= 11 and len(text_clean.split()) <= 8):
                        toc_entries.append((text_clean, page_num, 1))
                        continue

                    # Other large headings
                    if size >= 14 and is_bold and len(text_clean.split()) <= 12:
                        toc_entries.append((text_clean, page_num, 1))

    return toc_entries


def create_toc_page_direct(toc_entries):
    """Create TOC page with clean, real-life book style"""
    return create_toc_page_with_size(toc_entries, page_size=(595, 842))


def create_toc_page_with_size(toc_entries, page_size=(595, 842)):
    doc = fitz.open()
    page = doc.new_page(width=page_size[0], height=page_size[1])

    # Title - centered and elegant (use base-14 font)
    page.insert_text((250, 80), "CONTENTS", fontsize=18, fontname="helvetica", color=(0, 0, 0))

    if not toc_entries:
        # Return empty TOC doc; caller may decide to skip inserting if empty
        return doc.tobytes()

    y_pos = 140

    for entry in toc_entries:
        if y_pos > 780:  # Page full
            break

        title, page_num, level = entry

        # Skip separators
        if title == "SEPARATOR":
            continue

        fontsize = 12
        fontname = "helvetica"

        # Truncate long titles
        max_len = 70
        if len(title) > max_len:
            title = title[: max_len - 3] + "..."

        # Insert chapter name (left-aligned)
        page.insert_text((70, y_pos), title, fontsize=fontsize, fontname=fontname, color=(0, 0, 0))

        # Insert page number (right-aligned)
        page_str = str(page_num)
        page_num_width = len(page_str) * 6  # Approximate width
        page.insert_text((525 - page_num_width, y_pos), page_str, fontsize=fontsize, fontname=fontname, color=(0, 0, 0))

        # Dotted line between chapter and page number
        title_width = len(title) * 6  # Approximate width
        dot_start_x = 75 + title_width
        dot_end_x = 520 - page_num_width

        if dot_start_x < dot_end_x - 20:
            num_dots = int((dot_end_x - dot_start_x) / 5)
            dots = " " + "." * num_dots + " "
            page.insert_text((dot_start_x, y_pos), dots, fontsize=10, fontname="helvetica", color=(0.6, 0.6, 0.6))

        y_pos += 22

    return doc.tobytes()


def draw_toc_pages_clickable(doc: fitz.Document, toc_entries: List[tuple], page_size=(595, 842)):
    """Draws a Table of Contents into the given document and returns clickable
    hotspot metadata so we can add link annotations after content pages are appended.

    toc_entries: list of tuples (title, page_num, level)
    Returns: (positions, toc_pages) where
      - positions: List[{ 'toc_page_index': int, 'rect': fitz.Rect, 'target_page': int }]
      - toc_pages: number of TOC pages added to 'doc'
    """
    if not toc_entries:
        return [], 0

    W, H = page_size
    positions = []

    def new_toc_page():
        p = doc.new_page(width=W, height=H)
        # Title
        p.insert_text((W/2 - 40, 80), "CONTENTS", fontsize=18, fontname="helvetica", color=(0, 0, 0))
        return p

    page = new_toc_page()
    y_pos = 140

    for entry in toc_entries:
        title, page_num, level = entry
        if title == "SEPARATOR":
            continue

        # Pagination for TOC
        if y_pos > 780:
            page = new_toc_page()
            y_pos = 140

        # Appearance by level
        lvl = int(level or 0)
        lvl = 0 if lvl < 0 else (2 if lvl > 2 else lvl)
        indent = 0 if lvl == 0 else (15 if lvl == 1 else 30)
        fontsize = 12 if lvl == 0 else (11 if lvl == 1 else 10)
        fontname = "helvetica"

        # Truncate super long titles
        max_len = 90
        t = title.strip()
        if len(t) > max_len:
            t = t[: max_len - 3] + "..."

        # Left text
        x_text = 70 + indent
        page.insert_text((x_text, y_pos), t, fontsize=fontsize, fontname=fontname, color=(0, 0, 0))

        # Right-aligned page number
        page_str = str(page_num)
        approx_digit_w = 6
        num_w = len(page_str) * approx_digit_w
        x_page = 525 - num_w
        page.insert_text((x_page, y_pos), page_str, fontsize=fontsize, fontname=fontname, color=(0, 0, 0))

        # Dotted leaders
        approx_char_w = 6
        title_w = min(len(t) * approx_char_w, max(0, x_page - (x_text + 10)))
        dot_start_x = x_text + title_w + 5
        dot_end_x = x_page - 5
        if dot_end_x - dot_start_x > 20:
            num_dots = int((dot_end_x - dot_start_x) / 5)
            dots = " " + "." * num_dots + " "
            page.insert_text((dot_start_x, y_pos), dots, fontsize=10, fontname="helvetica", color=(0.6, 0.6, 0.6))

        # Clickable area covering the row
        top = y_pos - fontsize * 0.9
        bottom = y_pos + fontsize * 0.6
        rect = fitz.Rect(60, max(60, top), 535, min(H - 60, bottom))
        positions.append({
            "toc_page_index": page.number,
            "rect": rect,
            "target_page": int(page_num),  # 1-based content page number
        })

        # Advance line
        y_pos += 22

    return positions, doc.page_count


def merge_jsons_to_pdf_bytes(toc_pdf_bytes, pages, page_size=(595, 842)):
    """Merge TOC PDF with content pages"""
    doc = fitz.open()

    # Add TOC page(s)
    toc_doc = fitz.open("pdf", toc_pdf_bytes)
    doc.insert_pdf(toc_doc)
    toc_doc.close()

    # Add content pages
    w, h = page_size
    for page_data in pages:
        page = doc.new_page(width=w, height=h)

        for block in page_data.get("blocks", []):
            btype = block.get("type")

            if btype == "text":
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span.get("text", "")
                        if not text or not text.strip():
                            continue

                        bbox = span.get("bbox", [50, 50, 400, 100])
                        fontsize = span.get("size", 10)
                        fontname = get_font_name(span.get("font", "times"))
                        color = get_color(span.get("color", 0))

                        try:
                            page.insert_text((bbox[0], bbox[1] + fontsize), text, fontsize=fontsize, fontname=fontname, color=color)
                        except Exception:
                            pass

            elif btype == "image":
                src = block.get("src", "")
                bbox = block.get("bbox")

                if src.startswith("image/") and bbox and len(bbox) == 4:
                    try:
                        b64 = src.split(",", 1)[1]
                        img_bytes = base64.b64decode(b64)
                        rect = fitz.Rect(bbox)
                        page.insert_image(rect, stream=img_bytes)
                    except Exception:
                        pass

    return doc.tobytes()


def apply_page_numbers(doc: fitz.Document, page_size=(595, 842), margin=30):
    """Overlay page numbers at bottom-center of each page."""
    W, H = page_size
    total = doc.page_count
    for i in range(total):
        page = doc.load_page(i)
        txt = f"{i+1} / {total}"
        try:
            page.insert_text((W/2 - 10*len(txt)/2, H - margin), txt, fontsize=9, fontname="helvetica", color=(0,0,0))
        except Exception:
            pass
    return doc


def pdf_page_count(data: bytes) -> int:
    try:
        d = fitz.open(stream=data, filetype="pdf")
        n = d.page_count
        d.close()
        return n
    except Exception:
        return 0


def docx_word_count(data: bytes) -> int:
    try:
        from docx import Document
        d = Document(io.BytesIO(data))
        words = 0
        for p in d.paragraphs:
            if p.text:
                words += len(p.text.split())
        return words
    except Exception:
        return 0


def txt_word_count(data: bytes) -> int:
    try:
        t = data.decode("utf-8", errors="ignore")
        return len(t.split())
    except Exception:
        return 0


@router.post("/generate-toc-from-pdf")
async def generate_toc_from_pdf(
    files: List[UploadFile] = File(...),
    page_size: str = Form("a4"),
    generate_toc: str = Form("true"),
    add_page_breaks: str = Form("true"),
    page_numbers: str = Form("false"),
    template: str = Form(None),
):
    """Upload PDFs/DOCX/TXT and get merged PDF with optional TOC as first page.

    - page_size: one of a4, letter, legal
    - generate_toc: 'true'/'false'
    """
    try:
        size_map = {
            "a4": (595, 842),
            "letter": (612, 792),
            "legal": (612, 1008),
        }
        # Template-aware page size
        requested_page_size = size_map.get((page_size or "a4").lower(), (595, 842))
        page_size = requested_page_size
        gen_toc = str(generate_toc).lower() in ("1", "true", "yes", "on")

        # Define academic research template profile
        academic_profile = None
        if template and str(template).lower() in ("academic", "academic_research", "research", "paper"):
            academic_profile = {
                "name": "academic_research",
                "page_size": size_map["a4"],
                "margin": 72,  # 1 inch
                "font_family": "times",
                "base_size": 12,
                "line_spacing": 1.5,
                "heading_sizes": {1: 16, 2: 14, 3: 12},
                "section_order": [
                    "titlepage","abstract","keywords","introduction","methods","results","discussion","conclusion","references","figures","tables","supplementary","body"
                ],
                "required_sections": ["abstract","introduction","methods","results","discussion","references"],
            }
            page_size = academic_profile["page_size"]

        # Preload files into memory (name, ctype, data)
        files_data = []
        import hashlib
        seen_hashes = set()
        for f in files:
            name_lower = (f.filename or "").lower()
            ctype = (f.content_type or "").lower()
            data = await f.read()
            files_data.append({"name": f.filename, "name_lower": name_lower, "ctype": ctype, "data": data})

        # Role detection helpers for academic template
        def extract_text_snippet(fd):
            try:
                if fd["ctype"] == "application/pdf" or fd["name_lower"].endswith(".pdf"):
                    d = fitz.open(stream=fd["data"], filetype="pdf")
                    text = "\n".join(d.load_page(i).get_text("text") for i in range(min(2, d.page_count)))
                    d.close(); return text
                elif fd["ctype"].endswith("officedocument.wordprocessingml.document") or fd["name_lower"].endswith(".docx"):
                    try:
                        from docx import Document
                        d = Document(io.BytesIO(fd["data"]))
                        return "\n".join(p.text for p in d.paragraphs[:50])
                    except Exception:
                        return ""
                elif fd["ctype"].startswith("text/") or fd["name_lower"].endswith(".txt"):
                    return fd["data"].decode("utf-8", errors="ignore")[:5000]
            except Exception:
                return ""
            return ""

        def detect_academic_role(fd):
            import re
            n = fd["name_lower"] or ""
            t = extract_text_snippet(fd)
            # Filename hints
            hints = [
                ("title", "titlepage"), ("cover", "titlepage"), ("abstract", "abstract"),
                ("keyword", "keywords"), ("intro", "introduction"), ("method", "methods"),
                ("materials", "methods"), ("result", "results"), ("discussion", "discussion"),
                ("conclusion", "conclusion"), ("reference", "references"), ("fig", "figures"),
                ("table", "tables"), ("supp", "supplementary"),
            ]
            for key, role in hints:
                if key in n:
                    return role
            # Content heuristics
            patterns = [
                (r"^\s*abstract\b", "abstract"),
                (r"^\s*keywords?\b", "keywords"),
                (r"^\s*introduction\b", "introduction"),
                (r"methods?|materials and methods", "methods"),
                (r"^\s*results\b", "results"),
                (r"^\s*discussion\b", "discussion"),
                (r"^\s*conclusions?\b", "conclusion"),
                (r"^\s*references\b|^\s*bibliography\b", "references"),
            ]
            lower = (t or "").lower()
            for pat, role in patterns:
                try:
                    if re.search(pat, lower, flags=re.M):
                        return role
                except Exception:
                    continue
            # Default fallbacks
            if len(lower) < 400:
                return "titlepage"
            return "body"

        if academic_profile:
            for fd in files_data:
                fd["role"] = detect_academic_role(fd)
            # Sort by section order weight
            order_index = {sec: i for i, sec in enumerate(academic_profile["section_order"])}
            files_data.sort(key=lambda x: order_index.get(x.get("role", "body"), 999))

        merged_doc = fitz.open()
        toc_entries: List[tuple] = []  # (title, page_num, level)
        page_offset = 0
        duplicates_skipped: List[str] = []

        # Merge in planned order
        for fd in files_data:
            name_lower = fd["name_lower"]
            ctype = fd["ctype"]
            data = fd["data"]

            def add_simple_entry(title: str, local_page_start: int = 1):
                if title:
                    toc_entries.append((title, page_offset + max(1, local_page_start), 0))

            # Duplicate detection by content hash
            h = hashlib.sha256(data).hexdigest()
            if h in seen_hashes:
                duplicates_skipped.append(fd["name"])
                continue
            seen_hashes.add(h)

            # PDF flow
            if ctype == "application/pdf" or name_lower.endswith(".pdf"):
                try:
                    src = fitz.open(stream=data, filetype="pdf")
                except Exception as e:
                    raise HTTPException(400, f"Invalid PDF: {fd['name']} ({e})")

                # Prefer built-in PDF outline / bookmarks
                try:
                    outline = src.get_toc(simple=True) or []
                except Exception:
                    outline = []
                if outline:
                    # outline rows: [level, title, page]
                    for lvl, title, p in outline:
                        if isinstance(p, int) and p >= 1:
                            toc_entries.append((str(title).strip(), page_offset + p, max(0, int(lvl) - 1)))
                else:
                    # Fallback: detect headings from first few pages via heuristics
                    try:
                        pages_like = []
                        limit = min(10, src.page_count)
                        for i in range(limit):
                            td = src.load_page(i).get_text("dict")
                            # normalize to our blocks structure
                            blocks = []
                            for b in td.get("blocks", []):
                                if b.get("type") == 0:
                                    blocks.append({
                                        "type": "text",
                                        "bbox": b.get("bbox"),
                                        "lines": b.get("lines", []),
                                    })
                            pages_like.append({"page": i+1, "blocks": blocks})
                        detected = extract_headings_from_pages(pages_like)
                        # ensure local page references
                        for (t, p, lvl) in detected:
                            toc_entries.append((t, page_offset + p, lvl))
                        if not detected:
                            # last resort: simple title from first page
                            p0 = src.load_page(0)
                            td = p0.get_text("dict")
                            best = None
                            for block in td.get("blocks", []):
                                if block.get("type") == 0:
                                    for line in block.get("lines", []):
                                        for span in line.get("spans", []):
                                            t = span.get("text", "").strip()
                                            sz = span.get("size", 0)
                                            if len(t) >= 2:
                                                if not best or sz > best[0]:
                                                    best = (sz, t)
                            if best:
                                add_simple_entry(best[1], 1)
                            else:
                                add_simple_entry(fd["name"])
                    except Exception:
                        add_simple_entry(fd["name"])

                merged_doc.insert_pdf(src)
                page_offset += src.page_count
                src.close()
                continue

            # DOCX flow
            if ctype.endswith("officedocument.wordprocessingml.document") or name_lower.endswith(".docx"):
                try:
                    from docx import Document  # ensure dependency
                except Exception:
                    raise HTTPException(500, "python-docx is required to process DOCX files")

                # Apply academic profile styling for DOCX
                style_profile = None
                if academic_profile:
                    style_profile = {
                        "font_family": academic_profile["font_family"],
                        "base_size": academic_profile["base_size"],
                        "line_spacing": academic_profile["line_spacing"],
                        "heading_sizes": academic_profile["heading_sizes"],
                        "margin": academic_profile["margin"],
                    }

                pdf_bytes, headings = render_docx_to_pdf_with_headings(data, page_size=page_size, margin=(style_profile.get("margin") if style_profile else 50), style_profile=style_profile)
                if headings:
                    for title, lvl, local_page in headings:
                        toc_entries.append((title, page_offset + local_page, min(max(int(lvl),0),2)))
                else:
                    add_simple_entry(fd["name"], 1)
                sub = fitz.open("pdf", pdf_bytes)
                if str(add_page_breaks).lower() in ("1","true","yes","on") and merged_doc.page_count>0:
                    # insert blank page as page break before this content
                    merged_doc.new_page(width=page_size[0], height=page_size[1])
                    page_offset += 1
                merged_doc.insert_pdf(sub)
                page_offset += sub.page_count
                sub.close()
                continue

            # TXT flow
            if ctype.startswith("text/") or name_lower.endswith(".txt"):
                try:
                    text = data.decode("utf-8", errors="ignore")
                except Exception:
                    text = fd["name"]

                # Apply academic profile styling for TXT
                style_profile = None
                if academic_profile:
                    style_profile = {
                        "font_family": academic_profile["font_family"],
                        "base_size": academic_profile["base_size"],
                        "line_spacing": academic_profile["line_spacing"],
                        "margin": academic_profile["margin"],
                    }
                pdf_bytes, first_page_local, txt_headings = render_text_to_pdf_with_headings(
                    text, page_size, margin=(style_profile.get("margin") if style_profile else 50), style_profile=style_profile
                )
                if txt_headings:
                    for title, lvl, local_page in txt_headings:
                        toc_entries.append((title, page_offset + local_page, min(max(int(lvl),0),2)))
                else:
                    add_simple_entry(fd["name"], first_page_local)
                sub = fitz.open("pdf", pdf_bytes)
                if str(add_page_breaks).lower() in ("1","true","yes","on") and merged_doc.page_count>0:
                    merged_doc.new_page(width=page_size[0], height=page_size[1])
                    page_offset += 1
                merged_doc.insert_pdf(sub)
                page_offset += sub.page_count
                sub.close()
                continue

            # Unsupported -> skip
            continue

        if merged_doc.page_count == 0:
            raise HTTPException(400, "No supported files provided (PDF/DOCX/TXT)")

        # Insert TOC page(s) if requested and we have entries (clickable)
        # We'll draw TOC into a new document, remember clickable regions, then merge content and add link annotations.
        if gen_toc and toc_entries:
            final_doc = fitz.open()
            # 1) Draw TOC pages into final_doc and capture hotspot data
            hotspots, _ = draw_toc_pages_clickable(final_doc, toc_entries, page_size=page_size)
            # 2) Append merged content after TOC pages
            content_start_index = final_doc.page_count  # zero-based index where content will begin
            final_doc.insert_pdf(merged_doc)
            # 3) Add link annotations to TOC entries. toc target pages are 1-based relative to content
            for hp in hotspots:
                toc_pg = hp["toc_page_index"]
                rect = hp["rect"]
                target_content_page_1based = hp["target_page"]
                # Compute absolute target page index within final_doc
                target_index = content_start_index + max(0, target_content_page_1based - 1)
                try:
                    p = final_doc.load_page(toc_pg)
                    # Try modern API
                    try:
                        p.add_link(rect=rect, kind=fitz.LINK_GOTO, page=target_index, zoom=0)
                    except Exception:
                        # Fallback for older PyMuPDF
                        p.insert_link({
                            "kind": fitz.LINK_GOTO,
                            "page": target_index,
                            "from": rect,
                            "zoom": 0,
                        })
                except Exception:
                    continue
            # Replace merged_doc with final_doc
            try:
                merged_doc.close()
            except Exception:
                pass
            merged_doc = final_doc

        # Create PDF outline/bookmarks to reflect structure
        try:
            # toc_entries includes (title, page_num, level) with 1-based page numbers relative to merged content (before TOC insertion)
            # After clickable TOC flow we re-bound merged_doc, but the page numbers still align since we created TOC first in final_doc.
            # Here, we regenerate outline with the actual current doc ordering.
            outline_rows = []  # rows: [level, title, page_index(1-based)]
            # If TOC was added, content starts after TOC pages; adjust target accordingly
            content_start_page_1based = 1
            if gen_toc and toc_entries:
                # Our final doc is: [TOC pages] + [content]
                # content_start_index was used earlier; recompute from current merged_doc
                # We can detect TOC length by scanning first page title "CONTENTS"; but safer: recompute using hotspots count
                # Since hotspots length equals number of TOC rows but not pages, estimate TOC pages by scanning until page text matches 'CONTENTS'
                # For simplicity, assume TOC pages come first and shift = number of pages until a page without 'CONTENTS' title; best-effort.
                try:
                    shift = 0
                    for pi in range(min(5, merged_doc.page_count)):
                        txt = (merged_doc.load_page(pi).get_text("text") or "").upper()
                        if "CONTENTS" in txt and pi == shift:
                            shift += 1
                        else:
                            break
                    content_start_page_1based = shift + 1
                except Exception:
                    content_start_page_1based = 1
            for title, page_num, level in toc_entries:
                if title == "SEPARATOR":
                    continue
                page1 = content_start_page_1based - 1 + int(max(1, page_num))
                outline_rows.append([int(max(0, min(2, level))), str(title), int(page1)])
            if outline_rows:
                merged_doc.set_toc(outline_rows)
        except Exception:
            pass

        # Page numbers
        if str(page_numbers).lower() in ("1","true","yes","on"):
            merged_doc = fitz.open(stream=merged_doc.tobytes(), filetype="pdf")
            apply_page_numbers(merged_doc, page_size=page_size)

        final_bytes = merged_doc.tobytes()
        merged_doc.close()
        # Build headers with template validation information if applicable
        headers = {"Content-Disposition": "attachment; filename=document-with-toc.pdf"}
        if duplicates_skipped:
            headers["X-Duplicates-Skipped"] = ";".join(duplicates_skipped)
        if academic_profile:
            # Validate presence of required sections
            found_roles = [fd.get("role","body") for fd in files_data]
            missing = [sec for sec in academic_profile["required_sections"] if sec not in found_roles]
            headers["X-Template"] = academic_profile["name"]
            headers["X-Template-Validation"] = ("OK" if not missing else ("MISSING:"+",".join(missing)))
            # Include compact role mapping
            try:
                role_map = ";".join(f"{fd['name']}=>{fd.get('role','body')}" for fd in files_data)
                if len(role_map) < 3500:  # avoid header overflow
                    headers["X-Template-Roles"] = role_map
            except Exception:
                pass
        return StreamingResponse(io.BytesIO(final_bytes), media_type="application/pdf", headers=headers)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error: {str(e)}")


@router.post("/inspect")
async def inspect(files: List[UploadFile] = File(...)):
    """Return per-file stats to drive UI (pages, words, size)."""
    results = []
    for f in files:
        name_lower = (f.filename or "").lower()
        ctype = (f.content_type or "").lower()
        data = await f.read()
        info = {"name": f.filename, "size": len(data), "type": ctype}
        if ctype == "application/pdf" or name_lower.endswith(".pdf"):
            info["pages"] = pdf_page_count(data)
        elif ctype.endswith("officedocument.wordprocessingml.document") or name_lower.endswith(".docx"):
            info["words"] = docx_word_count(data)
            # approximate pages: 300 words/page default
            info["pages"] = max(1, round((info["words"] or 0)/300))
        elif ctype.startswith("text/") or name_lower.endswith(".txt"):
            info["words"] = txt_word_count(data)
            info["pages"] = max(1, round((info["words"] or 0)/500))
        else:
            info["pages"] = 1
        results.append(info)
    return {"files": results}


@router.post("/validate-template")
async def validate_template(
    files: List[UploadFile] = File(...),
    template: str = Form(None),
):
    """Preflight validation for template conformance without generating a merged PDF.

    Returns a JSON payload describing detected roles, missing required sections,
    suggested merge order, and duplicates, for the requested template.
    """
    try:
        # Only academic template supported currently
        if not template or str(template).lower() not in ("academic", "academic_research", "research", "paper"):
            raise HTTPException(400, "Unsupported or missing template. Supported: academic")

        academic_profile = {
            "name": "academic_research",
            "page_size": (595, 842),  # A4
            "margin": 72,
            "font_family": "times",
            "base_size": 12,
            "line_spacing": 1.5,
            "heading_sizes": {1: 16, 2: 14, 3: 12},
            "section_order": [
                "titlepage","abstract","keywords","introduction","methods","results","discussion","conclusion","references","figures","tables","supplementary","body"
            ],
            "required_sections": ["abstract","introduction","methods","results","discussion","references"],
        }

        # Load files
        files_data = []
        import hashlib, re
        seen_hashes = set()
        duplicates = []
        for f in files:
            name = f.filename or ""
            name_lower = name.lower()
            ctype = (f.content_type or "").lower()
            data = await f.read()
            h = hashlib.sha256(data).hexdigest()
            if h in seen_hashes:
                duplicates.append(name)
                # still include in roles to inform user but mark duplicate
            else:
                seen_hashes.add(h)
            files_data.append({"name": name, "name_lower": name_lower, "ctype": ctype, "data": data})

        # Helpers
        def extract_text_snippet(fd):
            try:
                if fd["ctype"] == "application/pdf" or fd["name_lower"].endswith(".pdf"):
                    d = fitz.open(stream=fd["data"], filetype="pdf")
                    txt = "\n".join(d.load_page(i).get_text("text") for i in range(min(2, d.page_count)))
                    d.close()
                    return txt
                elif fd["ctype"].endswith("officedocument.wordprocessingml.document") or fd["name_lower"].endswith(".docx"):
                    try:
                        from docx import Document
                        d = Document(io.BytesIO(fd["data"]))
                        return "\n".join(p.text for p in d.paragraphs[:50])
                    except Exception:
                        return ""
                elif fd["ctype"].startswith("text/") or fd["name_lower"].endswith(".txt"):
                    return fd["data"].decode("utf-8", errors="ignore")[:5000]
            except Exception:
                return ""
            return ""

        def detect_academic_role(fd):
            n = fd["name_lower"] or ""
            t = extract_text_snippet(fd)
            # Filename hints
            hints = [
                ("title", "titlepage"), ("cover", "titlepage"), ("abstract", "abstract"),
                ("keyword", "keywords"), ("intro", "introduction"), ("method", "methods"),
                ("materials", "methods"), ("result", "results"), ("discussion", "discussion"),
                ("conclusion", "conclusion"), ("reference", "references"), ("fig", "figures"),
                ("table", "tables"), ("supp", "supplementary"),
            ]
            for key, role in hints:
                if key in n:
                    return role, "filename"
            # Content heuristics
            patterns = [
                (r"^\s*abstract\b", "abstract"),
                (r"^\s*keywords?\b", "keywords"),
                (r"^\s*introduction\b", "introduction"),
                (r"methods?|materials and methods", "methods"),
                (r"^\s*results\b", "results"),
                (r"^\s*discussion\b", "discussion"),
                (r"^\s*conclusions?\b", "conclusion"),
                (r"^\s*references\b|^\s*bibliography\b", "references"),
            ]
            lower = (t or "").lower()
            for pat, role in patterns:
                try:
                    if re.search(pat, lower, flags=re.M):
                        return role, "content"
                except Exception:
                    continue
            if len(lower) < 400:
                return "titlepage", "fallback"
            return "body", "fallback"

        # Detect roles
        for fd in files_data:
            role, source = detect_academic_role(fd)
            fd["role"] = role
            fd["role_source"] = source

        # Validate required sections
        found_roles = {fd["role"] for fd in files_data}
        missing = [sec for sec in academic_profile["required_sections"] if sec not in found_roles]

        # Suggested order
        order_index = {sec: i for i, sec in enumerate(academic_profile["section_order"])}
        suggested = sorted(files_data, key=lambda x: order_index.get(x.get("role", "body"), 999))

        return {
            "template": academic_profile["name"],
            "missing": missing,
            "duplicates": duplicates,
            "sections": [
                {"name": fd["name"], "type": fd["ctype"], "role": fd["role"], "roleSource": fd["role_source"]}
                for fd in files_data
            ],
            "suggestedOrder": [fd["name"] for fd in suggested],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Validation error: {e}")


@router.post("/smart-merge-jsons-to-pdf")
async def smart_merge_jsons(files: List[UploadFile] = File(...)):
    """Upload JSON files and merge into a PDF with TOC"""
    try:
        raw_pages = []
        for f in files:
            data = await f.read()
            js = json.loads(data)
            if isinstance(js, dict) and "pages" in js:
                raw_pages.extend(js["pages"])
            elif isinstance(js, list):
                raw_pages.extend(js)
            elif isinstance(js, dict):
                raw_pages.append(js)

        pages = []
        seen = set()
        for pg in raw_pages:
            content = page_main_text(pg)
            h = content.strip().lower()
            if h and h not in seen and not is_unwanted_page(content):
                seen.add(h)
                pages.append(pg)

        toc_entries = extract_headings_from_pages(pages)
        toc_pdf_bytes = create_toc_page_direct(toc_entries)
        final_pdf_bytes = merge_jsons_to_pdf_bytes(toc_pdf_bytes, pages)
        return StreamingResponse(io.BytesIO(final_pdf_bytes), media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=document-with-toc.pdf"})
    except Exception as e:
        raise HTTPException(500, f"Error: {str(e)}")


def render_text_to_pdf_bytes(text: str, page_size=(595, 842), margin=50, style_profile=None):
    """Render plain text into a simple PDF using PyMuPDF with word wrapping.
    Returns (pdf_bytes, first_page_local_index).
    """
    W, H = page_size
    doc = fitz.open()
    # Apply style profile overrides
    fontname = _canonical_base14_family((style_profile.get("font_family") if style_profile else "helvetica"))
    fontsize = (style_profile.get("base_size") if style_profile else 12)
    line_spacing = (style_profile.get("line_spacing") if style_profile else 1.4)
    line_height = fontsize * max(1.1, float(line_spacing))
    max_width = W - 2 * margin
    y = margin
    page = doc.new_page(width=W, height=H)
    first_page_index = 1

    # Simple word wrapping
    import textwrap

    # Replace tabs and CRLFs
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    paragraphs = text.split("\n\n")
    for para in paragraphs:
        for line in para.split("\n"):
            # rough wrap at ~90 chars - not perfect but adequate for fallback
            wraps = textwrap.wrap(line, width=90) or [""]
            for wline in wraps:
                if y + line_height > H - margin:
                    page = doc.new_page(width=W, height=H)
                    y = margin
                page.insert_text((margin, y), wline, fontsize=fontsize, fontname=fontname, color=(0, 0, 0))
                y += line_height
        # paragraph spacing
        y += line_height * 0.5

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes, first_page_index


def render_text_to_pdf_with_headings(text: str, page_size=(595, 842), margin=50, style_profile=None):
    """Render TXT with simple word wrap and detect headings to build TOC.
    Returns (pdf_bytes, first_page_local_index, headings) where
    headings = [(title:str, level:int, page:int)] using local 1-based page index.
    """
    W, H = page_size
    doc = fitz.open()
    fontname = _canonical_base14_family((style_profile.get("font_family") if style_profile else "helvetica"))
    fontsize = (style_profile.get("base_size") if style_profile else 12)
    line_spacing = (style_profile.get("line_spacing") if style_profile else 1.4)
    line_height = fontsize * max(1.1, float(line_spacing))
    y = margin
    page = doc.new_page(width=W, height=H)
    first_page_index = 1
    headings = []

    import re, textwrap

    def new_page_if_needed(extra=0):
        nonlocal page, y
        if y + extra > H - margin:
            page = doc.new_page(width=W, height=H)
            y = margin

    # Heuristic heading detectors
    def detect_heading(line: str):
        s = (line or "").strip()
        if not s:
            return None
        # Strong patterns: Roman numerals or numeric outlines or trailing colon
        if re.match(r"^[IVXLCDM]+\.[\s\-].{1,120}$", s):
            return (s, 0)
        if re.match(r"^\d+(\.\d+)?\.[\s\-].{1,120}$", s):
            # 1. or 1.1.
            lvl = 0 if re.match(r"^\d+\.[\s\-]", s) else 1
            return (s, lvl)
        if re.match(r"^[A-Z][A-Z\s\-]{3,120}$", s) and len(s.split()) <= 8:
            return (s, 0)
        if re.match(r"^[A-Z][A-Za-z\s]{1,120}:$", s):
            return (s, 1)
        # Keywords
        kw = ["abstract", "introduction", "methods", "results", "discussion", "conclusion", "references"]
        if s.lower().rstrip(":.") in kw:
            return (s, 0)
        return None

    # Normalize line endings and wrap
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = text.split("\n")
    for raw in lines:
        # Detect heading before wrapping
        heading = detect_heading(raw)
        wrapped = textwrap.wrap(raw, width=90) or [""]
        # draw
        for idx, wline in enumerate(wrapped):
            new_page_if_needed(line_height)
            page.insert_text((margin, y), wline, fontsize=fontsize, fontname=fontname, color=(0, 0, 0))
            # record heading on first wrapped line only
            if heading and idx == 0:
                title, lvl = heading
                headings.append((title.strip(), int(lvl), doc.page_count))
            y += line_height
        # paragraph spacing between original lines
        y += line_height * 0.1

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes, first_page_index, headings


def render_docx_to_pdf_with_headings(data: bytes, page_size=(595, 842), margin=50, style_profile=None):
    """Render DOCX (text + tables + images) and collect headings (H1-H3) with their local page numbers.
    Returns (pdf_bytes, headings) where headings = [(title:str, level:int, page:int)].
    """
    try:
        from docx import Document
        from docx.table import Table
        from docx.text.paragraph import Paragraph
        from docx.oxml.ns import qn
    except Exception as e:
        raise HTTPException(500, f"DOCX support requires python-docx: {e}")

    # Pillow for image size
    try:
        from PIL import Image
    except Exception:
        Image = None  # we'll still insert images with a default height if Pillow isn't available
    import re

    docx_doc = Document(io.BytesIO(data))
    W, H = page_size
    pdf = fitz.open()
    y = margin
    page = pdf.new_page(width=W, height=H)
    headings = []

    # Typography and layout
    # Apply style profile overrides
    base_font = _canonical_base14_family((style_profile.get("font_family") if isinstance(style_profile, dict) and style_profile else "helvetica"))
    base_size = (style_profile.get("base_size") if isinstance(style_profile, dict) else 12) or 12
    line_spacing = (style_profile.get("line_spacing") if isinstance(style_profile, dict) else 1.4) or 1.4
    line_height = base_size * max(1.1, float(line_spacing))
    h_sizes = (style_profile.get("heading_sizes") if isinstance(style_profile, dict) and style_profile.get("heading_sizes") else {1: 18, 2: 14, 3: 12})
    first_line_indent = 18
    max_text_chars = 90  # approx for full width; used for wrapping estimates

    def new_page_if_needed(extra=0):
        nonlocal page, y
        if y + extra > H - margin:
            page = pdf.new_page(width=W, height=H)
            y = margin

    EMU_PER_INCH = 914400
    POINTS_PER_INCH = 72.0

    def text_width(txt: str, fontname: str, fontsize: float) -> float:
        try:
            return fitz.get_text_length(txt, fontname=fontname, fontsize=fontsize)
        except Exception:
            # Fallback rough estimate
            return max(0, len(txt)) * (fontsize * 0.5)

    def font_variant(base: str, bold: bool, italic: bool) -> str:
        fam = _canonical_base14_family(base)
        # Build variant name using base-14 canonical names
        if fam == "helvetica":
            if bold and italic:
                return "helvetica-BoldOblique"
            if bold:
                return "helvetica-Bold"
            if italic:
                return "helvetica-Oblique"
            return "helvetica"
        if fam == "times-roman":
            if bold and italic:
                return "times-bolditalic"
            if bold:
                return "times-bold"
            if italic:
                return "times-italic"
            return "times-roman"
        if fam == "courier":
            if bold and italic:
                return "courier-boldoblique"
            if bold:
                return "courier-bold"
            if italic:
                return "courier-oblique"
            return "courier"
        return fam

    def run_style(run):
        # Determine run style approximations
        r_font = getattr(run.font, 'name', None) or base_font
        r_bold = bool(getattr(run, 'bold', False)) or bool(getattr(run.font, 'bold', False))
        r_italic = bool(getattr(run, 'italic', False)) or bool(getattr(run.font, 'italic', False))
        r_underline = bool(getattr(run, 'underline', False)) or bool(getattr(run.font, 'underline', False))
        size_len = getattr(run.font, 'size', None)
        r_size = base_size
        try:
            if size_len is not None:
                # python-docx Length has .pt
                r_size = float(getattr(size_len, 'pt', base_size)) or base_size
        except Exception:
            r_size = base_size
        # Color
        r_color = (0, 0, 0)
        try:
            c = getattr(run.font, 'color', None)
            rgb = getattr(c, 'rgb', None)
            if rgb is not None:
                # RGBColor like 0xRRGGBB or object supporting .rgb
                try:
                    ival = int(str(rgb), 16)
                    r = ((ival >> 16) & 0xFF) / 255.0
                    g = ((ival >> 8) & 0xFF) / 255.0
                    b = (ival & 0xFF) / 255.0
                    r_color = (r, g, b)
                except Exception:
                    pass
        except Exception:
            pass
        r_fontname = font_variant(r_font, r_bold, r_italic)
        return r_fontname, r_size, r_color, r_underline

    def layout_and_draw_runs(par_text_runs, max_w: float, first_indent: float = 0.0):
        """Lay out runs with simple word-wrapping; draw per-run with styling and underline."""
        nonlocal y, page
        # Tokenize runs into pieces (token text + style)
        tokens = []  # list of dicts with text, fontname, size, color, underline
        for txt, fn, fs, col, und in par_text_runs:
            if not txt:
                continue
            parts = re.split(r'(\S+\s*)', txt)
            for p in parts:
                if p is None or p == "":
                    continue
                # preserve newlines as explicit breaks
                if "\n" in p:
                    subs = p.split("\n")
                    for i, s in enumerate(subs):
                        if s:
                            tokens.append({"text": s, "fontname": fn, "size": fs, "color": col, "underline": und})
                        if i < len(subs) - 1:
                            tokens.append({"text": "\n", "fontname": fn, "size": fs, "color": col, "underline": und})
                else:
                    tokens.append({"text": p, "fontname": fn, "size": fs, "color": col, "underline": und})

        x_start = margin + first_indent
        curr_x = x_start
        line_segments = []  # [(text, x, fontname, size, color, underline)] for current line
        max_line_size = 0.0

        def flush_line():
            nonlocal y, curr_x, line_segments, max_line_size
            if not line_segments:
                return
            # Draw
            for seg in line_segments:
                txt, x, fn, fs, col, und = seg
                page.insert_text((x, y), txt, fontsize=fs, fontname=fn, color=col)
                if und and txt.strip():
                    try:
                        underline_y = y + fs * 0.15
                        seg_w = text_width(txt, fn, fs)
                        page.draw_line(p1=(x, underline_y), p2=(x + seg_w, underline_y), color=col, width=0.6)
                    except Exception:
                        pass
            # Advance to next line
            line_h = max(12.0, max_line_size * 1.35)
            y += line_h
            curr_x = margin
            line_segments = []
            max_line_size = 0.0

        for tok in tokens:
            if tok["text"] == "\n":
                flush_line()
                curr_x = margin
                continue
            # wrap if needed
            t_w = text_width(tok["text"], tok["fontname"], tok["size"])
            if curr_x + t_w > margin + max_w and tok["text"].strip():
                flush_line()
            # New page if needed before drawing baseline of new line
            new_page_if_needed(max(12.0, (max_line_size or tok["size"]) * 1.35))
            # append segment
            line_segments.append((tok["text"], curr_x, tok["fontname"], tok["size"], tok["color"], tok["underline"]))
            curr_x += t_w
            if tok["size"] > max_line_size:
                max_line_size = tok["size"]
        # flush rest
        flush_line()
        # paragraph spacing
        y += (base_size * 1.4) * 0.2

    def draw_image(img_bytes: bytes, req_w_pts: float = None, req_h_pts: float = None, max_w: float = None):
        """Insert image, honoring requested Word size if provided; otherwise scale to fit max_w."""
        nonlocal y, page
        try:
            if Image is not None:
                with Image.open(io.BytesIO(img_bytes)) as im:
                    iw, ih = im.size
            else:
                iw, ih = 800, 600  # fallback guess
        except Exception:
            iw, ih = 800, 600

        # Default max_w to full width
        if max_w is None:
            max_w = W - 2*margin

        # If Word specified a requested size (in points), use it but keep it within page
        if req_w_pts and req_h_pts:
            draw_w = min(req_w_pts, max_w)
            # scale height proportionally to not exceed page height
            scale_h = min(1.0, (H - 2*margin) / req_h_pts)
            draw_h = req_h_pts * scale_h
            # maintain aspect ratio if resized due to width cap
            if draw_w < req_w_pts:
                ar = req_h_pts / max(req_w_pts, 1e-6)
                draw_h = min(draw_w * ar, H - 2*margin)
        else:
            # Use intrinsic pixels and scale to fit
            scale = min(max_w / iw, (H - 2*margin) / ih)
            draw_w = max(10, iw * scale)
            draw_h = max(10, ih * scale)
        new_page_if_needed(draw_h + line_height)
        rect = fitz.Rect(margin, y, margin + draw_w, y + draw_h)
        try:
            page.insert_image(rect, stream=img_bytes)
        except Exception:
            # ignore bad images
            pass
        y += draw_h + line_height * 0.5

    def iter_block_items(doc):
        """Yield paragraphs and tables in document order."""
        parent_elm = doc.element.body
        for child in parent_elm.iterchildren():
            if child.tag.endswith('}p'):
                yield Paragraph(child, doc)
            elif child.tag.endswith('}tbl'):
                yield Table(child, doc)

    def paragraph_has_images(par):
        # Detect any drawing blips inside paragraph runs
        for run in par.runs:
            try:
                blips = run._element.xpath('.//a:blip', namespaces={
                    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
                    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                })
                if blips:
                    return True
            except Exception:
                continue
        return False

    def render_paragraph(par: Paragraph):
        nonlocal y, page
        style = (getattr(par.style, 'name', '') or '').lower()
        text = (par.text or '').strip()

        # Heading detection first
        if text:
            if 'heading 1' in style:
                fsize = h_sizes[1]
                if y != margin:
                    page = pdf.new_page(width=W, height=H)
                    y = margin
                headings.append((text, 0, pdf.page_count))
                new_page_if_needed(fsize * 2)
                page.insert_text((margin, y), text, fontsize=fsize, fontname=base_font, color=(0,0,0))
                y += fsize * 1.6
                return
            elif 'heading 2' in style:
                fsize = h_sizes[2]
                new_page_if_needed(fsize * 2)
                headings.append((text, 1, pdf.page_count))
                page.insert_text((margin, y), text, fontsize=fsize, fontname=base_font, color=(0,0,0))
                y += fsize * 1.4
                return
            elif 'heading 3' in style:
                fsize = h_sizes[3]
                new_page_if_needed(fsize * 2)
                headings.append((text, 2, pdf.page_count))
                page.insert_text((margin+10, y), text, fontsize=fsize, fontname=base_font, color=(0,0,0))
                y += fsize * 1.3
                return

        # Images in paragraph
        try:
            ns = {
                'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
                'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
            }
            for run in par.runs:
                blips = run._element.xpath('.//a:blip', namespaces=ns)
                # Try to find size from nearest wp:inline/wp:anchor extent
                ext_nodes = run._element.xpath('.//wp:inline/wp:extent | .//wp:anchor/wp:extent', namespaces=ns)
                req_w_pts = req_h_pts = None
                if ext_nodes:
                    try:
                        ext = ext_nodes[0]
                        cx = float(ext.get('cx') or 0)
                        cy = float(ext.get('cy') or 0)
                        if cx > 0 and cy > 0:
                            req_w_pts = (cx / EMU_PER_INCH) * POINTS_PER_INCH
                            req_h_pts = (cy / EMU_PER_INCH) * POINTS_PER_INCH
                    except Exception:
                        req_w_pts = req_h_pts = None
                for blip in blips:
                    rId = blip.get(qn('r:embed')) if hasattr(qn, '__call__') else blip.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                    if not rId:
                        continue
                    try:
                        part = par.part.related_parts.get(rId)
                        if not part:
                            continue
                        img_bytes = part.blob
                        draw_image(img_bytes, req_w_pts=req_w_pts, req_h_pts=req_h_pts, max_w=W - 2*margin)
                    except Exception:
                        continue
        except Exception:
            pass

        # Paragraph text
        if not text and not paragraph_has_images(par):
            y += line_height * 0.6
            return
        # Build run segments with styles
        run_segments = []
        for run in par.runs:
            rtxt = run.text or ""
            if rtxt:
                fn, fs, col, und = run_style(run)
                run_segments.append((rtxt, fn, fs, col, und))
        if not run_segments and text:
            # Fallback single style
            run_segments = [(text, base_font, base_size, (0,0,0), False)]
        max_w = (W - 2*margin)
        layout_and_draw_runs(run_segments, max_w=max_w, first_indent=first_line_indent)

    def render_table(tbl: Table):
        nonlocal y, page
        # Advanced grid with merges, alignment, shading, borders
        cols = len(tbl.columns)
        if cols == 0:
            return
        avail_w = (W - 2*margin)
        cell_pad = 6
        import textwrap

        # Column widths from tblGrid if present
        col_widths_pts = []
        try:
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            grid_cols = tbl._tbl.xpath('.//w:tblGrid/w:gridCol', namespaces=ns)
            raw_twips = [int(gc.get(qn('w:w')) or gc.get('w') or 0) for gc in grid_cols] or []
            if raw_twips and len(raw_twips) >= cols:
                total_pts = sum(v/20.0 for v in raw_twips)
                scale = (avail_w / total_pts) if total_pts > 0 else 1.0
                col_widths_pts = [(v/20.0) * scale for v in raw_twips[:cols]]
        except Exception:
            col_widths_pts = []
        if not col_widths_pts or len(col_widths_pts) != cols:
            col_widths_pts = [avail_w / cols] * cols

        # Precompute column x positions
        col_x = [margin]
        for cw in col_widths_pts:
            col_x.append(col_x[-1] + cw)

        # Helpers
        def parse_hex_color(val):
            if not val or val in ("auto", "none"):
                return None
            try:
                ival = int(str(val).replace('#',''), 16)
                r = ((ival >> 16) & 0xFF) / 255.0
                g = ((ival >> 8) & 0xFF) / 255.0
                b = (ival & 0xFF) / 255.0
                return (r, g, b)
            except Exception:
                return None

        # Build logical grid with merges
        # grid[r][c] = None or reference to origin or cell dict {r0,c0,row_span,col_span, tc, props}
        n_rows = len(tbl.rows)
        grid = [[None for _ in range(cols)] for _ in range(n_rows)]
        origins = []

        # Read properties extractor
        def cell_props(cell):
            props = {"shading": None, "borders": {}, "v_align": "top"}
            try:
                tcPr = cell._tc.tcPr
                if tcPr is None:
                    return props
                # shading
                shd = getattr(tcPr, 'shd', None)
                if shd is not None:
                    fill = getattr(shd, 'fill', None) or shd.get(qn('w:fill')) if hasattr(shd, 'get') else None
                    col = parse_hex_color(fill)
                    if col:
                        props["shading"] = col
                # borders
                b = getattr(tcPr, 'tcBorders', None)
                if b is not None:
                    for side in ('top','left','bottom','right'):
                        el = getattr(b, side, None)
                        if el is None:
                            continue
                        val = getattr(el, 'val', None) or (el.get(qn('w:val')) if hasattr(el,'get') else None)
                        if str(val).lower() in ("nil","none"):
                            continue
                        sz = getattr(el, 'sz', None) or (el.get(qn('w:sz')) if hasattr(el,'get') else None)
                        try:
                            width_pt = (int(sz)/8.0) if sz is not None else 0.6
                        except Exception:
                            width_pt = 0.6
                        color = getattr(el, 'color', None) or (el.get(qn('w:color')) if hasattr(el,'get') else None) or '000000'
                        col = parse_hex_color(color) or (0,0,0)
                        props["borders"][side] = {"width": max(0.3, width_pt), "color": col}
                # vertical alignment
                vA = getattr(tcPr, 'vAlign', None)
                if vA is not None:
                    vval = getattr(vA, 'val', None) or (vA.get(qn('w:val')) if hasattr(vA,'get') else None)
                    if str(vval).lower() in ("center","middle"):
                        props["v_align"] = "center"
                    elif str(vval).lower() == "bottom":
                        props["v_align"] = "bottom"
            except Exception:
                pass
            return props

        for r_idx, row in enumerate(tbl.rows):
            c_idx = 0
            # iterate xml cells to get span info in order
            tcs = [c._tc for c in row.cells]
            for cell in row.cells:
                tc = cell._tc
                # advance c_idx to next free column
                while c_idx < cols and grid[r_idx][c_idx] is not None:
                    c_idx += 1
                if c_idx >= cols:
                    break
                # gridSpan
                try:
                    gspan_el = tc.tcPr.gridSpan if tc.tcPr is not None else None
                    col_span = int(getattr(gspan_el, 'val', 1)) if gspan_el is not None else 1
                except Exception:
                    col_span = 1
                col_span = max(1, min(col_span, cols - c_idx))
                # vMerge
                vmerge_type = None  # None, 'restart', 'continue'
                try:
                    vm = tc.tcPr.vMerge if tc.tcPr is not None else None
                    if vm is not None:
                        vval = getattr(vm, 'val', None) or (vm.get(qn('w:val')) if hasattr(vm,'get') else None)
                        vmerge_type = str(vval).lower() if vval is not None else 'continue'
                except Exception:
                    vmerge_type = None

                if vmerge_type == 'continue' and r_idx > 0:
                    # attach to origin above
                    origin = grid[r_idx-1][c_idx]
                    if isinstance(origin, dict):
                        # mark this row as continuation for all spanned columns from origin
                        for cc in range(origin['c0'], origin['c0'] + origin['col_span']):
                            if c_idx <= cc < c_idx + col_span and cc < cols:
                                grid[r_idx][cc] = origin
                    else:
                        # fallback: treat as single cell
                        origin = None
                    if origin is None:
                        # create dummy single cell if broken merge
                        props = cell_props(cell)
                        cell_dict = {"r0": r_idx, "c0": c_idx, "row_span": 1, "col_span": col_span, "cell": cell, "props": props}
                        origins.append(cell_dict)
                        for cc in range(c_idx, c_idx+col_span):
                            grid[r_idx][cc] = cell_dict
                else:
                    props = cell_props(cell)
                    cell_dict = {"r0": r_idx, "c0": c_idx, "row_span": 1, "col_span": col_span, "cell": cell, "props": props}
                    origins.append(cell_dict)
                    for cc in range(c_idx, c_idx+col_span):
                        if cc < cols:
                            grid[r_idx][cc] = cell_dict
                c_idx += col_span

        # Compute row spans by scanning continuations
        for origin in origins:
            r0, c0, col_span = origin['r0'], origin['c0'], origin['col_span']
            rs = 1
            rr = r0 + 1
            while rr < n_rows and grid[rr][c0] is origin:
                rs += 1
                rr += 1
            origin['row_span'] = rs

        # Estimate row heights and ensure page has space; compute total table height first
        def measure_cell_content(cell_obj, width):
            # measure number of lines using base_size/line_height and run-aware wrapping
            paragraphs = cell_obj['cell'].paragraphs
            total_lines = 0
            for p in paragraphs:
                # Build runs
                runs = []
                for run in p.runs:
                    txt = run.text or ""
                    if not txt:
                        continue
                    fn, fs, col, und = run_style(run)
                    runs.append((txt, fn, fs, col, und))
                # Tokenize and wrap
                if not runs:
                    total_lines += 1
                    continue
                # simple estimate: split by spaces and pack by width
                tokens = []
                for txt, fn, fs, col, und in runs:
                    parts = re.split(r'(\S+\s*)', txt)
                    for pt in parts:
                        if not pt:
                            continue
                        tokens.append((pt, fn, fs, col, und))
                curr_w = 0
                for ttxt, tfn, tfs, tcol, tund in tokens:
                    if "\n" in ttxt:
                        parts_n = ttxt.split("\n")
                        for idx, seg in enumerate(parts_n):
                            if seg:
                                w = text_width(seg, tfn, tfs)
                                if curr_w + w > width and curr_w > 0:
                                    total_lines += 1
                                    curr_w = 0
                                curr_w += w
                            total_lines += 1  # line break
                            curr_w = 0
                        continue
                    w = text_width(ttxt, tfn, tfs)
                    if curr_w + w > width and curr_w > 0 and ttxt.strip():
                        total_lines += 1
                        curr_w = 0
                    curr_w += w
                if curr_w > 0:
                    total_lines += 1
            return max(1, total_lines) * line_height + cell_pad*2

        # initial row heights
        row_heights = [line_height + cell_pad*2 for _ in range(n_rows)]
        for origin in origins:
            width = sum(col_widths_pts[origin['c0']:origin['c0']+origin['col_span']])
            h_needed = measure_cell_content(origin, width)
            span = origin['row_span']
            h_current = sum(row_heights[origin['r0']:origin['r0']+span])
            if h_needed > h_current:
                # add the extra to first row of the span
                row_heights[origin['r0']] += (h_needed - h_current)

        total_h = sum(row_heights)
        if y + total_h > H - margin:
            # move to next page if the whole table doesn't fit; if too big, it will paginate naturally by subsequent calls
            page = pdf.new_page(width=W, height=H)
            y = margin

        # Draw cells (shading, borders, text)
        row_y_positions = [y]
        for rh in row_heights:
            row_y_positions.append(row_y_positions[-1] + rh)

        # Paragraph horizontal alignment helper
        def para_align(p):
            try:
                from docx.enum.text import WD_ALIGN_PARAGRAPH
                a = p.paragraph_format.alignment
                if a == WD_ALIGN_PARAGRAPH.CENTER:
                    return 'center'
                if a == WD_ALIGN_PARAGRAPH.RIGHT:
                    return 'right'
                if a == WD_ALIGN_PARAGRAPH.JUSTIFY:
                    return 'justify'
            except Exception:
                pass
            # also try underlying jc
            try:
                jc = p._p.pPr.jc.val
                if str(jc).lower() in ('center','right','justify'):
                    return str(jc).lower()
            except Exception:
                pass
            return 'left'

        # Draw loop: only draw for origin cells to avoid duplicates
        for origin in origins:
            r0, c0, rs, cs = origin['r0'], origin['c0'], origin['row_span'], origin['col_span']
            x0 = col_x[c0]
            x1 = col_x[c0 + cs]
            y0 = row_y_positions[r0]
            y1 = row_y_positions[r0 + rs]
            rect = fitz.Rect(x0, y0, x1, y1)

            # Shading
            if origin['props'].get('shading'):
                try:
                    page.draw_rect(rect, fill=origin['props']['shading'], color=origin['props'].get('shading'))
                except Exception:
                    pass

            # Borders (fallback to thin black if not specified)
            def draw_side(side, x0, y0, x1, y1):
                b = origin['props']['borders'].get(side)
                width = b['width'] if b else 0.6
                color = b['color'] if b else (0,0,0)
                try:
                    if side == 'top':
                        page.draw_line((x0, y0), (x1, y0), color=color, width=width)
                    elif side == 'bottom':
                        page.draw_line((x0, y1), (x1, y1), color=color, width=width)
                    elif side == 'left':
                        page.draw_line((x0, y0), (x0, y1), color=color, width=width)
                    elif side == 'right':
                        page.draw_line((x1, y0), (x1, y1), color=color, width=width)
                except Exception:
                    pass

            draw_side('top', rect.x0, rect.y0, rect.x1, rect.y1)
            draw_side('bottom', rect.x0, rect.y0, rect.x1, rect.y1)
            draw_side('left', rect.x0, rect.y0, rect.x1, rect.y1)
            draw_side('right', rect.x0, rect.y0, rect.x1, rect.y1)

            # Text rendering inside cell with vertical alignment
            content_w = rect.width - 2*cell_pad
            paragraphs = origin['cell'].paragraphs

            # Build lines for all paragraphs to compute height
            lines = []  # list of dict {segments:[(txt,fn,fs,col,und)], width:float, align:str}
            for p in paragraphs:
                runs = []
                for run in p.runs:
                    txt = run.text or ""
                    if not txt:
                        continue
                    fn, fs, col, und = run_style(run)
                    runs.append((txt, fn, fs, col, und))
                if not runs:
                    # blank line
                    lines.append({"segments": [("", base_font, base_size, (0,0,0), False)], "width": 0.0, "align": para_align(p)})
                    continue
                # tokenize across runs
                tokens = []
                for txt, fn, fs, col, und in runs:
                    parts = re.split(r'(\S+\s*)', txt)
                    for pt in parts:
                        if pt is None or pt == "":
                            continue
                        tokens.append((pt, fn, fs, col, und))
                curr_line = []
                curr_width = 0.0
                for ttxt, tfn, tfs, tcol, tund in tokens:
                    if "\n" in ttxt:
                        subs = ttxt.split("\n")
                        for i2, seg in enumerate(subs):
                            if seg:
                                w = text_width(seg, tfn, tfs)
                                if curr_width + w > content_w and curr_width > 0:
                                    lines.append({"segments": curr_line, "width": curr_width, "align": para_align(p)})
                                    curr_line = []
                                    curr_width = 0.0
                                curr_line.append((seg, tfn, tfs, tcol, tund))
                                curr_width += w
                            # line break
                            lines.append({"segments": curr_line, "width": curr_width, "align": para_align(p)})
                            curr_line = []
                            curr_width = 0.0
                        continue
                    w = text_width(ttxt, tfn, tfs)
                    if curr_width + w > content_w and curr_width > 0 and ttxt.strip():
                        lines.append({"segments": curr_line, "width": curr_width, "align": para_align(p)})
                        curr_line = []
                        curr_width = 0.0
                    curr_line.append((ttxt, tfn, tfs, tcol, tund))
                    curr_width += w
                if curr_line:
                    lines.append({"segments": curr_line, "width": curr_width, "align": para_align(p)})

            content_h = max(line_height, len(lines) * line_height)
            v_align = origin['props'].get('v_align', 'top')
            if v_align == 'center':
                base_y = rect.y0 + (rect.height - content_h)/2 + line_height
            elif v_align == 'bottom':
                base_y = rect.y1 - cell_pad - (len(lines)-1)*line_height
            else:
                base_y = rect.y0 + cell_pad + line_height

            # Draw lines with alignment
            for idx, line in enumerate(lines):
                if not line['segments']:
                    base_y += line_height
                    continue
                lx = rect.x0 + cell_pad
                if line['align'] == 'right':
                    lx = rect.x1 - cell_pad - line['width']
                elif line['align'] == 'center':
                    lx = rect.x0 + (rect.width - line['width'])/2
                # else left/justify -> left baseline
                cx = lx
                for seg in line['segments']:
                    txt, fn, fs, col, und = seg
                    page.insert_text((cx, base_y), txt, fontsize=fs, fontname=fn, color=col)
                    if und and txt.strip():
                        try:
                            uw = text_width(txt, fn, fs)
                            page.draw_line((cx, base_y + fs*0.15), (cx + uw, base_y + fs*0.15), color=col, width=0.6)
                        except Exception:
                            pass
                    cx += text_width(txt, fn, fs)
                base_y += line_height

        # Advance cursor after table
        y = row_y_positions[-1] + line_height * 0.6

    # Iterate blocks in document order
    for block in iter_block_items(docx_doc):
        if isinstance(block, Paragraph):
            render_paragraph(block)
        elif isinstance(block, Table):
            render_table(block)

    pdf_bytes = pdf.tobytes()
    pdf.close()
    return pdf_bytes, headings


@router.post("/preview-first-page")
async def preview_first_page(file: UploadFile = File(...)):
    """Return a PNG preview of the first page for PDF/DOCX/TXT."""
    name = (file.filename or "").lower()
    ctype = (file.content_type or "").lower()
    data = await file.read()

    page_size = (595, 842)
    try:
        if ctype == 'application/pdf' or name.endswith('.pdf'):
            d = fitz.open(stream=data, filetype='pdf')
        elif ctype.endswith('officedocument.wordprocessingml.document') or name.endswith('.docx'):
            pdf_bytes, _ = render_docx_to_pdf_with_headings(data, page_size=page_size)
            d = fitz.open('pdf', pdf_bytes)
        elif ctype.startswith('text/') or name.endswith('.txt'):
            text = data.decode('utf-8', errors='ignore')
            pdf_bytes, _, _ = render_text_to_pdf_with_headings(text, page_size=page_size)
            d = fitz.open('pdf', pdf_bytes)
        else:
            raise HTTPException(415, 'Unsupported type for preview')

        page = d.load_page(0)
        pm = page.get_pixmap(dpi=120)
        png = pm.tobytes('png')
        d.close()
        return StreamingResponse(io.BytesIO(png), media_type='image/png')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Preview error: {e}")
