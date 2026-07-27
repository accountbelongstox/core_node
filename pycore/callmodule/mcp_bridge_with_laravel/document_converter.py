#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Document format converter and writer for the File Processor MCP Server.

Extracted from main.py. Handles html/md/pdf/docx/json/excel conversions and the
convert_format dispatcher. Delegates package availability checks to PackageManager.
"""

import logging
from typing import Dict, Any, Optional, Union

from package_manager import PackageManager

from pycore.pyfoundations.third_party import get_third_package_openpyxl


logger = logging.getLogger(__name__)


class DocumentConverter:
    """Document format converter and writer"""

    def __init__(self):
        self.conversion_mappings = {
            'html_to_markdown': self.html_to_markdown,
            'html_to_pdf': self.html_to_pdf,
            'html_to_docx': self.html_to_docx,
            'markdown_to_html': self.markdown_to_html,
            'markdown_to_pdf': self.markdown_to_pdf,
            'text_to_html': self.text_to_html,
            'json_to_excel': self.json_to_excel,
            'excel_to_json': self.excel_to_json
        }

    def html_to_markdown(self, html_content: str, **kwargs) -> str:
        """Convert HTML to Markdown"""
        try:
            if not PackageManager.ensure_packages('html'):
                raise ImportError("HTML conversion packages not available")

            h = html2text.HTML2Text()
            h.ignore_links = kwargs.get('ignore_links', False)
            h.ignore_images = kwargs.get('ignore_images', False)
            h.body_width = kwargs.get('body_width', 0)
            return h.handle(html_content)
        except Exception as e:
            logger.error(f"HTML to Markdown conversion failed: {e}")
            raise

    def html_to_pdf(self, html_content: str, output_path: str, **kwargs) -> bool:
        """Convert HTML to PDF"""
        try:
            if not PackageManager.ensure_packages('conversion'):
                raise ImportError("PDF conversion packages not available")

            try:
                options = {
                    'page-size': kwargs.get('page_size', 'A4'),
                    'encoding': kwargs.get('encoding', 'UTF-8'),
                    'margin-top': kwargs.get('margin_top', '0.75in'),
                    'margin-right': kwargs.get('margin_right', '0.75in'),
                    'margin-bottom': kwargs.get('margin_bottom', '0.75in'),
                    'margin-left': kwargs.get('margin_left', '0.75in'),
                }
                pdfkit.from_string(html_content, output_path, options=options)
                return True
            except ImportError:
                # Fallback to weasyprint
                html_doc = weasyprint.HTML(string=html_content)
                html_doc.write_pdf(output_path)
                return True

        except Exception as e:
            logger.error(f"HTML to PDF conversion failed: {e}")
            return False

    def html_to_docx(self, html_content: str, output_path: str, **kwargs) -> bool:
        """Convert HTML to Word document"""
        try:
            if not PackageManager.ensure_packages('html'):
                raise ImportError("HTML conversion packages not available")


            # First convert HTML to markdown, then to docx
            markdown_content = self.html_to_markdown(html_content)
            return self.markdown_to_docx(markdown_content, output_path, **kwargs)

        except Exception as e:
            logger.error(f"HTML to DOCX conversion failed: {e}")
            return False

    def markdown_to_html(self, markdown_content: str, **kwargs) -> str:
        """Convert Markdown to HTML"""
        try:
            if not PackageManager.ensure_packages('markdown'):
                raise ImportError("Markdown conversion packages not available")

            md = markdown.Markdown(extensions=kwargs.get('extensions', ['tables', 'fenced_code']))
            return md.convert(markdown_content)

        except Exception as e:
            logger.error(f"Markdown to HTML conversion failed: {e}")
            raise

    def markdown_to_pdf(self, markdown_content: str, output_path: str, **kwargs) -> bool:
        """Convert Markdown to PDF"""
        try:
            # Convert markdown to HTML first, then to PDF
            html_content = self.markdown_to_html(markdown_content, **kwargs)
            return self.html_to_pdf(html_content, output_path, **kwargs)

        except Exception as e:
            logger.error(f"Markdown to PDF conversion failed: {e}")
            return False

    def markdown_to_docx(self, markdown_content: str, output_path: str, **kwargs) -> bool:
        """Convert Markdown to Word document"""
        try:
            if not PackageManager.ensure_packages('office'):
                raise ImportError("Office conversion packages not available")


            doc = Document()
            lines = markdown_content.split('\n')

            for line in lines:
                line = line.strip()
                if not line:
                    continue

                if line.startswith('# '):
                    doc.add_heading(line[2:], level=1)
                elif line.startswith('## '):
                    doc.add_heading(line[3:], level=2)
                elif line.startswith('### '):
                    doc.add_heading(line[4:], level=3)
                elif line.startswith('- ') or line.startswith('* '):
                    doc.add_paragraph(line[2:], style='List Bullet')
                else:
                    doc.add_paragraph(line)

            doc.save(output_path)
            return True

        except Exception as e:
            logger.error(f"Markdown to DOCX conversion failed: {e}")
            return False

    def text_to_html(self, text_content: str, **kwargs) -> str:
        """Convert plain text to HTML"""
        try:
            lines = text_content.split('\n')
            html_lines = []

            for line in lines:
                if not line.strip():
                    html_lines.append('<br>')
                else:
                    html_lines.append(f'<p>{line}</p>')

            title = kwargs.get('title', 'Document')

            html_template = f"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device, initial-scale=1.0">
                <title>{title}</title>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }}
                    p {{ margin-bottom: 1em; }}
                </style>
            </head>
            <body>
                {''.join(html_lines)}
            </body>
            </html>
            """

            return html_template.strip()

        except Exception as e:
            logger.error(f"Text to HTML conversion failed: {e}")
            raise

    def json_to_excel(self, json_data: Dict[str, Any], output_path: str, **kwargs) -> bool:
        """Convert JSON data to Excel file"""
        try:
            if not PackageManager.ensure_packages('office'):
                raise ImportError("Office conversion packages not available")

            openpyxl = get_third_package_openpyxl()

            wb = Workbook()
            ws = wb.active
            ws.title = kwargs.get('sheet_name', 'Data')

            def flatten_json(data, parent_key='', sep='.'):
                items = []
                if isinstance(data, dict):
                    for k, v in data.items():
                        new_key = f"{parent_key}{sep}{k}" if parent_key else k
                        if isinstance(v, (dict, list)):
                            items.extend(flatten_json(v, new_key, sep).items())
                        else:
                            items.append((new_key, v))
                elif isinstance(data, list):
                    for i, v in enumerate(data):
                        new_key = f"{parent_key}[{i}]"
                        if isinstance(v, (dict, list)):
                            items.extend(flatten_json(v, new_key, sep).items())
                        else:
                            items.append((new_key, v))
                return dict(items)

            flat_data = flatten_json(json_data)

            # Write headers
            headers = list(flat_data.keys())
            for col, header in enumerate(headers, 1):
                ws.cell(row=1, column=col, value=header)

            # Write data
            values = list(flat_data.values())
            for col, value in enumerate(values, 1):
                ws.cell(row=2, column=col, value=str(value))

            wb.save(output_path)
            return True

        except Exception as e:
            logger.error(f"JSON to Excel conversion failed: {e}")
            return False

    def excel_to_json(self, excel_path: str, **kwargs) -> Dict[str, Any]:
        """Convert Excel file to JSON data"""
        try:
            if not PackageManager.ensure_packages('office'):
                raise ImportError("Office conversion packages not available")

            openpyxl = get_third_package_openpyxl()

            wb = openpyxl.load_workbook(excel_path)
            result = {}

            for sheet_name in wb.sheetnames:
                ws = wb[sheet_name]
                sheet_data = []

                # Get headers from first row
                headers = [cell.value for cell in ws[1]]

                # Get data rows
                for row in ws.iter_rows(min_row=2, values_only=True):
                    if any(cell is not None for cell in row):
                        row_data = {}
                        for header, cell in zip(headers, row):
                            if header:
                                row_data[header] = cell
                        if row_data:
                            sheet_data.append(row_data)

                result[sheet_name] = sheet_data

            return result

        except Exception as e:
            logger.error(f"Excel to JSON conversion failed: {e}")
            raise

    def convert_format(
        self,
        input_data: Union[str, Dict[str, Any]],
        from_format: str,
        to_format: str,
        output_path: Optional[str] = None,
        **kwargs
    ) -> Union[str, Dict[str, Any], bool]:
        """Universal format converter"""
        try:
            conversion_key = f"{from_format}_to_{to_format}"

            if conversion_key not in self.conversion_mappings:
                raise ValueError(f"Conversion from {from_format} to {to_format} not supported")

            converter_func = self.conversion_mappings[conversion_key]

            if output_path:
                # File output conversion
                if from_format == 'html' and to_format in ['pdf', 'docx']:
                    return converter_func(input_data, output_path, **kwargs)
                elif from_format == 'markdown' and to_format in ['pdf', 'docx']:
                    return converter_func(input_data, output_path, **kwargs)
                elif from_format == 'json' and to_format == 'excel':
                    return converter_func(input_data, output_path, **kwargs)
                else:
                    # String conversion, then save to file
                    result = converter_func(input_data, **kwargs)
                    with open(output_path, 'w', encoding='utf-8') as f:
                        f.write(result)
                    return True
            else:
                # String/data conversion
                return converter_func(input_data, **kwargs)

        except Exception as e:
            logger.error(f"Format conversion failed: {e}")
            raise
