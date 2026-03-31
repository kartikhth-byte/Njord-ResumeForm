"""
CMA CGM Form Writer — Stage 1 (Section 1 + Photo)

Populates the CMA CGM application form template (XLSX) with:
  - Section 1 text fields from application_data.data.section1
  - Applicant photo from application_data.data.section2.photoStoragePath

Usage:
    python3 write_cma_cgm_section1.py --sample                          # use built-in sample data
    python3 write_cma_cgm_section1.py --applicant-id <UUID>             # fetch from Supabase
    python3 write_cma_cgm_section1.py --sample --photo /path/to/img.jpg # with local photo
    python3 write_cma_cgm_section1.py --sample --out /path/to/out.xlsx  # custom output path

Field mapping (Main sheet):
    C16  ← section1.appliedForRank         (uppercase)
    C17  ← section1.vesselType             (uppercase)
    C18  ← section1.availableFrom          (ddmmyyyy → dd/mm/yyyy)
    E20  ← section1.mediaAdvertisement     (bool → YES / NO)
    E21  ← section1.mediaAdvertisementDetails (text, blank if E20=NO)
    F23  ← section1.professionalRecommendation (bool → YES / NO)
    A25  ← section1.recommendedBy          (text, blank if F23=NO)
    G5:H14 ← section2.photoStoragePath     (image, fit merged range)

Formatting preservation note:
    openpyxl preserves cell XF styles when you set .value directly on an .xlsx file.
    No style re-application dance is needed (unlike the xlutils/xlwt path).
    Fills (sky blue #CCFFFF, indexed=16) and borders (thin grey #969696) survive intact.
"""

import sys
import os
import io
import shutil
import argparse
from datetime import datetime

# ── path setup ──────────────────────────────────────────────────────────────
_script_dir = os.path.dirname(os.path.abspath(__file__))
_pkg_dir = os.path.join(os.path.dirname(_script_dir), '.python-packages')
if os.path.isdir(_pkg_dir):
    sys.path.insert(0, _pkg_dir)

import openpyxl
from openpyxl.drawing.image import Image as XLImage
from PIL import Image


# ── constants ────────────────────────────────────────────────────────────────
TEMPLATE_PATH = os.path.join(_script_dir, 'cma-cgm-form-1.xlsx')
SHEET_NAME = 'Main'

# Pixel approximations for the photo merged range G5:H14.
# Col widths (characters) × 7px/char; row heights (pt) × 1.333px/pt.
# Values read from the template:
#   Col G: 10.8516, Col H: 14.3516  → total ~176px
#   Rows 5–14: 15.75+13+22.5+13+18+13+13+13.25+13+13 = 147.5pt → ~197px
PHOTO_TARGET_W_PX = 176
PHOTO_TARGET_H_PX = 197

# Photo anchor cell (top-left of merged range G5:H14)
PHOTO_ANCHOR = 'G5'


# ── sample data (used when --sample flag is passed) ──────────────────────────
SAMPLE_SECTION1 = {
    'appliedForRank': 'Chief Officer',
    'vesselType': 'Bulk Carrier',
    'availableFrom': '2026-05-01',
    'availableTill': '',
    'mediaAdvertisement': True,
    'mediaAdvertisementDetails': 'LinkedIn Job Posting',
    'professionalRecommendation': True,
    'recommendedBy': 'Captain R. Menon',
}

SAMPLE_PHOTO_PATH = os.path.join(_script_dir, 'placeholder_photo.png')


# ── transforms ───────────────────────────────────────────────────────────────
def transform_uppercase(value: str) -> str:
    """Strip and uppercase a string."""
    if not value:
        return ''
    return str(value).strip().upper()


def transform_ddmmyyyy(value: str) -> str:
    """Convert ISO date (YYYY-MM-DD) → dd/mm/yyyy display string."""
    if not value:
        return ''
    value = str(value).strip()
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y'):
        try:
            return datetime.strptime(value, fmt).strftime('%d/%m/%Y')
        except ValueError:
            continue
    # Unrecognised format — return as-is rather than silently blank
    return value


