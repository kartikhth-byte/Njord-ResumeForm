"""
CMA CGM Form Local Runner

Fetches a real applicant record from Supabase, downloads their photo,
and generates a filled CMA CGM XLSX form (Section 1).

Run from anywhere inside the project:
    python3 tmp/client-form-prototype/run_writer.py              # lists applicants
    python3 tmp/client-form-prototype/run_writer.py --list       # same, explicit
    python3 tmp/client-form-prototype/run_writer.py --id <UUID>  # generate for one applicant

Output is saved to: tmp/client-form-prototype/output_<applicant_id[:8]>.xlsx

Requirements (on the local machine running this script):
    pip install openpyxl Pillow requests python-dotenv
"""

import sys
import os
import io
import shutil
import tempfile
import argparse
from pathlib import Path

# ── locate project root and .env ─────────────────────────────────────────────
_here = Path(__file__).resolve().parent

def _find_project_root() -> Path:
    """
    Walk up from the script looking for a directory that contains a .env file.
    Vite projects use .env.local; plain .env is also checked.
    """
    candidate = _here
    for _ in range(6):  # up to 6 levels
        if (candidate / '.env.local').exists() or (candidate / '.env').exists():
            return candidate
        candidate = candidate.parent
    # Fallback: two levels up from the script (tmp/client-form-prototype → tmp → project)
    return _here.parent.parent

_project_root = _find_project_root()

def _find_env_file() -> Path | None:
    """Return the first env file found: .env.local preferred, then .env."""
    for name in ('.env.local', '.env'):
        p = _project_root / name
        if p.exists():
            return p
    return None

def _load_env():
    """
    Load credentials from the project env file (.env.local or .env).
    Values from the file always override pre-existing empty env vars.
    Works with or without python-dotenv installed.
    """
    env_path = _find_env_file()

    if env_path is None:
        print(f'  [env] WARNING: no .env.local or .env found under {_project_root}')
        return

    print(f'  [env] loading {env_path}')

    try:
        from dotenv import load_dotenv  # type: ignore
        load_dotenv(env_path, override=True)
        return
    except ImportError:
        pass  # fall through to manual parse

    # Manual parse — handles KEY=VALUE, ignores comments and blank lines.
    # Strips inline comments and surrounding quotes from values.
    with open(env_path) as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, rest = line.partition('=')
            key = key.strip()
            # Strip inline comment
            val = rest.split('#')[0].strip()
            # Strip surrounding quotes if present
            if len(val) >= 2 and val[0] in ('"', "'") and val[-1] == val[0]:
                val = val[1:-1]
            if key:
                os.environ[key] = val  # always set, don't use setdefault

_load_env()

SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL', '').rstrip('/')
SERVICE_KEY  = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

if not SUPABASE_URL or not SERVICE_KEY:
    env_file = _find_env_file()
    sys.exit(
        f'\nERROR: Could not load Supabase credentials.\n'
        f'  Project root detected: {_project_root}\n'
        f'  Env file found: {env_file}\n'
        f'  VITE_SUPABASE_URL set: {bool(os.environ.get("VITE_SUPABASE_URL"))}\n'
        f'  SUPABASE_SERVICE_ROLE_KEY set: {bool(os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))}\n'
        f'\n'
        f'Fix: ensure your .env.local (or .env) contains:\n'
        f'  VITE_SUPABASE_URL=https://....supabase.co\n'
        f'  SUPABASE_SERVICE_ROLE_KEY=eyJ...\n'
    )

# ── add local .python-packages to path ───────────────────────────────────────
_pkg_dir = _project_root / '.python-packages'
if _pkg_dir.is_dir():
    sys.path.insert(0, str(_pkg_dir))

import requests
import openpyxl
from openpyxl.drawing.image import Image as XLImage
from PIL import Image

# ── import the writer module ──────────────────────────────────────────────────
sys.path.insert(0, str(_here))
from write_cma_cgm_section1 import generate_form


