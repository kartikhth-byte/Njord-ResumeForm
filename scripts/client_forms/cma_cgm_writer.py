#!/usr/bin/env python3
"""Prototype writer for the CMA CGM main sheet, Sections 1 and 2.

This script generates a formatted spreadsheet by:
- loading the uploaded CMA CGM template
- normalizing a Numbers template to XLSX when needed
- fetching application data from Supabase or a local JSON fixture
- populating the Section 1 and Section 2 target cells
- inserting the applicant photo into the Main sheet photo area

Runtime dependencies are vendored under `.python-packages`.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import subprocess
import sys
import urllib.parse
import zipfile
from copy import copy
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import requests
from openpyxl import load_workbook
from openpyxl.drawing.image import Image as XLImage
from openpyxl.utils import get_column_letter, range_boundaries
from PIL import Image


ROOT_DIR = Path(__file__).resolve().parents[2]
TMP_DIR = ROOT_DIR / "tmp" / "client-form-prototype"
PHOTO_BUCKET = "application-photos"
DEFAULT_OUTPUT_BASENAME = "cma-cgm-section1-section2"


@dataclass(frozen=True)
class FieldMapping:
    cell: str
    source_path: str
    transform: str
    condition_path: str | None = None
    horizontal_alignment: str | None = None


SECTION1_FIELD_MAPPINGS = (
    FieldMapping("C16", "section1.appliedForRank", "uppercase"),
    FieldMapping("C17", "section1.vesselType", "uppercase"),
    FieldMapping("C18", "section1.availableFrom", "ddmmyyyy"),
    FieldMapping("E20", "section1.mediaAdvertisement", "yes_no"),
    FieldMapping(
        "E21",
        "section1.mediaAdvertisementDetails",
        "text",
        condition_path="section1.mediaAdvertisement",
    ),
    FieldMapping("F23", "section1.professionalRecommendation", "yes_no"),
    FieldMapping(
        "A25",
        "section1.recommendedBy",
        "text",
        condition_path="section1.professionalRecommendation",
    ),
)

SECTION2_FIELD_MAPPINGS = (
    FieldMapping("C26", "section2.surname", "uppercase"),
    FieldMapping("F26", "section2.firstName", "uppercase"),
    FieldMapping("G26", "section2.middleName", "uppercase"),
    FieldMapping("C27", "section2.otherNames", "uppercase"),
    FieldMapping("F27", "section2.nationality", "uppercase"),
    FieldMapping("B28", "section2.placeOfBirth", "uppercase"),
    FieldMapping("F28", "section2.dateOfBirth", "integer"),
    FieldMapping("H28", "section2.gender", "uppercase"),
)

SECTION3_FIELD_MAPPINGS = (
    FieldMapping("A32", "section3.passportNumber", "alphanumeric"),
    FieldMapping("C32", "section3.placeOfIssue", "uppercase"),
    FieldMapping("D32", "section3.dateOfIssue", "date_serial"),
    FieldMapping("E32", "section3.dateOfExpiry", "ddmmyyyy"),
    FieldMapping("G32", "section3.issuingAuthority", "uppercase"),
)

SEAMANS_BOOK_FIELD_MAPPINGS = (
    FieldMapping("A63", "section4.cdcNumber", "alphanumeric"),
    FieldMapping("B63", "section4.placeOfIssue", "uppercase"),
    FieldMapping("D63", "section4.dateOfIssue", "ddmmyyyy"),
    FieldMapping("E63", "section4.dateOfExpiry", "ddmmyyyy"),
    FieldMapping("G63", "section4.issuingAuthority", "uppercase"),
)

EMERGENCY_CONTACT_FIELD_MAPPINGS = (
    FieldMapping("B57", "section2.emergencyContact.name", "uppercase"),
    FieldMapping("F57", "section2.emergencyContact.relationship", "uppercase"),
    FieldMapping("B58", "section2.emergencyContact.address", "split_uppercase_0"),
    FieldMapping("C58", "section2.emergencyContact.address", "split_uppercase_1"),
    FieldMapping("D58", "section2.emergencyContact.address", "split_uppercase_2"),
    FieldMapping("F58", "section2.emergencyContact.address", "split_uppercase_3"),
    FieldMapping("C59", "section2.emergencyContact.phone", "numeric"),
    FieldMapping("G59", "section2.emergencyContact.mobile", "numeric"),
)

PERSONAL_CONTACT_FIELD_MAPPINGS = (
    FieldMapping("B49", "section2.address|section2.city|section2.state", "concat_address_uppercase"),
    FieldMapping("B50", "section2.postalCode", "numeric"),
    FieldMapping("F50", "section2.country", "uppercase"),
    FieldMapping("B51", "section2.email", "text"),
    FieldMapping("C52", "section2.homeTelephoneNumber", "numeric"),
    FieldMapping("C53", "section2.phoneCountryCode|section2.phoneNumber", "concat_numeric"),
    FieldMapping("B54", "section2.domesticAirport", "uppercase"),
    FieldMapping("G54", "section2.internationalAirport", "uppercase"),
)

VISA_FIELD_MAPPINGS = (
    FieldMapping("B36", "visa:C1/D (USA):number", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("B37", "visa:C1 (USA):number", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("B38", "visa:D (USA):number", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("B39", "visa:Australia Entry visa:number", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("B40", "visa:MCV (Australia):number", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("B41", "visa:Schengen:number", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("C36", "visa:C1/D (USA):placeOfIssue", "uppercase", horizontal_alignment="center"),
    FieldMapping("C37", "visa:C1 (USA):placeOfIssue", "uppercase", horizontal_alignment="center"),
    FieldMapping("C38", "visa:D (USA):placeOfIssue", "uppercase", horizontal_alignment="center"),
    FieldMapping("C39", "visa:Australia Entry visa:placeOfIssue", "uppercase", horizontal_alignment="center"),
    FieldMapping("C40", "visa:MCV (Australia):placeOfIssue", "uppercase", horizontal_alignment="center"),
    FieldMapping("C41", "visa:Schengen:placeOfIssue", "uppercase", horizontal_alignment="center"),
    FieldMapping("E36", "visa:C1/D (USA):dateOfIssue", "date_serial", horizontal_alignment="center"),
    FieldMapping("E37", "visa:C1 (USA):dateOfIssue", "date_serial", horizontal_alignment="center"),
    FieldMapping("E38", "visa:D (USA):dateOfIssue", "date_serial", horizontal_alignment="center"),
    FieldMapping("E39", "visa:Australia Entry visa:dateOfIssue", "date_serial", horizontal_alignment="center"),
    FieldMapping("E40", "visa:MCV (Australia):dateOfIssue", "date_serial", horizontal_alignment="center"),
    FieldMapping("E41", "visa:Schengen:dateOfIssue", "date_serial", horizontal_alignment="center"),
    FieldMapping("G36", "visa:C1/D (USA):dateOfExpiry", "date_serial", horizontal_alignment="center"),
    FieldMapping("G37", "visa:C1 (USA):dateOfExpiry", "date_serial", horizontal_alignment="center"),
    FieldMapping("G38", "visa:D (USA):dateOfExpiry", "date_serial", horizontal_alignment="center"),
    FieldMapping("G39", "visa:Australia Entry visa:dateOfExpiry", "date_serial", horizontal_alignment="center"),
    FieldMapping("G40", "visa:MCV (Australia):dateOfExpiry", "date_serial", horizontal_alignment="center"),
    FieldMapping("G41", "visa:Schengen:dateOfExpiry", "date_serial", horizontal_alignment="center"),
)

EDUCATION_FIELD_MAPPINGS = (
    FieldMapping("A45", "education_row:0:institution", "text"),
    FieldMapping("C45", "education_row:0:from", "yyyy"),
    FieldMapping("D45", "education_row:0:to", "yyyy"),
    FieldMapping("E45", "education_row:0:qualification", "text"),
    FieldMapping("A46", "education_row:1:institution", "text"),
    FieldMapping("C46", "education_row:1:from", "yyyy"),
    FieldMapping("D46", "education_row:1:to", "yyyy"),
    FieldMapping("E46", "education_row:1:qualification", "text"),
)

COC_FIELD_MAPPINGS = (
    FieldMapping("A67", "certificate_row:0:grade", "alphanumeric"),
    FieldMapping("B67", "certificate_row:0:issuingAuthority", "uppercase"),
    FieldMapping("C67", "certificate_row:0:certificateNumber", "alphanumeric"),
    FieldMapping("D67", "certificate_row:0:dateOfIssue", "date_serial"),
    FieldMapping("E67", "certificate_row:0:dateOfExpiry", "ddmmyyyy"),
    FieldMapping("F67", "certificate_row:0:placeOfIssue", "uppercase"),
    FieldMapping("G67", "certificate_row:0:dateRevalidated", "ddmmyyyy"),
    FieldMapping("H67", "certificate_row:0:dateRevalidationExpiry", "ddmmyyyy"),
    FieldMapping("A68", "certificate_row:1:grade", "alphanumeric"),
    FieldMapping("B68", "certificate_row:1:issuingAuthority", "uppercase"),
    FieldMapping("C68", "certificate_row:1:certificateNumber", "alphanumeric"),
    FieldMapping("D68", "certificate_row:1:dateOfIssue", "date_serial"),
    FieldMapping("E68", "certificate_row:1:dateOfExpiry", "ddmmyyyy"),
    FieldMapping("F68", "certificate_row:1:placeOfIssue", "uppercase"),
    FieldMapping("G68", "certificate_row:1:dateRevalidated", "ddmmyyyy"),
    FieldMapping("H68", "certificate_row:1:dateRevalidationExpiry", "ddmmyyyy"),
)

GMDSS_FIELD_MAPPINGS = (
    FieldMapping("A72", "gmdss_latest:issuingAuthority", "uppercase", horizontal_alignment="center"),
    FieldMapping("C72", "gmdss_latest:number", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("D72", "gmdss_latest:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("E72", "gmdss_latest:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("G72", "gmdss_latest:placeOfIssue", "uppercase", horizontal_alignment="center"),
)

MEDICAL_FITNESS_FIELD_MAPPINGS = (
    FieldMapping("A76", "medical_row:0:type", "text", horizontal_alignment="center"),
    FieldMapping("B76", "medical_row:0:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("E76", "medical_row:0:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("A77", "medical_row:1:type", "text", horizontal_alignment="center"),
    FieldMapping("B77", "medical_row:1:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("E77", "medical_row:1:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
)

LANGUAGE_FIELD_MAPPINGS = (
    FieldMapping("A81", "language_row:0:language", "uppercase"),
    FieldMapping("D81", "language_row:0:beginner", "tick", horizontal_alignment="center"),
    FieldMapping("E81", "language_row:0:intermediate", "tick", horizontal_alignment="center"),
    FieldMapping("G81", "language_row:0:advanced", "tick", horizontal_alignment="center"),
    FieldMapping("A82", "language_row:1:language", "uppercase"),
    FieldMapping("D82", "language_row:1:beginner", "tick", horizontal_alignment="center"),
    FieldMapping("E82", "language_row:1:intermediate", "tick", horizontal_alignment="center"),
    FieldMapping("G82", "language_row:1:advanced", "tick", horizontal_alignment="center"),
)

MARINE_COURSE_FIELD_MAPPINGS = (
    FieldMapping("F86", "marine_course:Basic Training:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G86", "marine_course:Basic Training:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H86", "marine_course:Basic Training:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping(
        "F87",
        "marine_course:Personal Survival Techniques - BASIC TRAINING:certificateNumber",
        "alphanumeric",
        horizontal_alignment="center",
    ),
    FieldMapping(
        "G87",
        "marine_course:Personal Survival Techniques - BASIC TRAINING:dateOfIssue",
        "ddmmyyyy",
        horizontal_alignment="center",
    ),
    FieldMapping(
        "H87",
        "marine_course:Personal Survival Techniques - BASIC TRAINING:dateOfExpiry",
        "ddmmyyyy",
        horizontal_alignment="center",
    ),
    FieldMapping(
        "F88",
        "marine_course:Basic Fire Fighting - BASIC TRAINING:certificateNumber",
        "alphanumeric",
        horizontal_alignment="center",
    ),
    FieldMapping(
        "G88",
        "marine_course:Basic Fire Fighting - BASIC TRAINING:dateOfIssue",
        "ddmmyyyy",
        horizontal_alignment="center",
    ),
    FieldMapping(
        "H88",
        "marine_course:Basic Fire Fighting - BASIC TRAINING:dateOfExpiry",
        "ddmmyyyy",
        horizontal_alignment="center",
    ),
    FieldMapping(
        "F89",
        "marine_course:Elementary First Aid - BASIC TRAINING:certificateNumber",
        "alphanumeric",
        horizontal_alignment="center",
    ),
    FieldMapping(
        "G89",
        "marine_course:Elementary First Aid - BASIC TRAINING:dateOfIssue",
        "ddmmyyyy",
        horizontal_alignment="center",
    ),
    FieldMapping(
        "H89",
        "marine_course:Elementary First Aid - BASIC TRAINING:dateOfExpiry",
        "ddmmyyyy",
        horizontal_alignment="center",
    ),
    FieldMapping(
        "F90",
        "marine_course:Personal Safety & Social Responsibilities (Human Relationship) - BASIC TRAINING:certificateNumber",
        "alphanumeric",
        horizontal_alignment="center",
    ),
    FieldMapping(
        "G90",
        "marine_course:Personal Safety & Social Responsibilities (Human Relationship) - BASIC TRAINING:dateOfIssue",
        "ddmmyyyy",
        horizontal_alignment="center",
    ),
    FieldMapping(
        "H90",
        "marine_course:Personal Safety & Social Responsibilities (Human Relationship) - BASIC TRAINING:dateOfExpiry",
        "ddmmyyyy",
        horizontal_alignment="center",
    ),
    FieldMapping(
        "F91",
        "marine_course:Proficiency in survival craft & Rescue Boats:certificateNumber",
        "alphanumeric",
        horizontal_alignment="center",
    ),
    FieldMapping(
        "G91",
        "marine_course:Proficiency in survival craft & Rescue Boats:dateOfIssue",
        "ddmmyyyy",
        horizontal_alignment="center",
    ),
    FieldMapping(
        "H91",
        "marine_course:Proficiency in survival craft & Rescue Boats:dateOfExpiry",
        "ddmmyyyy",
        horizontal_alignment="center",
    ),
    FieldMapping("F92", "marine_course:Advanced Fire Fighting:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G92", "marine_course:Advanced Fire Fighting:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H92", "marine_course:Advanced Fire Fighting:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F93", "marine_course:Medical First Aid:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G93", "marine_course:Medical First Aid:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H93", "marine_course:Medical First Aid:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F94", "marine_course:Medical Care:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G94", "marine_course:Medical Care:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H94", "marine_course:Medical Care:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F95", "marine_course:ROP:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G95", "marine_course:ROP:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H95", "marine_course:ROP:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F96", "marine_course:ARPA/NCC:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G96", "marine_course:ARPA/NCC:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H96", "marine_course:ARPA/NCC:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F97", "marine_course:Radar Simulator:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G97", "marine_course:Radar Simulator:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H97", "marine_course:Radar Simulator:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F98", "marine_course:ECDIS:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G98", "marine_course:ECDIS:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H98", "marine_course:ECDIS:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F99", "marine_course:HAZ MAT:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G99", "marine_course:HAZ MAT:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H99", "marine_course:HAZ MAT:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping(
        "F100",
        "marine_course:Ship simulator bridge teamwork:certificateNumber",
        "alphanumeric",
        horizontal_alignment="center",
    ),
    FieldMapping("G100", "marine_course:Ship simulator bridge teamwork:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H100", "marine_course:Ship simulator bridge teamwork:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F101", "marine_course:BTM/ETM:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G101", "marine_course:BTM/ETM:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H101", "marine_course:BTM/ETM:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F102", "marine_course:SSO:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G102", "marine_course:SSO:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H102", "marine_course:SSO:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F103", "marine_course:BASSnet:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G103", "marine_course:BASSnet:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H103", "marine_course:BASSnet:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F104", "marine_course:Ship Handling:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G104", "marine_course:Ship Handling:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H104", "marine_course:Ship Handling:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping(
        "F105",
        "marine_course:Bridge resource management:certificateNumber",
        "alphanumeric",
        horizontal_alignment="center",
    ),
    FieldMapping("G105", "marine_course:Bridge resource management:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H105", "marine_course:Bridge resource management:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F106", "marine_course:Loading Software:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G106", "marine_course:Loading Software:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H106", "marine_course:Loading Software:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F107", "marine_course:Simulator:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G107", "marine_course:Simulator:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H107", "marine_course:Simulator:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F108", "marine_course:Indos Number:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G108", "marine_course:Indos Number:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H108", "marine_course:Indos Number:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F109", "marine_course:Upgradation Course:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G109", "marine_course:Upgradation Course:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H109", "marine_course:Upgradation Course:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F110", "marine_course:Revalidation Certificate:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G110", "marine_course:Revalidation Certificate:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H110", "marine_course:Revalidation Certificate:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F111", "marine_course:High Voltage:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G111", "marine_course:High Voltage:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H111", "marine_course:High Voltage:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F112", "marine_course:Reefer Training:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G112", "marine_course:Reefer Training:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H112", "marine_course:Reefer Training:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F113", "marine_course:Engine Maker's:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G113", "marine_course:Engine Maker's:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H113", "marine_course:Engine Maker's:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F114", "marine_course:Crane Training:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G114", "marine_course:Crane Training:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H114", "marine_course:Crane Training:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping(
        "F115",
        "marine_course:Vessel Security Certificate:certificateNumber",
        "alphanumeric",
        horizontal_alignment="center",
    ),
    FieldMapping("G115", "marine_course:Vessel Security Certificate:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H115", "marine_course:Vessel Security Certificate:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("F116", "marine_course:Ship Safety Officer:certificateNumber", "alphanumeric", horizontal_alignment="center"),
    FieldMapping("G116", "marine_course:Ship Safety Officer:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H116", "marine_course:Ship Safety Officer:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping(
        "F117",
        "marine_course:ISF Marlins English test:certificateNumber",
        "alphanumeric",
        horizontal_alignment="center",
    ),
    FieldMapping("G117", "marine_course:ISF Marlins English test:dateOfIssue", "ddmmyyyy", horizontal_alignment="center"),
    FieldMapping("H117", "marine_course:ISF Marlins English test:dateOfExpiry", "ddmmyyyy", horizontal_alignment="center"),
)

FLAG_STATE_DOCUMENT_ROWS = (
    ("122", "Malta", "Seafarer's Book"),
    ("123", "Malta", "Endorsement of the GMDSS"),
    ("124", "Malta", "Endorsement of the CoC"),
    ("126", "Cyprus", "Seafarer's ID and Sea Service Record Book"),
    ("127", "Cyprus", "Cert. Of Recognition of the National CoC"),
    ("129", "Bahamas", "Endorsement of the CoC"),
    ("130", "Bahamas", "Endorsement of the GMDSS"),
    ("131", "Bahamas", "Seafarer's Identification and Record Book"),
    ("133", "United Kingdom", "Endorsement of the CoC (UK CeC)"),
    ("134", "United Kingdom", "Endorsement of the GMDSS"),
    ("135", "United Kingdom", "Seafarer's Identification and Record Book"),
    ("137", "Panama", "Endorsement of the CoC"),
    ("138", "Panama", "Endorsement of the GMDSS GOC"),
    ("139", "Panama", "Seafarer's Identification and Record Book"),
)

FLAG_STATE_DOCUMENT_FIELD_DEFS = (
    ("C", "rankEndorsed", "alphanumeric"),
    ("D", "endorsementNumber", "alphanumeric"),
    ("E", "placeOfIssue", "uppercase"),
    ("F", "dateOfIssue", "ddmmyyyy"),
    ("H", "dateOfExpiry", "ddmmyyyy"),
)

FLAG_STATE_DOCUMENT_FIELD_MAPPINGS = tuple(
    FieldMapping(
        f"{column}{row}",
        f"flag_doc:{flag_state}:{endorsement_type}:{field}",
        transform,
        horizontal_alignment="center",
    )
    for row, flag_state, endorsement_type in FLAG_STATE_DOCUMENT_ROWS
    for column, field, transform in FLAG_STATE_DOCUMENT_FIELD_DEFS
)

FIELD_MAPPINGS = (
    SECTION1_FIELD_MAPPINGS
    + SECTION2_FIELD_MAPPINGS
    + SECTION3_FIELD_MAPPINGS
    + SEAMANS_BOOK_FIELD_MAPPINGS
    + VISA_FIELD_MAPPINGS
    + EDUCATION_FIELD_MAPPINGS
    + COC_FIELD_MAPPINGS
    + GMDSS_FIELD_MAPPINGS
    + MEDICAL_FITNESS_FIELD_MAPPINGS
    + LANGUAGE_FIELD_MAPPINGS
    + MARINE_COURSE_FIELD_MAPPINGS
    + FLAG_STATE_DOCUMENT_FIELD_MAPPINGS
    + PERSONAL_CONTACT_FIELD_MAPPINGS
    + EMERGENCY_CONTACT_FIELD_MAPPINGS
)

PHOTO_SOURCE_PATH = "section2.photoStoragePath"
PHOTO_TARGET_RANGE = "G5:H14"
MAIN_SHEET_NAME = "Main"
HISTORY_SHEET_NAME = "History"
END_SHEET_NAME = "End"
END_VESSEL_TABLE_ROWS = (
    ("3", "Master - C/E"),
    ("4", "C/O - 2/E"),
    ("5", "2/O - 3/E"),
    ("6", "3/O - 4/E"),
    ("7", "E/O"),
)
END_ENGINE_TABLE_ROWS = (
    ("11", "C/E"),
    ("12", "2/E"),
    ("13", "3/E"),
    ("14", "4/E"),
    ("15", "E/O"),
)
END_VESSEL_COLUMNS = {
    "Container": "B",
    "Tanker": "C",
    "Bulk carrier": "D",
    "Roro": "E",
}
END_VESSEL_OTHER_LABEL_COLUMN = "F"
END_VESSEL_OTHER_VALUE_COLUMN = "G"
END_ENGINE_COLUMNS = {
    "Sulzer RTA": "B",
    "Sulzer RND": "C",
    "B & W": "D",
    "MAN": "E",
    "SEMT Pielstick": "F",
    "Steam Turbine": "G",
    "Others": "H",
}
END_REFERENCE_OUTPUT_CELLS = (
    "H19",
    "C24",
    "C25",
    "C26",
    "C27",
    "C28",
    "C31",
    "C32",
    "C33",
    "C34",
    "C35",
    "C36",
    "C37",
    "C38",
    "C39",
    "C40",
    "A45",
)
VISA_MERGED_RANGES = (
    "C36:D36",
    "C37:D37",
    "C38:D38",
    "C39:D39",
    "C40:D40",
    "C41:D41",
    "E36:F36",
    "E37:F37",
    "E38:F38",
    "E39:F39",
    "E40:F40",
    "E41:F41",
    "G36:H36",
    "G37:H37",
    "G38:H38",
    "G39:H39",
    "G40:H40",
    "G41:H41",
)
EDUCATION_MERGED_RANGES = (
    "A45:B45",
    "A46:B46",
    "E45:H45",
    "E46:H46",
)
SEAMANS_BOOK_MERGED_RANGES = (
    "B63:C63",
    "E63:F63",
    "G63:H63",
)
MEDICAL_FITNESS_MERGED_RANGES = (
    "B76:D76",
    "B77:D77",
    "E76:H76",
    "E77:H77",
)
LANGUAGE_MERGED_RANGES = (
    "E81:F81",
    "E82:F82",
    "G81:H81",
    "G82:H82",
)
FLAG_STATE_DOCUMENT_MERGED_RANGES = tuple(f"F{row}:G{row}" for row, _, _ in FLAG_STATE_DOCUMENT_ROWS)
LANGUAGE_UNMERGE_RANGES = (
    "C82:D82",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate CMA CGM Sections 1 and 2 spreadsheet prototype.")
    parser.add_argument("--template", required=True, help="Path to the uploaded template (.numbers/.xlsx/.xls).")
    parser.add_argument("--output", help="Output .xlsx path. Defaults under tmp/client-form-prototype.")
    parser.add_argument("--env-file", default=str(ROOT_DIR / ".env.local"), help="Path to env file for Supabase credentials.")
    parser.add_argument("--application-json", help="Path to a local JSON file containing application data.")
    parser.add_argument("--application-id", help="Supabase applications.id value.")
    parser.add_argument("--reference-number", help="Supabase applications.reference_number value.")
    parser.add_argument("--public-token", help="Supabase applications.public_token value.")
    parser.add_argument("--photo-file", help="Optional local photo override for offline testing.")
    parser.add_argument("--keep-normalized-template", action="store_true", help="Keep the intermediate normalized XLSX template.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    payload = load_application_payload(args)
    normalized_template = normalize_template(Path(args.template))
    output_path = resolve_output_path(args.output, payload)

    warnings: list[str] = []
    photo_bytes = resolve_photo_bytes(args, payload, warnings)
    generate_workbook(normalized_template, output_path, payload, photo_bytes, warnings)

    original_template = Path(args.template).expanduser().resolve()
    if not args.keep_normalized_template and normalized_template != original_template and normalized_template.name.startswith("normalized-"):
        normalized_template.unlink(missing_ok=True)

    print(f"Generated workbook: {output_path}")
    if warnings:
        print("Warnings:")
        for warning in warnings:
            print(f"- {warning}")
    return 0


def load_application_payload(args: argparse.Namespace) -> dict[str, Any]:
    if args.application_json:
        payload = json.loads(Path(args.application_json).read_text())
        if "data" in payload and isinstance(payload["data"], dict):
            payload = payload["data"]
        return payload

    identifier = build_identifier(args)
    if not identifier:
        raise SystemExit(
            "Provide either --application-json or one of --application-id / --reference-number / --public-token."
        )

    env = load_env_file(Path(args.env_file))
    supabase_url = require_env(env, "VITE_SUPABASE_URL")
    service_role_key = require_env(env, "SUPABASE_SERVICE_ROLE_KEY")

    application = fetch_single_row(
        supabase_url,
        service_role_key,
        "applications",
        identifier["field"],
        identifier["value"],
        select="id,reference_number,public_token,status",
    )
    application_id = application["id"]
    app_data = fetch_single_row(
        supabase_url,
        service_role_key,
        "application_data",
        "application_id",
        application_id,
        select="data",
    )
    payload = app_data.get("data") or {}
    payload["_application"] = application
    return payload


def build_identifier(args: argparse.Namespace) -> dict[str, str] | None:
    if args.application_id:
        return {"field": "id", "value": args.application_id}
    if args.reference_number:
        return {"field": "reference_number", "value": args.reference_number}
    if args.public_token:
        return {"field": "public_token", "value": args.public_token}
    return None


def load_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def require_env(env: dict[str, str], key: str) -> str:
    value = env.get(key)
    if not value:
        raise SystemExit(f"Missing required env var: {key}")
    return value


def fetch_single_row(
    supabase_url: str,
    service_role_key: str,
    table: str,
    field: str,
    value: str,
    *,
    select: str,
) -> dict[str, Any]:
    encoded_value = urllib.parse.quote(str(value), safe="")
    url = (
        f"{supabase_url}/rest/v1/{table}"
        f"?select={urllib.parse.quote(select, safe=',*()')}"
        f"&{urllib.parse.quote(field)}=eq.{encoded_value}"
    )
    response = requests.get(
        url,
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
        },
        timeout=30,
    )
    response.raise_for_status()
    rows = response.json()
    if not rows:
        raise SystemExit(f"No {table} row found for {field}={value}")
    if len(rows) > 1:
        raise SystemExit(f"Expected one {table} row for {field}={value}, got {len(rows)}")
    return rows[0]


def resolve_output_path(explicit_output: str | None, payload: dict[str, Any]) -> Path:
    if explicit_output:
        return Path(explicit_output).expanduser().resolve()

    application = payload.get("_application") or {}
    identifier = application.get("reference_number") or DEFAULT_OUTPUT_BASENAME
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return (TMP_DIR / f"{identifier}-section1-section2-{timestamp}.xlsx").resolve()


def normalize_template(template_path: Path) -> Path:
    template_path = template_path.expanduser().resolve()
    suffix = template_path.suffix.lower()

    if suffix == ".xlsx":
        return template_path

    if suffix == ".xls":
        return export_xls_template(template_path)

    if suffix == ".numbers" or is_numbers_package(template_path):
        return export_numbers_template(template_path)

    raise SystemExit(
        f"Unsupported template format for prototype: {template_path.name}. "
        "Use a .numbers, .xls, or .xlsx template."
    )


def is_numbers_package(path: Path) -> bool:
    if not zipfile.is_zipfile(path):
        return False
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
    return "Index/Document.iwa" in names and "Metadata/DocumentIdentifier" in names


def export_numbers_template(template_path: Path) -> Path:
    output_path = template_path.parent / f"normalized-{template_path.stem}.xlsx"
    applescript = f"""