def transform_yes_no(value) -> str:
    """Convert boolean / truthy value → 'YES' or 'NO'. None/missing → ''."""
    if value is None or value == '':
        return ''
    if isinstance(value, bool):
        return 'YES' if value else 'NO'
    if isinstance(value, str):
        if value.lower() in ('true', 'yes', '1'):
            return 'YES'
        if value.lower() in ('false', 'no', '0'):
            return 'NO'
    return 'YES' if value else 'NO'


def transform_text(value: str) -> str:
    """Strip whitespace, return as-is."""
    if not value:
        return ''
    return str(value).strip()


# ── cell writer ───────────────────────────────────────────────────────────────
def write_cell(ws, cell_addr: str, value: str):
    """
    Write a string value to a cell.
    openpyxl preserves the existing XF style (fill, border, font, alignment)
    when .value is set directly — no manual style restoration required.
    """
    ws[cell_addr] = value


# ── photo insertion ───────────────────────────────────────────────────────────
def insert_photo(ws, photo_path: str):
    """
    Load, resize (preserving aspect ratio), and embed the photo at G5:H14.
    Image is sized to fit within PHOTO_TARGET_W_PX × PHOTO_TARGET_H_PX.
    """
    if not photo_path or not os.path.isfile(photo_path):
        print(f'  [photo] no photo at {photo_path!r} — skipping image insertion')
        return

    with Image.open(photo_path) as img:
        # Convert to RGB so we can save as PNG regardless of source format
        if img.mode in ('RGBA', 'P', 'LA'):
            img = img.convert('RGBA')
        else:
            img = img.convert('RGB')

        # Fit within target bounds, preserve aspect ratio
        img.thumbnail((PHOTO_TARGET_W_PX, PHOTO_TARGET_H_PX), Image.LANCZOS)

        final_w, final_h = img.size

        buf = io.BytesIO()
        # Always write as PNG to avoid JPEG quality issues with passport photos
        save_img = img.convert('RGB') if img.mode == 'RGBA' else img
        save_img.save(buf, format='PNG')
        buf.seek(0)

    xl_img = XLImage(buf)
    xl_img.anchor = PHOTO_ANCHOR
    xl_img.width = final_w
    xl_img.height = final_h

    ws.add_image(xl_img)
    print(f'  [photo] inserted {final_w}×{final_h}px at {PHOTO_ANCHOR}')


# ── Supabase fetch (production path) ─────────────────────────────────────────
def fetch_from_supabase(applicant_id: str):
    """
    Fetch application_data.data for the given applicant UUID.
    Returns (section1_dict, photo_storage_path_or_None).
    Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.
    """
    import requests  # noqa: PLC0415

    url = os.environ.get('SUPABASE_URL', '').rstrip('/')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
    if not url or not key:
        raise EnvironmentError(
            'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment'
        )

    endpoint = f'{url}/rest/v1/application_data'
    params = {
        'select': 'data',
        'user_id': f'eq.{applicant_id}',
        'limit': '1',
    }
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
    }
    resp = requests.get(endpoint, params=params, headers=headers, timeout=15)
    resp.raise_for_status()

    rows = resp.json()
    if not rows:
        raise ValueError(f'No application_data record found for user_id={applicant_id!r}')

    data = rows[0].get('data', {})
    section1 = data.get('section1', {})
    photo_path = data.get('section2', {}).get('photoStoragePath')
    return section1, photo_path


def download_photo_from_supabase(storage_path: str, dest_path: str):
    """
    Download a photo from the application-photos Supabase Storage bucket.
    Writes the file to dest_path and returns dest_path.
    """
    import requests  # noqa: PLC0415

    url = os.environ.get('SUPABASE_URL', '').rstrip('/')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

    # Strip leading bucket name if included in the storage path
    # Expected: 'application-photos/path/to/file.jpg'  or  'path/to/file.jpg'
    if storage_path.startswith('application-photos/'):
        object_path = storage_path[len('application-photos/'):]
    else:
        object_path = storage_path

    endpoint = f'{url}/storage/v1/object/application-photos/{object_path}'
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
    }
    resp = requests.get(endpoint, headers=headers, timeout=30)
    resp.raise_for_status()

    with open(dest_path, 'wb') as f:
        f.write(resp.content)

    return dest_path


