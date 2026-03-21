from __future__ import annotations

import json
import shutil
import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse


app = FastAPI(title="DAGR API", version="1.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# Paths / constants
# --------------------------------------------------

API_ROOT = Path(__file__).resolve().parents[1]  # .../dagr-web/api
DATA_ROOT = API_ROOT / "data"
JOBS_ROOT = DATA_ROOT / "jobs"
TESTDATA_ROOT = API_ROOT / "testdata"
DAGR_SCRIPT = API_ROOT / "dagr_bit_align.py"

JOBS_ROOT.mkdir(parents=True, exist_ok=True)

EXAMPLE_A = TESTDATA_ROOT / "1TJY.pdb"
EXAMPLE_B = TESTDATA_ROOT / "1TM2.pdb"

MAX_RUN_SECONDS = 60
RESULT_TTL_SECONDS = 300  # 5 minutes


# --------------------------------------------------
# Helpers
# --------------------------------------------------

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


def parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    return datetime.fromisoformat(value)


def make_job_id() -> str:
    return uuid.uuid4().hex[:8]


def get_job_dir(job_id: str) -> Path:
    return JOBS_ROOT / job_id


def get_meta_path(job_id: str) -> Path:
    return get_job_dir(job_id) / "meta.json"


def get_result_path(job_id: str) -> Path:
    return get_job_dir(job_id) / "result.json"


def get_stdout_path(job_id: str) -> Path:
    return get_job_dir(job_id) / "stdout.txt"


def get_stderr_path(job_id: str) -> Path:
    return get_job_dir(job_id) / "stderr.txt"


def read_json(path: Path) -> dict:
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path.name}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def tail_text(path: Path, max_chars: int = 4000) -> str:
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8", errors="ignore")
    return text[-max_chars:]


def summarize_dagr_error(stderr_text: str, method: str) -> str:
    text = (stderr_text or "").strip()

    if "Exact search would require" in text and "max_exact_combinations" in text:
        return (
            "현재 조건에서는 exact 탐색 조합 수가 너무 커 실행할 수 없습니다. "
            "exact 대신 iterative를 사용해보거나, 파라미터를 조정한 뒤 다시 시도해주세요."
        )

    if "timed out" in text.lower():
        return (
            "실행 시간이 1분을 초과하여 분석이 자동 중단되었습니다. "
            "exact 대신 iterative를 사용해보거나, 파라미터를 조정한 뒤 다시 시도해주세요."
        )

    if method == "exact":
        return (
            "exact 실행 중 오류가 발생했습니다. "
            "iterative를 사용해보거나, 파라미터를 조정한 뒤 다시 시도해주세요."
        )

    return text[-1000:] if text else "DAGR execution failed."


def prune_expired_jobs() -> None:
    now = now_utc()
    if not JOBS_ROOT.exists():
        return

    for folder in JOBS_ROOT.iterdir():
        if not folder.is_dir():
            continue

        meta_path = folder / "meta.json"
        if not meta_path.exists():
            continue

        try:
            meta = read_json(meta_path)
        except Exception:
            continue

        cleanup_at = parse_iso(meta.get("cleanup_at"))
        if cleanup_at and now >= cleanup_at:
            shutil.rmtree(folder, ignore_errors=True)


def ensure_job_exists(job_id: str) -> Path:
    prune_expired_jobs()
    folder = get_job_dir(job_id)
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(status_code=404, detail="Job not found.")
    return folder


def update_meta(job_id: str, **updates: Any) -> dict:
    path = get_meta_path(job_id)
    meta = read_json(path)
    meta.update(updates)
    meta["updated_at"] = now_iso()
    write_json(path, meta)
    return meta


def schedule_cleanup_if_needed(job_id: str) -> dict:
    path = get_meta_path(job_id)
    meta = read_json(path)
    if not meta.get("cleanup_at"):
        meta["cleanup_at"] = (now_utc() + timedelta(seconds=RESULT_TTL_SECONDS)).isoformat()
        meta["updated_at"] = now_iso()
        write_json(path, meta)
    return meta