set inputAlias to POSIX file "{escape_applescript_path(str(template_path))}" as alias
set outputFile to POSIX file "{escape_applescript_path(str(output_path))}"

tell application "Numbers"
  activate
  try
    close every document saving no
  end try
  open inputAlias
  delay 2
  set exportedDoc to front document
  export exportedDoc to outputFile as Microsoft Excel
  close exportedDoc saving no
end tell
"""
    subprocess.run(["osascript", "-e", applescript], check=True)
    if not output_path.exists():
        raise SystemExit(f"Numbers export did not produce {output_path}")
    return output_path


def export_xls_template(template_path: Path) -> Path:
    soffice_path = resolve_soffice_path()
    output_path = template_path.parent / f"normalized-{template_path.stem}.xlsx"
    output_path.unlink(missing_ok=True)
    subprocess.run(
        [
            str(soffice_path),
            "--headless",
            "--convert-to",
            "xlsx",
            "--outdir",
            str(template_path.parent),
            str(template_path),
        ],
        check=True,
    )
    converted_path = template_path.parent / f"{template_path.stem}.xlsx"
    if not converted_path.exists():
        raise SystemExit(f"LibreOffice conversion did not produce {converted_path}")
    if converted_path != output_path:
        converted_path.replace(output_path)
    return output_path


def resolve_soffice_path() -> Path:
    configured = os.environ.get("LIBREOFFICE_BIN") or os.environ.get("SOFFICE_BIN")
    candidates = [
        configured,
        shutil.which("soffice"),
        shutil.which("libreoffice"),
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    ]
    for candidate in candidates:
        if not candidate:
            continue
        path = Path(candidate).expanduser()
        if path.exists():
            return path
    raise SystemExit(
        "LibreOffice headless binary not found. Set LIBREOFFICE_BIN or install LibreOffice so .xls templates can be converted."
    )


def escape_applescript_path(path: str) -> str:
    return path.replace("\\", "\\\\").replace('"', '\\"')


def resolve_photo_bytes(
    args: argparse.Namespace,
    payload: dict[str, Any],
    warnings: list[str],
) -> bytes | None:
    if args.photo_file:
        return Path(args.photo_file).expanduser().read_bytes()

    storage_path = get_by_path(payload, PHOTO_SOURCE_PATH)
    if not storage_path:
        warnings.append("No applicant photo path found at section2.photoStoragePath.")
        return None

    public_url = build_public_storage_url(storage_path)
    try:
        response = requests.get(public_url, timeout=30)
        response.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"Failed to download applicant photo from storage: {exc}")
        return None
    return response.content


def build_public_storage_url(storage_path: str) -> str:
    env = load_env_file(ROOT_DIR / ".env.local")
    supabase_url = require_env(env, "VITE_SUPABASE_URL")
    quoted_path = urllib.parse.quote(storage_path, safe="/")
    return f"{supabase_url}/storage/v1/object/public/{PHOTO_BUCKET}/{quoted_path}"


def generate_workbook(
    template_path: Path,
    output_path: Path,
    payload: dict[str, Any],
    photo_bytes: bytes | None,
    warnings: list[str],
) -> None:
    workbook = load_workbook(template_path)
    if MAIN_SHEET_NAME not in workbook.sheetnames:
        raise SystemExit(f"Sheet {MAIN_SHEET_NAME!r} not found in template.")

    worksheet = workbook[MAIN_SHEET_NAME]
    remove_merged_ranges(worksheet, LANGUAGE_UNMERGE_RANGES)
    ensure_merged_ranges(
        worksheet,
        VISA_MERGED_RANGES
        + EDUCATION_MERGED_RANGES
        + SEAMANS_BOOK_MERGED_RANGES
        + MEDICAL_FITNESS_MERGED_RANGES
        + LANGUAGE_MERGED_RANGES
        + FLAG_STATE_DOCUMENT_MERGED_RANGES,
    )
    clear_main_sheet_outputs(worksheet)

    for mapping in FIELD_MAPPINGS:
        value = get_by_path(payload, mapping.source_path)
        if mapping.condition_path and not is_truthy(get_by_path(payload, mapping.condition_path)):
            value = ""
        transformed = transform_value(value, mapping.transform)
        write_preserving_style(worksheet, mapping.cell, transformed, horizontal_alignment=mapping.horizontal_alignment)

    history_worksheet = workbook[HISTORY_SHEET_NAME] if HISTORY_SHEET_NAME in workbook.sheetnames else None
    if history_worksheet is not None:
        clear_history_sheet_outputs(history_worksheet)
        populate_history_sea_service(history_worksheet, payload)
    else:
        warnings.append(f"Sheet {HISTORY_SHEET_NAME!r} not found in template; skipped sea service history export.")

    end_worksheet = workbook[END_SHEET_NAME] if END_SHEET_NAME in workbook.sheetnames else None
    if end_worksheet is not None:
        clear_end_sheet_outputs(end_worksheet)
        populate_end_experience_summary(end_worksheet, payload)
        populate_end_references(end_worksheet, payload)
    else:
        warnings.append(f"Sheet {END_SHEET_NAME!r} not found in template; skipped experience summary export.")

    if photo_bytes:
        insert_photo(worksheet, photo_bytes, PHOTO_TARGET_RANGE)
    else:
        warnings.append("Workbook generated without an embedded photo.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    workbook.save(output_path)


def remove_merged_ranges(worksheet, ranges: tuple[str, ...]) -> None:
    existing = {str(item) for item in worksheet.merged_cells.ranges}
    for cell_range in ranges:
        if cell_range in existing:
            worksheet.unmerge_cells(cell_range)


def ensure_merged_ranges(worksheet, ranges: tuple[str, ...]) -> None:
    existing = {str(item) for item in worksheet.merged_cells.ranges}
    for cell_range in ranges:
        if cell_range not in existing:
            worksheet.merge_cells(cell_range)


def write_preserving_style(
    worksheet,
    cell_ref: str,
    value: Any,
    *,
    horizontal_alignment: str | None = None,
) -> None:
    cell = worksheet[cell_ref]
    style_fill = copy(cell.fill)
    style_border = copy(cell.border)
    style_font = copy(cell.font)
    style_alignment = copy(cell.alignment)
    style_alignment.wrap_text = False
    if horizontal_alignment is not None:
        style_alignment.horizontal = horizontal_alignment
    style_protection = copy(cell.protection)
    style_number_format = cell.number_format

    cell.value = value
    cell.fill = style_fill
    cell.border = style_border
    cell.font = style_font
    cell.alignment = style_alignment
    cell.protection = style_protection
    cell.number_format = style_number_format


def clear_main_sheet_outputs(worksheet) -> None:
    for mapping in FIELD_MAPPINGS:
        worksheet[mapping.cell].value = ""


def clear_history_sheet_outputs(worksheet) -> None:
    for row_number in range(4, 21):
        for column_letter in ("A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"):
            worksheet[f"{column_letter}{row_number}"].value = ""


def clear_end_sheet_outputs(worksheet) -> None:
    for row_number in range(3, 9):
        for column_letter in ("B", "C", "D", "E", "F", "G"):
            worksheet[f"{column_letter}{row_number}"].value = ""
    for row_number in range(11, 17):
        for column_letter in ("B", "C", "D", "E", "F", "G", "H"):
            worksheet[f"{column_letter}{row_number}"].value = ""
    for cell_ref in END_REFERENCE_OUTPUT_CELLS:
        worksheet[cell_ref].value = ""


def transform_value(value: Any, transform: str) -> Any:
    if transform == "uppercase":
        return normalize_text(value).upper()
    if transform == "alphanumeric":
        return normalize_text(value)
    if transform == "numeric":
        return format_numeric(value)
    if transform == "concat_numeric":
        return concat_numeric_parts(value)
    if transform == "concat_address_uppercase":
        return concat_address_parts(value).upper()
    if transform == "yyyy":
        return format_year(value)
    if transform == "tick":
        return "✓" if is_truthy(value) else ""
    if transform == "ddmmyyyy":
        return format_ddmmyyyy(value)
    if transform == "date_serial":
        return format_date_serial(value)
    if transform == "integer":
        return format_integer(value)
    if transform.startswith("split_uppercase_"):
        index = int(transform.rsplit("_", 1)[1])
        return split_address_part(value, index).upper()
    if transform == "yes_no":
        return "" if value in (None, "") else ("YES" if is_truthy(value) else "NO")
    if transform == "text":
        return normalize_text(value)
    raise ValueError(f"Unknown transform: {transform}")


def populate_history_sea_service(worksheet, payload: dict[str, Any]) -> None:
    sea_service = get_history_sea_service_rows(payload)
    for row_number, entry in zip(range(4, 21), sea_service):
        write_preserving_style(
            worksheet,
            f"A{row_number}",
            normalize_text(entry.get("vesselName")).upper(),
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"B{row_number}",
            normalize_text(entry.get("company") or entry.get("companyName")).upper(),
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"C{row_number}",
            normalize_text(entry.get("manning")).upper(),
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"D{row_number}",
            normalize_text(entry.get("tradingArea") or entry.get("tradeRoute")).upper(),
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"E{row_number}",
            normalize_text(entry.get("vesselType")).upper(),
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"F{row_number}",
            normalize_text(entry.get("flag")).upper(),
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"G{row_number}",
            format_numeric(history_service_capacity(entry)),
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"H{row_number}",
            format_year(entry.get("yearBuilt")),
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"I{row_number}",
            normalize_text(entry.get("mainEngineMake")).upper(),
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"J{row_number}",
            normalize_text(entry.get("mainEngine")).upper(),
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"K{row_number}",
            format_numeric(entry.get("engineKw")),
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"L{row_number}",
            normalize_text(entry.get("rankHeld") or entry.get("position")).upper(),
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"M{row_number}",
            format_date_serial(entry.get("signOnDate")),
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"N{row_number}",
            format_ddmmyyyy(entry.get("signOffDate")),
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"O{row_number}",
            format_duration_mmdd(entry.get("signOnDate"), entry.get("signOffDate")),
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"P{row_number}",
            normalize_text(entry.get("reasonForLeaving")).upper(),
            horizontal_alignment="center",
        )


def populate_end_experience_summary(worksheet, payload: dict[str, Any]) -> None:
    sea_service = get_history_sea_service_rows(payload)
    vessel_table = build_vessel_experience_table(sea_service)
    engine_table = build_engine_experience_table(sea_service)

    for row_number, rank_bucket in END_VESSEL_TABLE_ROWS:
        row_data = vessel_table.get(rank_bucket, {})
        for vessel_bucket, column in END_VESSEL_COLUMNS.items():
            write_preserving_style(
                worksheet,
                f"{column}{row_number}",
                format_year_month_duration(row_data.get(vessel_bucket, 0)),
                horizontal_alignment="center",
            )
        latest_other = row_data.get("latest_other")
        write_preserving_style(
            worksheet,
            f"{END_VESSEL_OTHER_LABEL_COLUMN}{row_number}",
            normalize_text(latest_other["label"]).upper() if latest_other else "",
            horizontal_alignment="center",
        )
        write_preserving_style(
            worksheet,
            f"{END_VESSEL_OTHER_VALUE_COLUMN}{row_number}",
            format_year_month_duration(latest_other["days"]) if latest_other else "",
            horizontal_alignment="center",
        )

    for vessel_bucket, column in END_VESSEL_COLUMNS.items():
        total_days = sum(vessel_table.get(rank_bucket, {}).get(vessel_bucket, 0) for _, rank_bucket in END_VESSEL_TABLE_ROWS)
        write_preserving_style(
            worksheet,
            f"{column}8",
            format_year_month_duration(total_days),
            horizontal_alignment="center",
        )
    total_other_days = sum(
        (vessel_table.get(rank_bucket, {}).get("latest_other") or {}).get("days", 0)
        for _, rank_bucket in END_VESSEL_TABLE_ROWS
    )
    write_preserving_style(
        worksheet,
        f"{END_VESSEL_OTHER_VALUE_COLUMN}8",
        format_year_month_duration(total_other_days),
        horizontal_alignment="center",
    )

    for row_number, rank_bucket in END_ENGINE_TABLE_ROWS:
        row_data = engine_table.get(rank_bucket, {})
        for engine_family, column in END_ENGINE_COLUMNS.items():
            write_preserving_style(
                worksheet,
                f"{column}{row_number}",
                format_year_month_duration(row_data.get(engine_family, 0)),
                horizontal_alignment="center",
            )

    for engine_family, column in END_ENGINE_COLUMNS.items():
        total_days = sum(engine_table.get(rank_bucket, {}).get(engine_family, 0) for _, rank_bucket in END_ENGINE_TABLE_ROWS)
        write_preserving_style(
            worksheet,
            f"{column}16",
            format_year_month_duration(total_days),
            horizontal_alignment="center",
        )


def populate_end_references(worksheet, payload: dict[str, Any]) -> None:
    ensure_merged_ranges(
        worksheet,
        (
            "C24:H24",
            "C25:H25",
            "C26:H26",
            "C27:H27",
            "C28:H28",
            "C29:H29",
            "C30:H30",
            "C31:H31",
            "C32:H32",
            "C33:H33",
            "C34:H34",
            "C35:H35",
            "C36:H36",
            "C37:H37",
            "C38:H38",
            "C39:H39",
            "C40:H40",
        ),
    )

    current_employer = get_current_employer_reference(payload)

    write_preserving_style(
        worksheet,
        "H19",
        format_yes_no_text(get_by_path(payload, "section18.objectionToContactLastEmployer")),
        horizontal_alignment="center",
    )
    write_preserving_style(
        worksheet,
        "C24",
        normalize_text(current_employer.get("company")).upper(),
        horizontal_alignment="left",
    )
    write_preserving_style(
        worksheet,
        "C25",
        normalize_text(current_employer.get("contactPerson")).upper(),
        horizontal_alignment="left",
    )
    write_split_merged_rows(worksheet, ("C26", "C27"), current_employer.get("address"))
    write_preserving_style(
        worksheet,
        "C28",
        format_numeric(current_employer.get("phoneNumber")),
        horizontal_alignment="left",
    )

    references = get_reference_rows(payload)
    reference_blocks = (
        (0, "C31", "C32", ("C33", "C34"), "C35"),
        (1, "C36", "C37", ("C38", "C39"), "C40"),
    )
    for index, company_cell, name_cell, address_cells, phone_cell in reference_blocks:
        reference = references[index] if index < len(references) else {}
        write_preserving_style(
            worksheet,
            company_cell,
            normalize_text(reference.get("company")).upper(),
            horizontal_alignment="left",
        )
        write_preserving_style(
            worksheet,
            name_cell,
            normalize_text(reference.get("name")).upper(),
            horizontal_alignment="left",
        )
        write_split_merged_rows(worksheet, address_cells, reference.get("address"))
        write_preserving_style(
            worksheet,
            phone_cell,
            format_numeric(reference.get("phoneNumber")),
            horizontal_alignment="left",
        )

    write_preserving_style(
        worksheet,
        "A45",
        f"Date: {datetime.now().strftime('%d/%m/%Y')}",
        horizontal_alignment="left",
    )


def write_split_range(worksheet, cell_range: str, value: Any) -> None:
    min_col, min_row, max_col, max_row = range_boundaries(cell_range)
    text = normalize_text(value)
    chunks = split_text_across_columns(text, max_col - min_col + 1)

    for index, column_number in enumerate(range(min_col, max_col + 1)):
        cell_ref = f"{get_column_letter(column_number)}{min_row}"
        write_preserving_style(
            worksheet,
            cell_ref,
            chunks[index] if index < len(chunks) else "",
            horizontal_alignment="center",
        )


def write_split_rows(worksheet, cell_ranges: tuple[str, ...], value: Any) -> None:
    lines = split_text_across_lines(normalize_text(value), len(cell_ranges))
    for cell_range, line_text in zip(cell_ranges, lines):
        write_split_range(worksheet, cell_range, line_text)


def write_split_merged_rows(worksheet, cell_refs: tuple[str, ...], value: Any) -> None:
    lines = split_text_across_lines(normalize_text(value), len(cell_refs))
    for cell_ref, line_text in zip(cell_refs, lines):
        write_preserving_style(
            worksheet,
            cell_ref,
            line_text.upper() if line_text else "",
            horizontal_alignment="left",
        )


def split_text_across_columns(value: str, columns: int) -> list[str]:
    if not value or columns <= 0:
        return [""] * max(columns, 0)

    words = value.split()
    if not words:
        return [""] * columns
    if len(words) == 1:
        padded = [words[0]]
        return padded + [""] * (columns - 1)

    chunks = [""] * columns
    for index, word in enumerate(words):
        target = min(index, columns - 1)
        chunks[target] = f"{chunks[target]} {word}".strip() if chunks[target] else word
    return chunks


def split_text_across_lines(value: str, lines: int) -> list[str]:
    if not value or lines <= 0:
        return [""] * max(lines, 0)

    words = value.split()
    if not words:
        return [""] * lines
    if lines == 1 or len(words) == 1:
        padded = [" ".join(words)]
        return padded + [""] * (lines - 1)

    chunks = [""] * lines
    midpoint = max(1, len(words) // lines)
    for index, word in enumerate(words):
        target = min(index // midpoint, lines - 1)
        chunks[target] = f"{chunks[target]} {word}".strip() if chunks[target] else word
    return chunks


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().replace("_", " ")


def format_ddmmyyyy(value: Any) -> str:
    if value in (None, ""):
        return ""
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")

    raw = str(value).strip()
    if not raw:
        return ""

    for parser in (
        lambda text: datetime.fromisoformat(text.replace("Z", "+00:00")),
        lambda text: datetime.strptime(text, "%Y-%m-%d"),
        lambda text: datetime.strptime(text, "%d/%m/%Y"),
        lambda text: datetime.strptime(text, "%d-%m-%Y"),
    ):
        try:
            return parser(raw).strftime("%d/%m/%Y")
        except ValueError:
            continue
    return raw


def format_integer(value: Any) -> str:
    if value in (None, ""):
        return ""
    if isinstance(value, bool):
        return str(int(value))
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return str(int(value))
    if isinstance(value, datetime):
        return str(calculate_age_years(value.date()))
    if isinstance(value, date):
        return str(calculate_age_years(value))

    raw = str(value).strip()
    if not raw:
        return ""
    if raw.isdigit():
        return raw

    for parser in (
        lambda text: datetime.fromisoformat(text.replace("Z", "+00:00")).date(),
        lambda text: datetime.strptime(text, "%Y-%m-%d").date(),
        lambda text: datetime.strptime(text, "%d/%m/%Y").date(),
        lambda text: datetime.strptime(text, "%d-%m-%Y").date(),
    ):
        try:
            return str(calculate_age_years(parser(raw)))
        except ValueError:
            continue
    return raw


def format_date_serial(value: Any) -> date | datetime | str:
    if value in (None, ""):
        return ""
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return value

    raw = str(value).strip()
    if not raw:
        return ""

    for parser in (
        lambda text: datetime.fromisoformat(text.replace("Z", "+00:00")),
        lambda text: datetime.strptime(text, "%Y-%m-%d"),
        lambda text: datetime.strptime(text, "%d/%m/%Y"),
        lambda text: datetime.strptime(text, "%d-%m-%Y"),
    ):
        try:
            return parser(raw)
        except ValueError:
            continue
    return raw


def format_numeric(value: Any) -> str:
    if value in (None, ""):
        return ""
    return "".join(ch for ch in str(value).strip() if ch.isdigit())


def format_year(value: Any) -> str:
    if value in (None, ""):
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y")
    if isinstance(value, date):
        return value.strftime("%Y")

    raw = str(value).strip()
    if not raw:
        return ""
    if len(raw) == 4 and raw.isdigit():
        return raw

    for parser in (
        lambda text: datetime.fromisoformat(text.replace("Z", "+00:00")),
        lambda text: datetime.strptime(text, "%Y-%m-%d"),
        lambda text: datetime.strptime(text, "%d/%m/%Y"),
        lambda text: datetime.strptime(text, "%d-%m-%Y"),
    ):
        try:
            return parser(raw).strftime("%Y")
        except ValueError:
            continue
    return raw


def split_address_part(value: Any, index: int) -> str:
    if value in (None, ""):
        return ""
    parts = [segment.strip() for segment in str(value).split(",") if segment.strip()]
    if index >= len(parts):
        return ""
    return parts[index].replace("_", " ")


def concat_numeric_parts(value: Any) -> str:
    if isinstance(value, list):
        return "".join(format_numeric(part) for part in value if part not in (None, ""))
    return format_numeric(value)


def concat_address_parts(value: Any) -> str:
    if not isinstance(value, list):
        return normalize_text(value).rstrip(",")
    parts = [normalize_text(part).rstrip(",") for part in value if normalize_text(part).rstrip(",")]
    return ", ".join(parts)


def normalize_language_level(value: Any) -> str:
    normalized = normalize_text(value).lower()
    if normalized in {"elementary", "beginner"}:
        return "beginner"
    if normalized == "intermediate":
        return "intermediate"
    if normalized in {"advanced", "native", "native/bilingual", "bilingual"}:
        return "advanced"
    return normalized


def get_history_sea_service_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    sea_service = get_by_path(payload, "section16.seaService")
    if not isinstance(sea_service, list):
        return []

    def sort_key(entry: Any) -> tuple[datetime, datetime]:
        if not isinstance(entry, dict):
            return (datetime.min, datetime.min)
        sign_off = coerce_datetime(entry.get("signOffDate")) or datetime.min
        sign_on = coerce_datetime(entry.get("signOnDate")) or datetime.min
        return (sign_off, sign_on)

    ordered = sorted(
        [entry for entry in sea_service if isinstance(entry, dict)],
        key=sort_key,
        reverse=True,
    )
    return ordered[:17]


def get_reference_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    references = get_by_path(payload, "section18.references")
    if not isinstance(references, list):
        return []
    return [entry for entry in references if isinstance(entry, dict)]


def get_current_employer_reference(payload: dict[str, Any]) -> dict[str, Any]:
    current_employer = get_by_path(payload, "section18.currentEmployer")
    if isinstance(current_employer, dict):
        return current_employer
    return {}


def build_vessel_experience_table(sea_service: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    table = {
        rank_bucket: {bucket: 0 for bucket in END_VESSEL_COLUMNS}
        for _, rank_bucket in END_VESSEL_TABLE_ROWS
    }
    for _, rank_bucket in END_VESSEL_TABLE_ROWS:
        table[rank_bucket]["latest_other"] = None
        table[rank_bucket]["_other_labels"] = {}

    for entry in sea_service:
        rank_bucket = normalize_summary_rank_bucket(entry.get("rankHeld") or entry.get("position"))
        if rank_bucket not in table:
            continue
        duration_days = calculate_service_duration_days(entry.get("signOnDate"), entry.get("signOffDate"))
        if duration_days <= 0:
            continue

        vessel_category = normalize_vessel_summary_bucket(entry.get("vesselType"))
        if vessel_category in END_VESSEL_COLUMNS:
            table[rank_bucket][vessel_category] += duration_days
            continue

        other_label = normalize_text(entry.get("vesselType")).upper()
        if not other_label:
            continue
        table[rank_bucket]["_other_labels"][other_label] = table[rank_bucket]["_other_labels"].get(other_label, 0) + duration_days
        latest_other = table[rank_bucket]["latest_other"]
        candidate_key = history_sort_key(entry)
        if latest_other is None or candidate_key > latest_other["sort_key"]:
            table[rank_bucket]["latest_other"] = {
                "label": other_label,
                "days": table[rank_bucket]["_other_labels"][other_label],
                "sort_key": candidate_key,
            }
        elif latest_other["label"] == other_label:
            latest_other["days"] = table[rank_bucket]["_other_labels"][other_label]

    return table


def build_engine_experience_table(sea_service: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    table = {
        rank_bucket: {engine_family: 0 for engine_family in END_ENGINE_COLUMNS}
        for _, rank_bucket in END_ENGINE_TABLE_ROWS
    }
    for entry in sea_service:
        rank_bucket = normalize_engine_summary_rank_bucket(entry.get("rankHeld") or entry.get("position"))
        if rank_bucket not in table:
            continue
        duration_days = calculate_service_duration_days(entry.get("signOnDate"), entry.get("signOffDate"))
        if duration_days <= 0:
            continue
        engine_family = normalize_engine_family_bucket(entry.get("engineFamily"))
        if not engine_family:
            continue
        table[rank_bucket][engine_family] += duration_days
    return table


def history_service_capacity(entry: dict[str, Any]) -> Any:
    teu = entry.get("teu")
    if format_numeric(teu):
        return teu
    return entry.get("dwt")


def history_sort_key(entry: dict[str, Any]) -> tuple[datetime, datetime]:
    sign_off = coerce_datetime(entry.get("signOffDate")) or datetime.min
    sign_on = coerce_datetime(entry.get("signOnDate")) or datetime.min
    return (sign_off, sign_on)


def calculate_service_duration_days(sign_on: Any, sign_off: Any) -> int:
    start = coerce_date(sign_on)
    end = coerce_date(sign_off)
    if start is None or end is None or end < start:
        return 0
    return (end - start).days


def format_year_month_duration(total_days: int) -> str:
    if total_days <= 0:
        return ""
    years = total_days // 365
    remaining_days = total_days % 365
    months = remaining_days // 30
    days = remaining_days % 30
    return f"{years}Y/{months}M/{days}D"


def normalize_summary_rank_bucket(value: Any) -> str | None:
    normalized = canonicalize_summary_value(value)
    if normalized in {"master", "captain", "chief engineer", "c/e"}:
        return "Master - C/E"
    if normalized in {"chief officer", "c/o", "second engineer", "2/e"}:
        return "C/O - 2/E"
    if normalized in {"second officer", "2/o", "third engineer", "3/e"}:
        return "2/O - 3/E"
    if normalized in {"third officer", "3/o", "fourth engineer", "4/e"}:
        return "3/O - 4/E"
    if normalized in {"electrical officer", "electro technical officer", "eto", "e/o", "electrical engineer"}:
        return "E/O"
    return None


def normalize_engine_summary_rank_bucket(value: Any) -> str | None:
    normalized = canonicalize_summary_value(value)
    if normalized in {"chief engineer", "c/e"}:
        return "C/E"
    if normalized in {"second engineer", "2/e"}:
        return "2/E"
    if normalized in {"third engineer", "3/e"}:
        return "3/E"
    if normalized in {"fourth engineer", "4/e"}:
        return "4/E"
    if normalized in {"electrical officer", "electro technical officer", "eto", "e/o", "electrical engineer"}:
        return "E/O"
    return None


def normalize_vessel_summary_bucket(value: Any) -> str:
    normalized = canonicalize_summary_value(value)
    if normalized == "pc":
        return "Container"
    if normalized == "bc":
        return "Bulk carrier"
    if normalized in {"lng", "lpg", "chem"}:
        return "Tanker"
    if normalized == "roro":
        return "Roro"
    return "Others"


def normalize_engine_family_bucket(value: Any) -> str | None:
    normalized = canonicalize_summary_value(value)
    mapping = {
        "sulzer rta": "Sulzer RTA",
        "sulzer rnd": "Sulzer RND",
        "b & w": "B & W",
        "b&w": "B & W",
        "man": "MAN",
        "semt pielstick": "SEMT Pielstick",
        "steam turbine": "Steam Turbine",
        "others": "Others",
        "other": "Others",
    }
    return mapping.get(normalized)


def canonicalize_summary_value(value: Any) -> str:
    return " ".join(normalize_text(value).replace("’", "'").split()).lower()


def format_yes_no_text(value: Any) -> str:
    normalized = canonicalize_summary_value(value)
    if normalized in {"yes", "true"}:
        return "YES"
    if normalized in {"no", "false"}:
        return "NO"
    return ""


def format_duration_mmdd(sign_on: Any, sign_off: Any) -> str:
    start = coerce_date(sign_on)
    end = coerce_date(sign_off)
    if start is None or end is None or end < start:
        return ""

    months = 0
    cursor = start
    while True:
        next_month = add_one_calendar_month(cursor)
        if next_month <= end:
            months += 1
            cursor = next_month
        else:
            break
    days = (end - cursor).days
    return f"{months}M/{days}D"


def add_one_calendar_month(value: date) -> date:
    year = value.year + (1 if value.month == 12 else 0)
    month = 1 if value.month == 12 else value.month + 1
    day = min(value.day, days_in_month(year, month))
    return date(year, month, day)


def days_in_month(year: int, month: int) -> int:
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    return (next_month - date(year, month, 1)).days


def coerce_date(value: Any) -> date | None:
    parsed = coerce_datetime(value)
    return parsed.date() if parsed is not None else None


def coerce_datetime(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())

    raw = str(value).strip()
    if not raw:
        return None

    for parser in (
        lambda text: datetime.fromisoformat(text.replace("Z", "+00:00")),
        lambda text: datetime.strptime(text, "%Y-%m-%d"),
        lambda text: datetime.strptime(text, "%d/%m/%Y"),
        lambda text: datetime.strptime(text, "%d-%m-%Y"),
    ):
        try:
            return parser(raw)
        except ValueError:
            continue
    return None


def calculate_age_years(birth_date: date) -> int:
    today = datetime.now().date()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


def is_truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "y"}
    return bool(value)


def get_by_path(payload: dict[str, Any], path: str) -> Any:
    if path.startswith("flag_doc:"):
        _, flag_state, endorsement_type, field = path.split(":", 3)
        return get_flag_state_document_value(payload, flag_state, endorsement_type, field)
    if path.startswith("marine_course:"):
        _, course_name, field = path.split(":", 2)
        return get_marine_course_value(payload, course_name, field)
    if path.startswith("language_row:"):
        _, row_index, proficiency_bucket = path.split(":", 2)
        return get_language_row_value(payload, int(row_index), proficiency_bucket)
    if path.startswith("medical_row:"):
        _, row_index, field = path.split(":", 2)
        return get_medical_row_value(payload, int(row_index), field)
    if path.startswith("gmdss_latest:"):
        _, field = path.split(":", 1)
        return get_gmdss_latest_value(payload, field)
    if path.startswith("certificate_row:"):
        _, row_index, field = path.split(":", 2)
        return get_certificate_row_value(payload, int(row_index), field)
    if path.startswith("education_row:"):
        _, row_index, field = path.split(":", 2)
        return get_education_row_value(payload, int(row_index), field)
    if path.startswith("visa:"):
        _, visa_type, field = path.split(":", 2)
        return get_visa_field_by_type(payload, visa_type, field)
    if "|" in path:
        return [get_by_path(payload, part) for part in path.split("|")]
    current: Any = payload
    for key in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def get_education_row_value(payload: dict[str, Any], row_index: int, field: str) -> Any:
    education = get_by_path(payload, "section6.education")
    if not isinstance(education, list):
        return None
    latest_two = education[-2:]
    if row_index >= len(latest_two):
        return None
    entry = latest_two[row_index]
    if not isinstance(entry, dict):
        return None
    return entry.get(field)


def get_certificate_row_value(payload: dict[str, Any], row_index: int, field: str) -> Any:
    certificates = get_by_path(payload, "section8.certificates")
    if not isinstance(certificates, list):
        return None
    latest_two = certificates[-2:]
    if row_index >= len(latest_two):
        return None
    entry = latest_two[row_index]
    if not isinstance(entry, dict):
        return None
    return entry.get(field)


def get_gmdss_latest_value(payload: dict[str, Any], field: str) -> Any:
    gmdss = get_by_path(payload, "section9.gmdss")
    if not isinstance(gmdss, list) or not gmdss:
        return None
    entry = gmdss[-1]
    if not isinstance(entry, dict):
        return None
    return entry.get(field)


def get_medical_row_value(payload: dict[str, Any], row_index: int, field: str) -> Any:
    medical = get_by_path(payload, "section10.medicalFitness")
    if not isinstance(medical, list):
        return None
    latest_two = medical[-2:]
    if row_index >= len(latest_two):
        return None
    entry = latest_two[row_index]
    if not isinstance(entry, dict):
        return None
    return entry.get(field)


def get_language_row_value(payload: dict[str, Any], row_index: int, field: str) -> Any:
    languages = get_by_path(payload, "section12.languages")
    if not isinstance(languages, list):
        return None
    latest_two = languages[-2:]
    if row_index >= len(latest_two):
        return None
    entry = latest_two[row_index]
    if not isinstance(entry, dict):
        return None
    if field == "language":
        return entry.get("language")
    normalized_level = normalize_language_level(entry.get("level"))
    return normalized_level == field


def get_marine_course_value(payload: dict[str, Any], course_name: str, field: str) -> Any:
    courses = get_by_path(payload, "section14.courses")
    if not isinstance(courses, list):
        return None
    target = canonicalize_marine_course_name(course_name)
    for course in reversed(courses):
        if not isinstance(course, dict):
            continue
        if canonicalize_marine_course_name(course.get("courseName")) == target:
            return course.get(field)
    return None


def get_flag_state_document_value(payload: dict[str, Any], flag_state: str, endorsement_type: str, field: str) -> Any:
    endorsements = get_by_path(payload, "section15.endorsements")
    if not isinstance(endorsements, list):
        return None
    target_flag_state = canonicalize_flag_state_name(flag_state)
    target_endorsement_type = canonicalize_flag_state_endorsement_type(flag_state, endorsement_type)
    for endorsement in reversed(endorsements):
        if not isinstance(endorsement, dict):
            continue
        actual_flag_state = canonicalize_flag_state_name(endorsement.get("flagState"))
        if actual_flag_state != target_flag_state:
            continue
        actual_endorsement_type = canonicalize_flag_state_endorsement_type(
            endorsement.get("flagState"),
            endorsement.get("endorsementType"),
        )
        if actual_endorsement_type != target_endorsement_type:
            continue
        return endorsement.get(field)
    return None


def get_visa_field_by_type(payload: dict[str, Any], visa_type: str, field: str) -> Any:
    visas = get_by_path(payload, "section5.visas")
    if not isinstance(visas, list):
        return None
    target = canonicalize_visa_type(visa_type)
    for visa in visas:
        if not isinstance(visa, dict):
            continue
        if canonicalize_visa_type(visa.get("type")) == target:
            return visa.get(field)
    return None


def canonicalize_visa_type(value: Any) -> str:
    normalized = normalize_text(value).lower()
    aliases = {
        "australia entry visa": "australia entry visa",
        "australia entry visa ": "australia entry visa",
        "australia entry visa": "australia entry visa",
    }
    return aliases.get(normalized, normalized)


def canonicalize_marine_course_name(value: Any) -> str:
    normalized = " ".join(normalize_text(value).replace("’", "'").split()).lower()
    aliases = {
        "arpa/ncc": "arpa / ncc",
        "arpa / ncc": "arpa / ncc",
        "btm/etm": "btm / etm",
        "btm / etm": "btm / etm",
        "sso": "ship security officer (sso)",
        "ship security officer (sso)": "ship security officer (sso)",
        "ship handling": "ship handling & manoeuvring",
        "ship handling & manoeuvring": "ship handling & manoeuvring",
        "loading software": "loading software (name it)",
        "loading software (name it)": "loading software (name it)",
        "simulator": "large vessel handling simulator / engine room simulator",
        "large vessel handling simulator / engine room simulator": "large vessel handling simulator / engine room simulator",
        "revalidation certificate": "revalidation course for renewal of coc",
        "revalidation course for renewal of coc": "revalidation course for renewal of coc",
        "high voltage": "high voltage training",
        "high voltage training": "high voltage training",
        "engine maker's": "engine maker's training",
        "engine maker's training": "engine maker's training",
        "engine maker’s training": "engine maker's training",
        "crane training": "crane manufactures training",
        "crane manufactures training": "crane manufactures training",
        "vessel security certificate": "vessel security training course",
        "vessel security training course": "vessel security training course",
    }
    return aliases.get(normalized, normalized)


def canonicalize_flag_state_document_value(value: Any) -> str:
    return " ".join(normalize_text(value).replace("’", "'").split()).lower()


def canonicalize_flag_state_name(value: Any) -> str:
    return canonicalize_flag_state_document_value(value)


def canonicalize_flag_state_endorsement_type(flag_state: Any, value: Any) -> str:
    normalized_flag_state = canonicalize_flag_state_name(flag_state)
    normalized_value = canonicalize_flag_state_document_value(value)

    aliases = {
        "recognition of coc": {
            "cyprus": "cert. of recognition of the national coc",
            "default": "endorsement of the coc",
            "united kingdom": "endorsement of the coc (uk cec)",
        },
        "endorsement of the coc": {
            "united kingdom": "endorsement of the coc (uk cec)",
        },
        "endorsement of the gmdss": {
            "panama": "endorsement of the gmdss goc",
        },
    }
    if normalized_value in aliases:
        state_specific = aliases[normalized_value]
        if normalized_flag_state in state_specific:
            return state_specific[normalized_flag_state]
        if "default" in state_specific:
            return state_specific["default"]
    return normalized_value


def insert_photo(worksheet, photo_bytes: bytes, target_range: str) -> None:
    min_col, min_row, max_col, max_row = range_boundaries(target_range)
    start_cell = f"{get_column_letter(min_col)}{min_row}"

    target_width = sum(column_width_to_pixels(worksheet, col_idx) for col_idx in range(min_col, max_col + 1))
    target_height = sum(row_height_to_pixels(worksheet, row_idx) for row_idx in range(min_row, max_row + 1))

    source = Image.open(io.BytesIO(photo_bytes))
    source = source.convert("RGB")
    source.thumbnail((target_width, target_height), Image.Resampling.LANCZOS)

    image_buffer = io.BytesIO()
    source.save(image_buffer, format="PNG")
    image_buffer.seek(0)

    worksheet[start_cell] = None

    image = XLImage(image_buffer)
    image.width = source.width
    image.height = source.height
    image.anchor = start_cell
    worksheet.add_image(image)


def column_width_to_pixels(worksheet, col_idx: int) -> int:
    letter = get_column_letter(col_idx)
    width = worksheet.column_dimensions[letter].width
    if width is None:
        width = worksheet.sheet_format.defaultColWidth or 8.43
    return int(width * 7)


def row_height_to_pixels(worksheet, row_idx: int) -> int:
    height = worksheet.row_dimensions[row_idx].height
    if height is None:
        height = worksheet.sheet_format.defaultRowHeight or 15
    return int(height * 4 / 3)


if __name__ == "__main__":
    sys.exit(main())