# ── main writer ───────────────────────────────────────────────────────────────
def generate_form(section1: dict, photo_path: str | None, out_path: str):
    """
    Copy the template to out_path, then write section1 fields and embed photo.
    Working on a copy ensures the original template is never modified.
    Any pre-existing data in the template cells is overwritten by the applicant values.
    """
    # Always start from a fresh copy of the template so the original is untouched.
    # If out_path already exists from a prior run it is replaced.
    shutil.copy2(TEMPLATE_PATH, out_path)
    print(f'  [template] copied {TEMPLATE_PATH} → {out_path}')
    wb = openpyxl.load_workbook(out_path)

    if SHEET_NAME not in wb.sheetnames:
        raise ValueError(
            f'Sheet {SHEET_NAME!r} not found. Available: {wb.sheetnames}'
        )
    ws = wb[SHEET_NAME]

    # ── Section 1 text fields ──────────────────────────────────────────────
    print('  [section1] writing text fields...')

    # C16 — Position Applied For
    write_cell(ws, 'C16', transform_uppercase(section1.get('appliedForRank', '')))

    # C17 — Type of Vessel
    write_cell(ws, 'C17', transform_uppercase(section1.get('vesselType', '')))

    # C18 — Availability From
    write_cell(ws, 'C18', transform_ddmmyyyy(section1.get('availableFrom', '')))

    # E20 — Media Advertisement (YES/NO)
    media_advert = section1.get('mediaAdvertisement')
    write_cell(ws, 'E20', transform_yes_no(media_advert))

    # E21 — Advertisement Source (conditional on E20 = YES)
    if media_advert:
        write_cell(ws, 'E21', transform_text(section1.get('mediaAdvertisementDetails', '')))
    else:
        write_cell(ws, 'E21', '')

    # F23 — Professional Recommendation (YES/NO)
    rec = section1.get('professionalRecommendation')
    write_cell(ws, 'F23', transform_yes_no(rec))

    # A25 — Recommender Name (conditional on F23 = YES)
    if rec:
        write_cell(ws, 'A25', transform_text(section1.get('recommendedBy', '')))
    else:
        write_cell(ws, 'A25', '')

    print('  [section1] done')

    # ── Photo ──────────────────────────────────────────────────────────────
    if photo_path:
        insert_photo(ws, photo_path)
    else:
        print('  [photo] no photo provided — leaving G5:H14 placeholder text intact')

    # ── Save ───────────────────────────────────────────────────────────────
    wb.save(out_path)
    print(f'  [output] saved → {out_path}')
    return out_path


# ── CLI ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='CMA CGM form writer — Section 1')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--sample', action='store_true', help='Use built-in sample data')
    group.add_argument('--applicant-id', metavar='UUID', help='Fetch live data from Supabase')

    parser.add_argument(
        '--photo',
        metavar='PATH',
        help='Local path to applicant photo (overrides DB storage path)',
    )
    parser.add_argument(
        '--out',
        metavar='PATH',
        default=os.path.join(_script_dir, 'output_section1.xlsx'),
        help='Output XLSX path (default: output_section1.xlsx in script dir)',
    )
    args = parser.parse_args()

    print('CMA CGM writer — Stage 1 (Section 1 + Photo)')
    print('─' * 50)

    if args.sample:
        print('  [data] using sample data')
        section1 = SAMPLE_SECTION1
        photo_path = args.photo or SAMPLE_PHOTO_PATH
    else:
        print(f'  [data] fetching applicant {args.applicant_id} from Supabase...')
        section1, storage_path = fetch_from_supabase(args.applicant_id)

        if args.photo:
            photo_path = args.photo
        elif storage_path:
            # Download to a temp file
            tmp_photo = os.path.join(_script_dir, '_tmp_photo_download')
            print(f'  [photo] downloading from storage: {storage_path}')
            photo_path = download_photo_from_supabase(storage_path, tmp_photo)
        else:
            photo_path = None

    generate_form(section1, photo_path, args.out)

    print('─' * 50)
    print(f'Done. Output: {args.out}')


if __name__ == '__main__':
    main()