def validate_inputs(
    chain_a: str,
    chain_b: str,
    dcut: float,
    method: str,
    max_domains: Optional[int],
    n_domains: Optional[int],
) -> None:
    if not chain_a or not chain_a.strip():
        raise HTTPException(status_code=422, detail="Chain A와 Chain B를 입력해주세요.")
    if not chain_b or not chain_b.strip():
        raise HTTPException(status_code=422, detail="Chain A와 Chain B를 입력해주세요.")
    if dcut <= 0:
        raise HTTPException(status_code=400, detail="dcut must be > 0.")

    method = method.lower().strip()
    if method not in {"iterative", "exact"}:
        raise HTTPException(status_code=400, detail="method must be 'iterative' or 'exact'.")

    if method == "iterative":
        if max_domains is None:
            raise HTTPException(status_code=400, detail="max_domains is required for iterative method.")
        if max_domains <= 0:
            raise HTTPException(status_code=400, detail="max_domains must be > 0.")
        if n_domains is not None:
            raise HTTPException(status_code=400, detail="n_domains must be empty for iterative method.")

    if method == "exact":
        if n_domains is None:
            raise HTTPException(status_code=400, detail="n_domains is required for exact method.")
        if n_domains <= 0:
            raise HTTPException(status_code=400, detail="n_domains must be > 0.")
        if max_domains is not None:
            raise HTTPException(status_code=400, detail="max_domains must be empty for exact method.")


def build_dagr_command(job_id: str, meta: dict) -> list[str]:
    inputs = meta["inputs"]
    folder = get_job_dir(job_id)

    cmd = [
        sys.executable,
        str(DAGR_SCRIPT),
        str(folder / "input_a.pdb"),
        str(folder / "input_b.pdb"),
        "--chain-a",
        inputs["chain_a"],
        "--chain-b",
        inputs["chain_b"],
        "--dcut",
        str(inputs["dcut"]),
        "--method",
        inputs["method"],
        "--json-out",
        str(get_result_path(job_id)),
    ]

    if inputs["method"] == "iterative":
        if inputs["max_domains"] is not None:
            cmd.extend(["--max-domains", str(inputs["max_domains"])])
    elif inputs["method"] == "exact":
        if inputs["n_domains"] is not None:
            cmd.extend(["--n-domains", str(inputs["n_domains"])])

    # 기본은 postprocess ON, false일 때만 끔
    if not inputs["postprocess"]:
        cmd.append("--no-postprocess")

    return cmd


def extract_result_summary(result: dict) -> dict:
    summary: dict[str, Any] = {}

    for key in [
        "coverage_fraction",
        "overlap_fraction",
        "hinge_count",
        "uncovered_count",
        "selected_domains",
    ]:
        if key in result:
            summary[key] = result[key]

    if "summary" in result and isinstance(result["summary"], dict):
        nested = result["summary"]
        for key in ["coverage_fraction", "overlap_fraction", "hinge_count", "uncovered_count"]:
            if key in nested and key not in summary:
                summary[key] = nested[key]

    return summary


# --------------------------------------------------
# Routes
# --------------------------------------------------

@app.get("/")
def root():
    prune_expired_jobs()
    return {
        "message": "DAGR API is running.",
        "api_root": str(API_ROOT),
        "jobs_root": str(JOBS_ROOT),
        "dagr_script": str(DAGR_SCRIPT),
    }


@app.get("/health")
def health():
    prune_expired_jobs()
    return {"status": "ok"}


