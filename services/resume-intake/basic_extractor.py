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
VERSION = 'basic-native-tesseract-v2'
MAX_PAGES = 100
RANKS = ('Chief Engineer', 'Second Engineer', 'Third Engineer', 'Fourth Engineer',
         'Chief Officer', 'Second Officer', 'Third Officer', 'Master', 'ETO',
         'Electrical Officer', 'Deck Cadet', 'Engine Cadet', 'Able Seaman', 'Oiler', 'Motorman')
# Labelled values: "Name : X", "Name    X", "Full Name: X". Father's/ship names do not start the line with "Name".
NAME_LABEL = re.compile(r"(?i)^(?:full\s+name|name\.?|candidate'?s?\s+name|name\s+of\s+(?:the\s+)?(?:seafarer|candidate|applicant))(?:\s*[:|]|\s{2,})\s*([^:|]{2,80}?)(?:\s{3,}|$)")
PRESENT_RANK = re.compile(r'(?i)\b(?:present|current)\s+(?:rank|position|designation)\b\s*:?\s*([A-Za-z0-9/.&-][A-Za-z0-9/.& -]{0,40}?)(?:\s{2,}|\s*\||$)|^(?:rank|position|designation)\s*:\s*([A-Za-z0-9/.&-][A-Za-z0-9/.& -]{0,40}?)(?:\s{2,}|\s*\||$)')
APPLIED_RANK = re.compile(r'(?i)\b(?:(?:post|position|rank)\s+applied(?:\s+for)?|applied\s+(?:for\s+)?rank)\b\s*:?\s*([A-Za-z0-9/.&-][A-Za-z0-9/.& -]{0,40}?)(?:[,/(]|\s{2,}|$)')
NOT_A_NAME = re.compile(r'(?i)(post\b|address|certificate|vessel|resume|r e s u m e|curricul|bio\s*-?data|application|availability|details|download|applied|personal|services|officer|engineer|seafarer|cadet|private|limited|certificate|letter|main information)')


def clean_rank(value):
    value = re.split(r'[,/]|\s{2,}', (value or '').strip(' :-'))[0].strip(' .-')
    return value.title() if value.isupper() and len(value) > 4 else value


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
    pages, fields, warnings, local_phones = [], {}, [], []
    labelled_name = False
    total_text=0
    deadline=time.monotonic()+60  # Partial + page evidence on budget exhaustion; never silent truncation.
    def add(key, value, evidence, page, method, confidence=.85):
        value = re.sub(r'\s+', ' ', str(value)).strip()
        if not value: return
        if len(fields.get(key,[]))>=(100 if key=='sea_service' else 10):
            if not any(w.get('code')=='field_suggestion_limit' and w.get('field')==key for w in warnings):warnings.append({'page':page,'code':'field_suggestion_limit','field':key})
            return
        row = {'value': value, 'confidence': confidence, 'evidence': evidence[:500], 'page': page, 'method': method}
        same = next((r for r in fields.setdefault(key, []) if r['value'].lower() == value.lower()), None)
        if same is None: fields[key].append(row)
        elif confidence > same['confidence']: same.update(row)  # a labelled mention outranks a passing one
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
                # The first labelled name on page 1 only: later "Name" columns head
                # sea-service and certificate tables.
                m = NAME_LABEL.match(line) if n == 1 and not labelled_name else None
                if m and re.search(r'[A-Za-z]{2}', m[1]) and not NOT_A_NAME.search(m[1]) and not re.fullmatch(r'(?i)\s*(name|vessel|imo|till|from|to|no)\s*', m[1]):
                    labelled_name = True; add('full_name', m[1].strip(' :-'), line, n, method, .95)
                m = re.match(r'(?i)(?:dob|date of birth)\s*[:|]\s*(\d{4}-\d{2}-\d{2})\s*$', line)
                if m:
                    from datetime import date
                    try: date.fromisoformat(m[1]); add('dob', m[1], line, n, method, .95)
                    except ValueError: warnings.append({'page': n, 'code': 'invalid_birth_date'})
                m = PRESENT_RANK.search(line)
                if m: add('present_rank', clean_rank(m[1] or m[2]), line, n, method, .95)
                m = APPLIED_RANK.search(line)
                if m: add('present_rank', clean_rank(m[1]), line, n, method, .7)
                for rank in RANKS:
                    if re.search(r'(?i)(?<!\w)' + re.escape(rank) + r'(?!\w)', line):
                        add('present_rank', rank, line, n, method, .5)
                if re.search(r'(?i)\b(mobile|phone|contact|tel|cell|whats\s?app)', line):
                    for value in re.findall(r'(?<![\d+])\d[\d -]{8,14}\d(?!\d)', line):
                        digits = re.sub(r'\D', '', value)
                        if 10 <= len(digits) <= 12: local_phones.append((digits, line, n, method))
                m = re.search(r'(?i)(?:(?:vessel|ship)\s*type|type\s+of\s+(?:vessel|ship))\s*[:-]\s*([A-Za-z][A-Za-z /&()-]{1,40}?)\s*(?:[|,;]|$)', line)
                if m: add('vessel_type', m[1], line, n, method, .9)
                if re.search(r'(?i)(sea\s*service|vessel|ship|employment)', line) and re.search(r'\d{4}', line):
                    add('sea_service', line, line, n, method, .5)
            if n == 1 and not fields.get('full_name'):
                for line in text.splitlines()[:8]:
                    first = re.split(r'\s{2,}', line.strip())[0].strip(' -:')
                    if re.fullmatch(r"[A-Za-z][A-Za-z .'-]{3,60}", first) and 2 <= len(first.split()) <= 5 and not NOT_A_NAME.search(first):
                        add('full_name', first, line.strip(), n, method, .5); break
    # Numbers without a country code are offered as written; the recruiter adds it.
    for digits, line, n, method in local_phones:
        if not any(r['value'].endswith(digits[-10:]) for r in fields.get('phone', [])): add('phone', digits, line, n, method, .6)
    if not any(p['status'] == 'readable' and len(p['text'].split('\n\n',1)[-1]) for p in pages): status = 'failed'
    else: status = 'partial' if warnings else 'needs_review'
    return {'contract_version': CONTRACT, 'extractor_version': VERSION, 'status': status,
        'page_count': len(pages), 'pages': pages, 'fields': fields, 'warnings': warnings,
        'conflicts': [key for key, values in fields.items() if len(values) > 1]}
