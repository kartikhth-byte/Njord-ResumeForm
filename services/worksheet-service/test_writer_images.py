"""A prefilled template must never carry another applicant's images forward."""
from __future__ import annotations

import io
import tempfile
import unittest
from pathlib import Path
from copy import copy

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment
from openpyxl.drawing.image import Image as XLImage
from openpyxl.drawing.spreadsheet_drawing import AbsoluteAnchor, AnchorMarker, TwoCellAnchor
from PIL import Image

from scripts.client_forms.cma_cgm_writer import clear_personal_images, column_width_to_pixels, generate_workbook, write_preserving_style


def photo() -> bytes:
    output = io.BytesIO()
    Image.new('RGB', (30, 40), 'blue').save(output, format='PNG')
    return output.getvalue()


def add_image(sheet, anchor):
    image = XLImage(io.BytesIO(photo()))
    image.anchor = anchor
    sheet.add_image(image)


class WorksheetImageReplacementTest(unittest.TestCase):
    def test_reused_export_clears_previous_photo_and_signature_but_keeps_logos(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template, first, second = [root / name for name in ('template.xlsx', 'first.xlsx', 'second.xlsx')]
            wb = Workbook()
            wb.active.title = 'Main'
            wb.create_sheet('History')
            wb.create_sheet('End')
            add_image(wb['Main'], 'A1')  # Customer branding is not applicant data.
            add_image(wb['Main'], 'G5')
            add_image(wb['End'], 'D45')
            wb['End']['D44'] = 'Signature:'
            wb.save(template)
            generate_workbook(template, first, {}, photo(), [])
            generated = load_workbook(first)
            self.assertEqual(len(generated['Main']._images), 2)  # Logo plus new photo only.
            self.assertEqual(len(generated['End']._images), 0)
            self.assertEqual(generated['End']['D44'].value, 'Signature:')
            generate_workbook(first, second, {}, None, [])
            replaced = load_workbook(second)
            self.assertEqual(len(replaced['Main']._images), 1)  # No previous applicant photo.
            self.assertEqual(replaced['Main']._images[0].anchor._from.row, 0)
            self.assertEqual(len(replaced['End']._images), 0)

    def test_output_keeps_wrapping_or_fits_text_without_changing_template_width(self):
        sheet = Workbook().active
        sheet['D32'].alignment = Alignment(wrap_text=True)
        sheet.column_dimensions['L'].width = 10
        original_font = copy(sheet['L4'].font)
        write_preserving_style(sheet, 'D32', '14/03/2021')
        write_preserving_style(sheet, 'L4', 'CHIEF OFFICER')
        self.assertTrue(sheet['D32'].alignment.wrap_text)
        self.assertTrue(sheet['L4'].alignment.shrink_to_fit)
        self.assertEqual(sheet['L4'].font, original_font)
        self.assertEqual(sheet.column_dimensions['L'].width, 10)

    def test_drawing_crossing_photo_boundary_is_removed(self):
        sheet = Workbook().active
        add_image(sheet, TwoCellAnchor(_from=AnchorMarker(col=5, row=3), to=AnchorMarker(col=7, row=6)))
        add_image(sheet, 'A1')
        clear_personal_images(sheet, 'G5:H14')
        self.assertEqual([image.anchor for image in sheet._images], ['A1'])

    def test_saved_one_cell_and_unsaved_images_crossing_output_boundary_are_removed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'images.xlsx'
            wb = Workbook()
            wb.active.title = 'Main'
            wb.create_sheet('End')
            add_image(wb['Main'], 'G4')  # Starts above the photo area but extends into it.
            add_image(wb['Main'], 'A1')
            add_image(wb['End'], 'D44')  # Same issue above the signature area.
            clear_personal_images(wb['Main'], 'G5:H14')
            self.assertEqual([i.anchor for i in wb['Main']._images], ['A1'])
            add_image(wb['Main'], 'G4')
            wb.save(path)
            saved = load_workbook(path)
            clear_personal_images(saved['Main'], 'G5:H14')
            clear_personal_images(saved['End'], 'D45:H47')
            self.assertEqual(len(saved['Main']._images), 1)
            self.assertEqual(saved['Main']._images[0].anchor._from.col, 0)
            self.assertEqual(len(saved['End']._images), 0)

    def test_geometry_preserves_default_and_grouped_dimensions_across_save(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'template.xlsx'
            wb = Workbook()
            sheet = wb.active
            sheet.sheet_format.defaultColWidth = 9
            sheet.sheet_format.defaultRowHeight = 17
            sheet.column_dimensions.group('B', 'D', hidden=False)
            sheet.column_dimensions['B'].width = 11
            add_image(sheet, 'G4')
            wb.save(path)
            sheet = load_workbook(path).active
            before_columns = {key: dict(value) for key, value in sheet.column_dimensions.items()}
            before_rows = {key: dict(value) for key, value in sheet.row_dimensions.items()}
            self.assertEqual(column_width_to_pixels(sheet, 3), 77)  # Grouped C uses B:D.
            clear_personal_images(sheet, 'G5:H14')
            self.assertEqual({key: dict(value) for key, value in sheet.column_dimensions.items()}, before_columns)
            self.assertEqual({key: dict(value) for key, value in sheet.row_dimensions.items()}, before_rows)
            sheet.parent.save(path)
            saved = load_workbook(path).active
            self.assertEqual({key: dict(value) for key, value in saved.column_dimensions.items()}, before_columns)
            self.assertEqual(saved.sheet_format.defaultColWidth, 9)
            self.assertEqual(saved.sheet_format.defaultRowHeight, 17)

    def test_unlocatable_image_fails_instead_of_leaking_an_old_signature(self):
        sheet = Workbook().active
        add_image(sheet, AbsoluteAnchor())
        with self.assertRaisesRegex(ValueError, 'cell anchor'):
            clear_personal_images(sheet, 'G5:H14')


if __name__ == '__main__':
    unittest.main()
