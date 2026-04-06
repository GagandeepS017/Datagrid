from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.profiler import profile_dataframe
from services.sql_engine import table_exists, _tables

router = APIRouter(tags=["profile"])


class ProfileRequest(BaseModel):
    table_id: str


@router.post("/profile")
def run_profile(req: ProfileRequest):
    if not table_exists(req.table_id):
        raise HTTPException(status_code=404, detail="Table not found. Please re-upload your file.")

    df = _tables[req.table_id]
    try:
        profile = profile_dataframe(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profiling failed: {e}")

    return profile