# ── Supabase helpers ─────────────────────────────────────────────────────────
def _headers():
    return {
        'apikey': SERVICE_KEY,
        'Authorization': f'Bearer {SERVICE_KEY}',
        'Content-Type': 'application/json',
    }


def _unwrap_app_data(row: dict) -> dict:
    """Extract the nested application_data.data dict from a joined applications row."""
    app_data_row = row.get('application_data') or {}
    # PostgREST returns one-to-one FK joins as a single object, but guard against list
    if isinstance(app_data_row, list):
        app_data_row = app_data_row[0] if app_data_row else {}
    return app_data_row.get('data') or {}


def list_applicants(limit: int = 20) -> list[dict]:
    """
    Return applications joined with their application_data.
    Schema:
      applications     → id, user_id, status, created_at, applied_rank, public_token
      application_data → application_id (FK), data (JSONB)
    """
    url = f'{SUPABASE_URL}/rest/v1/applications'
    params = {
        'select': 'id,user_id,status,created_at,applied_rank,public_token,application_data(data)',
        'order': 'created_at.desc',
        'limit': str(limit),
    }
    resp = requests.get(url, headers=_headers(), params=params, timeout=15)
    if not resp.ok:
        print(f'  [db] ERROR {resp.status_code}: {resp.text}')
        resp.raise_for_status()
    rows = resp.json()

    results = []
    for row in rows:
        data = _unwrap_app_data(row)
        s1 = data.get('section1') or {}
        results.append({
            'id': row['id'],
            'public_token': row.get('public_token', ''),
            'user_id': row.get('user_id', ''),
            'status': row.get('status', ''),
            'rank': s1.get('appliedForRank') or row.get('applied_rank') or '—',
            'vessel': s1.get('vesselType', '—'),
            'available': s1.get('availableFrom', '—'),
        })
    return results


def fetch_applicant(value: str) -> tuple[dict, dict]:
    """
    Fetch section1 data + full data blob for an application.
    Accepts either applications.id or applications.public_token — tries id first,
    then public_token if no row is found.
    Returns (section1_dict, full_data_dict).
    """
    url = f'{SUPABASE_URL}/rest/v1/applications'
    select = 'id,user_id,status,applied_rank,public_token,application_data(data)'

    for filter_col in ('id', 'public_token'):
        params = {
            'select': select,
            filter_col: f'eq.{value}',
            'limit': '1',
        }
        resp = requests.get(url, headers=_headers(), params=params, timeout=15)
        if not resp.ok:
            print(f'  [db] ERROR {resp.status_code}: {resp.text}')
            resp.raise_for_status()
        rows = resp.json()
        if rows:
            print(f'  [db] matched on {filter_col}={value!r}')
            row = rows[0]
            data = _unwrap_app_data(row)
            return data.get('section1') or {}, data

    sys.exit(
        f'ERROR: No application found with id or public_token = {value!r}\n'
        f'Run --list to see available IDs.'
    )


def download_photo(storage_path: str, dest: str) -> str | None:
    """
    Download the applicant photo from Supabase Storage → dest file path.
    Returns dest on success, None if storage_path is empty or download fails.
    """
    if not storage_path:
        return None

    # Strip bucket prefix if present
    bucket = 'application-photos'
    if storage_path.startswith(f'{bucket}/'):
        object_path = storage_path[len(f'{bucket}/'):]
    else:
        object_path = storage_path

    url = f'{SUPABASE_URL}/storage/v1/object/{bucket}/{object_path}'
    try:
        resp = requests.get(url, headers=_headers(), timeout=30)
        resp.raise_for_status()
        with open(dest, 'wb') as f:
            f.write(resp.content)
        print(f'  [photo] downloaded {len(resp.content):,} bytes → {dest}')
        return dest
    except Exception as exc:
        print(f'  [photo] WARNING: could not download photo: {exc}')
        return None


