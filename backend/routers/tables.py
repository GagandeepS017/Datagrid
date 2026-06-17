from fastapi import APIRouter, HTTPException
from services.sql_engine import list_tables, delete_table, table_exists

router = APIRouter(tags=["tables"])


@router.get("/tables")
def get_tables():
    return list_tables()


@router.delete("/tables/{table_id}")
def remove_table(table_id: str):
    if not table_exists(table_id):
        raise HTTPException(status_code=404, detail="Table not found.")
    delete_table(table_id)
    return {"deleted": table_id}