@app.post("/v1/jobs")
async def create_job(
    use_example: bool = Form(False),
    pdb_a: UploadFile | None = File(None),
    pdb_b: UploadFile | None = File(None),
    chain_a: str = Form(...),
    chain_b: str = Form(...),
    dcut: float = Form(...),
    method: Literal["iterative", "exact"] = Form(...),
    max_domains: Optional[int] = Form(None),
    n_domains: Optional[int] = Form(None),
    postprocess: bool = Form(True),
):
    prune_expired_jobs()

    method = method.lower().strip()
    chain_a = chain_a.strip()
    chain_b = chain_b.strip()

    validate_inputs(
        chain_a=chain_a,
        chain_b=chain_b,
        dcut=dcut,
        method=method,
        max_domains=max_domains,
        n_domains=n_domains,
    )

    if use_example:
        if not EXAMPLE_A.exists() or not EXAMPLE_B.exists():
            raise HTTPException(status_code=500, detail="Example dataset not found.")
    else:
        if pdb_a is None or pdb_b is None:
            raise HTTPException(status_code=422, detail="PDB file A와 PDB file B를 업로드해주세요.")

    job_id = make_job_id()
    folder = get_job_dir(job_id)
    folder.mkdir(parents=True, exist_ok=False)

    input_a_path = folder / "input_a.pdb"
    input_b_path = folder / "input_b.pdb"

    if use_example:
        shutil.copyfile(EXAMPLE_A, input_a_path)
        shutil.copyfile(EXAMPLE_B, input_b_path)
        original_filename_a = EXAMPLE_A.name
        original_filename_b = EXAMPLE_B.name
        source_mode = "example"
    else:
        input_a_bytes = await pdb_a.read()
        input_b_bytes = await pdb_b.read()
        input_a_path.write_bytes(input_a_bytes)
        input_b_path.write_bytes(input_b_bytes)
        original_filename_a = pdb_a.filename or "input_a.pdb"
        original_filename_b = pdb_b.filename or "input_b.pdb"
        source_mode = "upload"

    meta = {
        "job_id": job_id,
        "status": "created",
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "started_at": None,
        "finished_at": None,
        "cleanup_at": None,
        "source_mode": source_mode,
        "inputs": {
            "original_filename_a": original_filename_a,
            "original_filename_b": original_filename_b,
            "chain_a": chain_a,
            "chain_b": chain_b,
            "dcut": dcut,
            "method": method,
            "max_domains": max_domains,
            "n_domains": n_domains,
            "postprocess": postprocess,
        },
        "files": {
            "input_a": str(input_a_path.relative_to(API_ROOT)),
            "input_b": str(input_b_path.relative_to(API_ROOT)),
            "meta": str(get_meta_path(job_id).relative_to(API_ROOT)),
            "result": str(get_result_path(job_id).relative_to(API_ROOT)),
        },
        "result_exists": False,
        "error": None,
    }

    write_json(get_meta_path(job_id), meta)

    return {
        "message": "Job created successfully.",
        "job_id": job_id,
        "status": "created",
        "job_url": f"/v1/jobs/{job_id}",
        "run_url": f"/v1/jobs/{job_id}/run",
        "result_url": f"/v1/jobs/{job_id}/result",
        "source_mode": source_mode,
    }


@app.get("/v1/jobs/{job_id}")
def get_job(job_id: str):
    ensure_job_exists(job_id)
    return read_json(get_meta_path(job_id))