# ── CLI ───────────────────────────────────────────────────────────────────────
def cmd_list(args):
    print('Fetching applicants from Supabase...\n')
    rows = list_applicants()
    if not rows:
        print('No application records found.')
        return

    # Show public_token (what the browser URL uses) as the primary copy target
    print(f'{"#":<3}  {"public_token (use with --id)":<38}  {"Status":<14}  {"Rank":<22}  {"Vessel":<18}  Available')
    print('─' * 130)
    for i, r in enumerate(rows, 1):
        token = r['public_token'] or r['id']
        print(
            f'{i:<3}  {token:<38}  {r["status"]:<14}  '
            f'{r["rank"]:<22}  {r["vessel"]:<18}  {r["available"]}'
        )
    print(f'\nTotal: {len(rows)} records')
    print('\nRun with --id <public_token> to generate the form.')
    print('The public_token matches the UUID in the browser URL: /application/view/<token>')


def cmd_generate(args):
    applicant_id = args.id
    print(f'CMA CGM writer — real applicant: {applicant_id}')
    print('─' * 60)

    # 1. Fetch section1 data
    print(f'  [db] fetching application_data for id={applicant_id}...')
    section1, full_data = fetch_applicant(applicant_id)

    if not section1:
        print('  [db] WARNING: section1 is empty — applicant may not have completed Section 1')

    print(f'  [db] rank={section1.get("appliedForRank")!r}  '
          f'vessel={section1.get("vesselType")!r}  '
          f'available={section1.get("availableFrom")!r}')

    # 2. Download photo (path lives in section2, not section1)
    photo_storage_path = (full_data.get('section2') or {}).get('photoStoragePath', '')
    photo_local = None
    if photo_storage_path:
        # Download to a temp file alongside output
        tmp_photo = str(_here / f'_tmp_photo_{applicant_id[:8]}')
        photo_local = download_photo(photo_storage_path, tmp_photo)
    else:
        print('  [photo] no photoStoragePath in section2 — image area will be left unchanged')

    # 3. Generate form (copies template → output, then writes)
    short_id = applicant_id.replace('-', '')[:8]
    out_path = args.out or str(_here / f'output_{short_id}.xlsx')
    generate_form(section1, photo_local, out_path)

    # 4. Cleanup temp photo
    if photo_local and os.path.exists(photo_local):
        os.remove(photo_local)

    print('─' * 60)
    print(f'Done. Open: {out_path}')


def main():
    parser = argparse.ArgumentParser(
        description='CMA CGM form writer — fetch real applicant from Supabase'
    )
    sub = parser.add_subparsers(dest='command')

    # list
    list_p = sub.add_parser('list', help='List available applicants')
    list_p.set_defaults(func=cmd_list)

    # generate
    gen_p = sub.add_parser('generate', help='Generate form for a specific applicant')
    gen_p.add_argument('--id', required=True, metavar='UUID', help='application_data row id')
    gen_p.add_argument('--out', metavar='PATH', help='Output XLSX path (optional)')
    gen_p.set_defaults(func=cmd_generate)

    # Default: no subcommand = list
    args = parser.parse_args()
    if not args.command or args.command == 'list':
        # Allow --list or no args as shorthand for list
        list_args = argparse.Namespace(func=cmd_list)
        cmd_list(list_args)
    elif args.command == 'generate':
        if not hasattr(args, 'id') or not args.id:
            parser.error('generate requires --id <UUID>')
        cmd_generate(args)
    else:
        # Allow top-level --id shorthand without needing 'generate' subcommand
        args.func(args)


if __name__ == '__main__':
    # Also support shorthand: python3 run_writer.py --id <UUID>
    # (no subcommand needed)
    if len(sys.argv) > 1 and sys.argv[1] == '--id':
        # Inject 'generate' subcommand transparently
        sys.argv.insert(1, 'generate')
    elif len(sys.argv) > 1 and sys.argv[1] == '--list':
        sys.argv[1] = 'list'

    main()
