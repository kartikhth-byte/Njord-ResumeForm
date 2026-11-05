from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

from flask import Response


APP_PATH = Path(__file__).with_name("app.py")
SPEC = importlib.util.spec_from_file_location("worksheet_service_app", APP_PATH)
service = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(service)


class WorksheetSubmissionGateTest(unittest.TestCase):
    def setUp(self) -> None:
        self.client = service.app.test_client()

    def post_generate(self) -> Response:
        return self.client.post(
            "/api/customer-worksheets/generate",
            json={"applicationId": "application-1", "customerId": "customer-1"},
            headers={"Authorization": "Bearer test-token"},
        )

    def test_draft_is_rejected_before_loading_template_or_form_data(self) -> None:
        with (
            patch.object(service, "authorize_request", return_value={"id": "recruiter-1"}),
            patch.object(
                service,
                "fetch_single_row",
                return_value={"id": "application-1", "status": "new", "submitted_at": None},
            ) as fetch_row,
            patch.object(service, "download_storage_object") as download_template,
        ):
            response = self.post_generate()

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json, {"error": "Submit the application before generating a worksheet"})
        fetch_row.assert_called_once_with(
            "applications",
            "id",
            "application-1",
            select="id,reference_number,public_token,status,submitted_at",
        )
        download_template.assert_not_called()

    def test_submitted_form_can_export_after_status_changes(self) -> None:
        application = {
            "id": "application-1",
            "reference_number": "TEST-001",
            "status": "rejected",
            "submitted_at": "2026-11-05T12:00:00Z",
        }
        customer = {"id": "customer-1", "name": "Test Customer"}
        template = {"id": "template-1", "source_extension": "xlsx", "storage_path": "test.xlsx"}
        form_data = {"data": {"section1": {"appliedForRank": "Chief officer"}}}

        with (
            patch.object(service, "authorize_request", return_value={"id": "recruiter-1"}),
            patch.object(service, "fetch_single_row", side_effect=[application, customer, template, form_data]) as fetch_row,
            patch.object(service, "download_storage_object") as download_template,
            patch.object(service, "fetch_photo_bytes", return_value=None),
            patch.object(service, "generate_workbook") as generate_workbook,
            patch.object(service, "send_file", return_value=Response("workbook", status=200)),
        ):
            response = self.post_generate()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(fetch_row.call_count, 4)
        download_template.assert_called_once()
        generate_workbook.assert_called_once()


if __name__ == "__main__":
    unittest.main()
