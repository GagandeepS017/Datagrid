from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.evaluator import run_benchmark, latest_run

router = APIRouter(tags=["eval"])


class EvalRunRequest(BaseModel):
    benchmark_file: str = "nl2sql_benchmark.json"


@router.post("/eval/run")
def run_eval(req: EvalRunRequest = EvalRunRequest()):
    """Run the full NL->SQL benchmark and return per-item results plus aggregate metrics.

    Makes one Claude call per item (plus retries), so expect ~15-40s for the
    bundled 15-item benchmark.
    """
    try:
        return run_benchmark(req.benchmark_file)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {exc}")


@router.get("/eval/results")
def get_eval_results():
    """Return the most recent saved benchmark run."""
    run = latest_run()
    if run is None:
        raise HTTPException(status_code=404, detail="No evaluation runs yet. POST /api/eval/run first.")
    return run