@app.post("/v1/jobs/{job_id}/run")
def run_job(job_id: str):
    ensure_job_exists(job_id)

    if not DAGR_SCRIPT.exists():
        raise HTTPException(
            status_code=500,
            detail=f"dagr_bit_align.py not found at: {DAGR_SCRIPT}",
        )

    meta = read_json(get_meta_path(job_id))
    status = meta.get("status")

    if status == "running":
        raise HTTPException(status_code=409, detail="Job is already running.")

    update_meta(
        job_id,
        status="running",
        started_at=now_iso(),
        error=None,
    )

    cmd = build_dagr_command(job_id, meta)

    try:
        completed = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(API_ROOT),
            timeout=MAX_RUN_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        stdout_text = exc.stdout or ""
        stderr_text = exc.stderr or ""
        stderr_text += f"\n[system] terminated after {MAX_RUN_SECONDS} seconds."

        get_stdout_path(job_id).write_text(stdout_text, encoding="utf-8")
        get_stderr_path(job_id).write_text(stderr_text, encoding="utf-8")

        update_meta(
            job_id,
            status="timeout",
            finished_at=now_iso(),
            cleanup_at=(now_utc() + timedelta(seconds=RESULT_TTL_SECONDS)).isoformat(),
            result_exists=False,
            error=f"Execution exceeded {MAX_RUN_SECONDS} seconds and was terminated.",
            command=cmd,
            returncode=None,
        )

        raise HTTPException(
            status_code=408,
            detail=(
                "실행 시간이 1분을 초과하여 분석이 자동 중단되었습니다. "
                "exact 대신 iterative를 사용해보거나, 파라미터를 조정한 뒤 다시 시도해주세요."
            ),
        )

    get_stdout_path(job_id).write_text(completed.stdout or "", encoding="utf-8")
    get_stderr_path(job_id).write_text(completed.stderr or "", encoding="utf-8")

    if completed.returncode != 0:
        stderr_text = (completed.stderr or "").strip()
        friendly_error = summarize_dagr_error(
            stderr_text,
            meta["inputs"]["method"],
        )

        update_meta(
            job_id,
            status="failed",
            finished_at=now_iso(),
            cleanup_at=(now_utc() + timedelta(seconds=RESULT_TTL_SECONDS)).isoformat(),
            result_exists=False,
            error=friendly_error,
            raw_stderr_tail=stderr_text[-4000:] if stderr_text else "",
            command=cmd,
            returncode=completed.returncode,
        )

        raise HTTPException(
            status_code=400,
            detail=friendly_error,
        )

    rpath = get_result_path(job_id)
    if not rpath.exists():
        update_meta(
            job_id,
            status="failed",
            finished_at=now_iso(),
            cleanup_at=(now_utc() + timedelta(seconds=RESULT_TTL_SECONDS)).isoformat(),
            result_exists=False,
            error="Process finished successfully, but result.json was not created.",
            command=cmd,
            returncode=completed.returncode,
        )

        raise HTTPException(
            status_code=500,
            detail="Process finished, but result.json was not created.",
        )

    try:
        result = read_json(rpath)
    except Exception as e:
        update_meta(
            job_id,
            status="failed",
            finished_at=now_iso(),
            cleanup_at=(now_utc() + timedelta(seconds=RESULT_TTL_SECONDS)).isoformat(),
            result_exists=False,
            error=f"result.json exists but could not be parsed: {str(e)}",
            command=cmd,
            returncode=completed.returncode,
        )

        raise HTTPException(
            status_code=500,
            detail=f"result.json could not be parsed: {str(e)}",
        )

    summary = extract_result_summary(result)

    update_meta(
        job_id,
        status="completed",
        finished_at=now_iso(),
        result_exists=True,
        error=None,
        command=cmd,
        returncode=completed.returncode,
        result_summary=summary,
    )

    return {
        "message": "DAGR execution completed successfully.",
        "job_id": job_id,
        "status": "completed",
        "result_url": f"/v1/jobs/{job_id}/result",
        "summary": summary,
    }


@app.get("/v1/jobs/{job_id}/result")
def get_result(job_id: str):
    ensure_job_exists(job_id)
    rpath = get_result_path(job_id)

    if not rpath.exists():
        raise HTTPException(status_code=404, detail="Result not found. Run the job first.")

    schedule_cleanup_if_needed(job_id)
    return read_json(rpath)


@app.get("/v1/jobs/{job_id}/input/{which}", response_class=PlainTextResponse)
def get_job_input(job_id: str, which: str):
    ensure_job_exists(job_id)

    if which not in {"a", "b"}:
        raise HTTPException(status_code=404, detail="Input not found.")

    path = get_job_dir(job_id) / f"input_{which}.pdb"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Input file not found.")

    return path.read_text(encoding="utf-8", errors="ignore")