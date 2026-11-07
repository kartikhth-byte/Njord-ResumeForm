"""Basic, evidence-bearing suggestions only. No model, network or person merge.

Embedded PDF text and per-page Tesseract OCR share one parsing contract. Every
page is accounted for; failures are explicit and never converted to empty PASS.
This is independent of Needle's richer/frozen training conversion path.
"""
import math
import time
import re
import subprocess
import tempfile
from pathlib import Path
import fitz

CONTRACT = 'platform.resume-intake.v1'
VERSION = 'basic-native-tesseract-v1'
MAX_PAGES = 100
RANKS = ('Chief Engineer', 'Second Engineer', 'Third Engineer', 'Fourth Engineer',
         'Chief Officer', 'Second Officer', 'Third Officer', 'Master', 'ETO',
         'Electrical Officer', 'Deck Cadet', 'Engine Cadet', 'Able Seaman', 'Oiler', 'Motorman')


def tesseract_page(page):
    with tempfile.TemporaryDirectory(prefix='holmes-ocr-') as tmp:
        png = Path(tmp) / 'page.png'
        scale=min(2,2500/max(page.rect.width,1),3500/max(page.rect.height,1),math.sqrt(8000000/max(page.rect.width*page.rect.height,1)))
        page.get_pixmap(matrix=fitz.Matrix(scale, scale)).save(png)
        result = subprocess.run(['tesseract', str(png), 'stdout', '-l', 'eng', '--psm', '3'],
            capture_output=True, timeout=20, check=False)
        if result.returncode:
            raise RuntimeError('ocr_unavailable')
        return result.stdout.decode('utf-8', errors='replace')


def extract_pdf(content, ocr=tesseract_page):
    pages, fields, warnings = [], {}, []
    total_text=0
    deadline=time.monotonic()+60  # Partial + page evidence on budget exhaustion; never silent truncation.
    def add(key, value, evidence, page, method, confidence=.85):
        value = re.sub(r'\s+', ' ', str(value)).strip()
        if not value: return
        if len(fields.get(key,[]))>=(100 if key=='sea_service' else 10):
            if not any(w.get('code')=='field_suggestion_limit' and w.get('field')==key for w in warnings):warnings.append({'page':page,'code':'field_suggestion_limit','field':key})
            return
        row = {'value': value, 'confidence': confidence, 'evidence': evidence[:500], 'page': page, 'method': method}
        if not any(r['value'] == value for r in fields.setdefault(key, [])): fields[key].append(row)
    with fitz.open(stream=content, filetype='pdf') as doc:
        if doc.needs_pass or doc.page_count < 1 or doc.page_count > MAX_PAGES:
            raise ValueError('unlocked_pdf_with_1_to_100_pages_required')
        for index, page in enumerate(doc):
            method, text, error = 'pdf_text', page.get_text('text', sort=True), None
            if len(re.sub(r'\s', '', text)) < 40:
                method = 'tesseract_ocr'
                try:
                    if time.monotonic()>deadline:raise TimeoutError('ocr_budget_exceeded')
                    text = ocr(page)
                except Exception as exc:
                    text, error = '', 'ocr_budget_exceeded' if isinstance(exc,TimeoutError) else 'ocr_failed'
                    warnings.append({'page': index + 1, 'code': error})
            if len(text)>120000 or total_text+len(text)>1000000:
                text,error='', 'page_text_limit';warnings.append({'page':index+1,'code':error})
            total_text+=len(text)
            pages.append({'page': index + 1, 'method': method, 'status': 'failed' if error else 'readable',
                'text': f'<!-- page {index+1} -->\n\n{text.strip()}', 'error': error})
            n = index + 1
            for line in text.splitlines():
                line = line.strip()
                for value in re.findall(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', line): add('email', value.lower(), line, n, method)
                for value in re.findall(r'(?<!\w)(?:\+|00)\d[\d ()-]{7,22}\d', line):
                    phone = re.sub(r'[^\d+]', '', value)
                    if phone.startswith('00'): phone = '+' + phone[2:]
                    if re.fullmatch(r'\+[1-9]\d{7,14}', phone): add('phone', phone, line, n, method)
                m = re.match(r'(?i)(?:full\s+name|name)\s*[:|]\s*(.{3,100})$', line)
                if m: add('full_name', m[1], line, n, method, .95)
                m = re.match(r'(?i)(?:dob|date of birth)\s*[:|]\s*(\d{4}-\d{2}-\d{2})\s*$', line)
                if m:
                    from datetime import date
                    try: date.fromisoformat(m[1]); add('dob', m[1], line, n, method, .95)
                    except ValueError: warnings.append({'page': n, 'code': 'invalid_birth_date'})
                for rank in RANKS:
                    if re.search(r'(?i)(?<!\w)' + re.escape(rank) + r'(?!\w)', line):
                        add('present_rank', rank, line, n, method, .9 if re.search(r'(?i)(present|current)\s+rank', line) else .5)
                if re.search(r'(?i)(sea\s*service|vessel|ship|employment)', line) and re.search(r'\d{4}', line):
                    add('sea_service', line, line, n, method, .5)
            if n == 1 and not fields.get('full_name'):
                for line in text.splitlines()[:6]:
                    line = line.strip()
                    if re.fullmatch(r'[A-Za-z][A-Za-z .\'-]{4,70}', line) and 2 <= len(line.split()) <= 5 and not re.search(r'(?i)(resume|curriculum|application|officer|engineer|seafarer)', line):
                        add('full_name', line, line, n, method, .5); break
    if not any(p['status'] == 'readable' and len(p['text'].split('\n\n',1)[-1]) for p in pages): status = 'failed'
    else: status = 'partial' if warnings else 'needs_review'
    return {'contract_version': CONTRACT, 'extractor_version': VERSION, 'status': status,
        'page_count': len(pages), 'pages': pages, 'fields': fields, 'warnings': warnings,
        'conflicts': [key for key, values in fields.items() if len(values) > 1]}
