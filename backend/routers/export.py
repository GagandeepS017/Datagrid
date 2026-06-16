from io import BytesIO

import openpyxl
import openpyxl.styles
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(tags=["export"])


class ExcelRequest(BaseModel):
    columns:  list[str]
    rows:     list[list]
    filename: str = "query_results"


@router.post("/export/excel")
def export_excel(req: ExcelRequest):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Results"

    bold = openpyxl.styles.Font(bold=True)
    ws.append(req.columns)
    for cell in ws[1]:
        cell.font = bold

    for row in req.rows:
        ws.append([str(v) if v is not None else "" for v in row])

    for col in ws.columns:
        width = max((len(str(cell.value or "")) for cell in col), default=8)
        ws.column_dimensions[col[0].column_letter].width = min(width + 2, 40)

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    safe_name = req.filename.replace(" ", "_")
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.xlsx"'},
    )
