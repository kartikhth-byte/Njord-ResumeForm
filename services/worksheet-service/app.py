#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests
from flask import Flask, Response, jsonify, request, send_file

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.client_forms.cma_cgm_writer import generate_workbook


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
APP_URL = os.environ.get("APP_URL", "*")
ALLOWED_ORIGINS = [origin.strip() for origin in APP_URL.split(",") if origin.strip()]
TEMPLATE_BUCKET = "worksheet-templates"
PHOTO_BUCKET = "application-photos"

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024


@app.after_request
def add_cors_headers(response: Response) -> Response:
    allowed_origin = resolve_allowed_origin(request.headers.get("Origin"))
    if allowed_origin:
        response.headers["Access-Control-Allow-Origin"] = allowed_origin
    response.headers["Access-Control-Allow-Headers"] = "authorization, content-type"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Expose-Headers"] = "Content-Disposition"
    response.headers["Vary"] = "Origin"
    return response


@app.route("/health", methods=["GET"])
def health() -> Response:
    return jsonify({"ok": True})


@app.route("/ready", methods=["GET"])
def ready() -> Response:
    configured = bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
    return jsonify({"ok": configured})


@app.route("/api/customer-worksheets/generate", methods=["OPTIONS", "POST"])
def generate_customer_worksheet() -> Response:
    if request.method == "OPTIONS":
        return Response(status=204)

    try:
        user = authorize_request(request.headers.get("Authorization", ""), "export_data")
        if not user:
            return jsonify({"error": "Insufficient permissions"}), 403

        body = request.get_json(silent=True) or {}
        application_id = body.get("applicationId")
        customer_id = body.get("customerId")
        if not application_id or not customer_id:
            return jsonify({"error": "applicationId and customerId are required"}), 400

        customer = fetch_single_row("worksheet_customers", "id", customer_id, select="id,name,slug")
        template = fetch_single_row(
            "worksheet_templates",
            "customer_id",
            customer_id,
            select="id,customer_id,file_name,storage_path,source_extension,is_active",
            filters={"is_active": "eq.true"},
            order="created_at.desc",
            limit=1,
        )
        if (template.get("source_extension") or "").lower() != "xlsx":
            return jsonify({"error": "Upload a normalized .xlsx worksheet template before generating customer worksheets"}), 400

        application = fetch_single_row(
            "applications",
            "id",
            application_id,
            select="id,reference_number,public_token,status",
        )
        application_data = fetch_single_row(
            "application_data",
            "application_id",
            application_id,
            select="data",
        )
        payload = application_data.get("data") or {}
        payload["_application"] = application

        with tempfile.TemporaryDirectory(prefix="worksheet-service-") as tmp_dir:
            tmp_path = Path(tmp_dir)
            template_path = tmp_path / sanitize_filename(template.get("file_name") or "customer-template.xlsx")
            timestamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
            output_name = (
                f"{sanitize_filename(customer.get('name') or 'customer')}-"
                f"{sanitize_filename(application.get('reference_number') or application.get('id') or 'application')}-"
                f"worksheet-{timestamp}.xlsx"
            )
            output_path = tmp_path / output_name

            download_storage_object(template["storage_path"], template_path)

            warnings: list[str] = []
            photo_bytes = fetch_photo_bytes(payload, warnings)
            generate_workbook(template_path, output_path, payload, photo_bytes, warnings)

            return send_file(
                output_path,
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                as_attachment=True,
                download_name=output_name,
                max_age=0,
            )
    except requests.HTTPError as exc:
        message = extract_http_error(exc)
        return jsonify({"error": message}), 500
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 500


def authorize_request(auth_header: str, permission_name: str) -> dict[str, Any] | None:
    token = auth_header.replace("Bearer ", "").strip()
    if not token:
        return None

    response = requests.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {token}",
        },
        timeout=30,
    )
    if response.status_code != 200:
        return None
    user = response.json()

    permission_response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/has_permission",
        headers=service_role_headers(),
        json={
            "user_uuid": user["id"],
            "permission_name": permission_name,
        },
        timeout=30,
    )
    permission_response.raise_for_status()
    if permission_response.json() is not True:
        return None
    return user


def fetch_single_row(
    table: str,
    field: str,
    value: str,
    *,
    select: str,
    filters: dict[str, str] | None = None,
    order: str | None = None,
    limit: int | None = None,
) -> dict[str, Any]:
    query_parts = [
        f"select={quote(select, safe=',*()')}",
        f"{quote(field)}=eq.{quote(str(value), safe='')}",
    ]
    if filters:
        query_parts.extend(
            f"{quote(filter_key)}={quote(filter_value, safe='.:,()')}"
            for filter_key, filter_value in filters.items()
        )
    if order:
        query_parts.append(f"order={quote(order, safe='.:,')}")
    if limit is not None:
        query_parts.append(f"limit={limit}")
    url = f"{SUPABASE_URL}/rest/v1/{table}?{'&'.join(query_parts)}"
    response = requests.get(url, headers=service_role_headers(), timeout=30)
    response.raise_for_status()
    rows = response.json()
    if not rows:
        raise RuntimeError(f"No {table} row found for {field}={value}")
    return rows[0]


def download_storage_object(storage_path: str, destination: Path) -> None:
    response = requests.get(
        f"{SUPABASE_URL}/storage/v1/object/{TEMPLATE_BUCKET}/{quote(storage_path, safe='/')}",
        headers=service_role_headers(),
        timeout=60,
    )
    response.raise_for_status()
    destination.write_bytes(response.content)


def fetch_photo_bytes(payload: dict[str, Any], warnings: list[str]) -> bytes | None:
    storage_path = get_by_path(payload, "section2.photoStoragePath")
    if not storage_path:
        warnings.append("No applicant photo path found at section2.photoStoragePath.")
        return None

    response = requests.get(
        f"{SUPABASE_URL}/storage/v1/object/{PHOTO_BUCKET}/{quote(str(storage_path), safe='/')}",
        headers=service_role_headers(),
        timeout=30,
    )
    if response.status_code != 200:
        warnings.append(f"Failed to download applicant photo: HTTP {response.status_code}")
        return None
    return response.content


def service_role_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def get_by_path(value: Any, path: str) -> Any:
    current = value
    for key in path.split("."):
        if current is None or not isinstance(current, dict) or key not in current:
            return None
        current = current[key]
    return current


def sanitize_filename(value: str) -> str:
    return "".join(char if char.isalnum() or char in {".", "_", "-"} else "-" for char in value)


def extract_http_error(exc: requests.HTTPError) -> str:
    response = exc.response
    if response is None:
        return str(exc)
    try:
        body = response.json()
        if isinstance(body, dict) and body.get("message"):
            return body["message"]
    except Exception:  # noqa: BLE001
        pass
    return f"Request failed with status {response.status_code}"


def resolve_allowed_origin(request_origin: str | None) -> str | None:
    if not ALLOWED_ORIGINS or "*" in ALLOWED_ORIGINS:
        return request_origin or "*"
    if request_origin and request_origin in ALLOWED_ORIGINS:
        return request_origin
    return None


if __name__ == "__main__":
    app.run(host=os.environ.get("WORKSHEET_SERVICE_HOST", "0.0.0.0"), port=int(os.environ.get("WORKSHEET_SERVICE_PORT", "8765")))
