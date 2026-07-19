from pathlib import Path
from html import escape
import json
import re
import secrets
import shutil
import zipfile
from urllib.parse import quote

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse


BASE_DIR = Path(__file__).resolve().parent
CONFIG_FILE = BASE_DIR / "config.json"


def load_config() -> dict[str, object]:
    defaults = {
        "admin_email": "admin@ircengineering.com",
        "admin_password": "admin123",
        "port": 8127,
        "projects_dir": "projects",
        "frontend_dist": "frontend/dist",
    }
    if not CONFIG_FILE.is_file():
        return defaults
    try:
        return {**defaults, **json.loads(CONFIG_FILE.read_text(encoding="utf-8"))}
    except json.JSONDecodeError:
        return defaults


CONFIG = load_config()
PROJECTS_DIR = (BASE_DIR / str(CONFIG["projects_dir"])).resolve()
FRONTEND_DIST = (BASE_DIR / str(CONFIG["frontend_dist"])).resolve()
FRONTEND_PUBLIC = BASE_DIR / "frontend" / "public"
PROJECT_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")

app = FastAPI(title="GMR Static Project Host")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


def require_admin(
    x_admin_email: str | None = Header(default=None),
    x_admin_password: str | None = Header(default=None),
) -> None:
    if x_admin_email != CONFIG["admin_email"] or x_admin_password != CONFIG["admin_password"]:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")


def project_url(project_id: str) -> str:
    return f"/p/{project_id}/"


def metadata_file(project_id: str) -> Path:
    return project_dir(project_id) / "project.json"


def read_metadata(project_id: str) -> dict[str, str]:
    path = metadata_file(project_id)
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def write_metadata(project_id: str, metadata: dict[str, str]) -> None:
    metadata_file(project_id).write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def project_dir(project_id: str) -> Path:
    if not PROJECT_ID_RE.fullmatch(project_id):
        raise HTTPException(status_code=404, detail="Project not found")

    root = (PROJECTS_DIR / project_id).resolve()
    if not root.is_dir() or PROJECTS_DIR.resolve() not in root.parents:
        raise HTTPException(status_code=404, detail="Project not found")
    return root


def project_file(project_id: str, relative_path: str) -> Path:
    root = project_dir(project_id)
    target = (root / relative_path).resolve()

    if root != target and root not in target.parents:
        raise HTTPException(status_code=404, detail="File not found")
    if target.is_dir():
        target = target / "index.html"
    if not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return target


def frontend_file(relative_path: str) -> Path:
    target = (FRONTEND_DIST / relative_path).resolve()

    if FRONTEND_DIST.resolve() != target and FRONTEND_DIST.resolve() not in target.parents:
        raise HTTPException(status_code=404, detail="File not found")
    if target.is_file():
        return target

    public_target = (FRONTEND_PUBLIC / relative_path).resolve()
    if FRONTEND_PUBLIC.resolve() != public_target and FRONTEND_PUBLIC.resolve() not in public_target.parents:
        raise HTTPException(status_code=404, detail="File not found")
    if public_target.is_file():
        return public_target

    raise HTTPException(status_code=404, detail="Viewer build not found")


def list_project_files(project_id: str) -> list[dict[str, str]]:
    root = project_dir(project_id)
    files = []

    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.name == "project.json" or path.name.startswith("_"):
            continue

        relative_path = path.relative_to(root).as_posix()
        suffix = path.suffix.lower()
        if suffix in {".xlsx", ".xls"}:
            file_type = "workbook"
        elif suffix in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".mov", ".webm"}:
            file_type = "media"
        else:
            file_type = "file"

        files.append(
            {
                "name": path.name,
                "path": relative_path,
                "type": file_type,
                "url": f"/p/{project_id}/{quote(relative_path, safe='/')}",
            }
        )

    return files


def list_project_cards() -> list[dict[str, str]]:
    PROJECTS_DIR.mkdir(exist_ok=True)
    cards = []
    for path in sorted(PROJECTS_DIR.iterdir()):
        if not path.is_dir():
            continue

        metadata = read_metadata(path.name)
        cards.append(
            {
                "id": path.name,
                "client_name": metadata.get("client_name", ""),
                "project_name": metadata.get("project_name", ""),
                "project_details": metadata.get("project_details", ""),
                "url": project_url(path.name),
            }
        )
    return cards


def new_project_id() -> str:
    PROJECTS_DIR.mkdir(exist_ok=True)
    while True:
        project_id = secrets.token_hex(16)
        if not (PROJECTS_DIR / project_id).exists():
            return project_id


def safe_extract_zip(zip_path: Path, target_dir: Path) -> None:
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            if member.is_dir():
                continue

            member_name = member.filename.replace("\\", "/")
            if not member_name or member_name.startswith("/") or ".." in Path(member_name).parts:
                raise HTTPException(status_code=400, detail="ZIP contains an unsafe path")

            destination = (target_dir / member_name).resolve()
            if target_dir.resolve() not in destination.parents:
                raise HTTPException(status_code=400, detail="ZIP contains an unsafe path")

            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member) as source, destination.open("wb") as output:
                shutil.copyfileobj(source, output)


def flatten_single_wrapping_folder(project_root: Path) -> None:
    if (project_root / "index.html").is_file():
        return

    children = [path for path in project_root.iterdir() if path.name != "project.json"]
    if len(children) != 1 or not children[0].is_dir():
        return

    wrapped_root = children[0]
    if not (wrapped_root / "index.html").is_file():
        return

    for item in wrapped_root.iterdir():
        shutil.move(str(item), str(project_root / item.name))
    wrapped_root.rmdir()


@app.get("/restricted-old", response_class=HTMLResponse)
def home() -> str:
    return """    
    <!doctype html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">

    <title>Access Restricted</title>

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">

    <style>
    html,body{
        height:100%;
    }

    body{
        margin:0;
        display:flex;
        justify-content:center;
        align-items:center;
        background:
            radial-gradient(circle at top,#1e3a8a 0%,#0f172a 45%,#020617 100%);
        font-family:Inter,Segoe UI,Arial,sans-serif;
    }

    .card{
        width:520px;
        max-width:90%;
        background:rgba(15,23,42,.75);
        backdrop-filter:blur(16px);
        border:1px solid rgba(255,255,255,.08);
        border-radius:20px;
        box-shadow:0 25px 60px rgba(0,0,0,.45);
    }

    .lock{
        width:90px;
        height:90px;
        margin:auto;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#ef4444;
        color:white;
        font-size:42px;
        box-shadow:0 0 40px rgba(239,68,68,.35);
    }

    .title{
        color:#fff;
        font-weight:700;
    }

    .subtitle{
        color:#cbd5e1;
        font-size:15px;
    }

    .btn-primary{
        background:#2563eb;
        border:none;
        border-radius:10px;
        padding:10px 22px;
    }

    .btn-primary:hover{
        background:#1d4ed8;
    }

    .footer{
        color:#64748b;
        font-size:13px;
    }
    </style>

    </head>

    <body>

    <div class="card p-5 text-center">

        <div class="lock mb-4">
            🔒
        </div>

        <h2 class="title mb-3">
            Access Restricted
        </h2>

        <p class="subtitle mb-4">
            This engineering inspection project is protected.
            <br><br>
            The URL is invalid, has expired, or you do not have permission to access this report.
        </p>       

        <hr class="border-secondary my-4">

        <div class="footer">
            IRC Engineering Project Host<br>
            Secure Project Viewer
        </div>

    </div>

    </body>
    </html>

    """


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def serve_root_app() -> FileResponse:
    return FileResponse(frontend_file("index.html"))


@app.get("/assets/{path:path}")
def serve_root_viewer_asset(path: str) -> FileResponse:
    return FileResponse(frontend_file(f"assets/{path}"))


@app.get("/admin")
def redirect_admin() -> RedirectResponse:
    return RedirectResponse(url="/admin/", status_code=307)


@app.get("/admin/")
def serve_admin_app() -> FileResponse:
    return FileResponse(frontend_file("index.html"))


@app.get("/admin/{path:path}")
def serve_admin_app_asset(path: str) -> FileResponse:
    try:
        return FileResponse(frontend_file(path))
    except HTTPException:
        return FileResponse(frontend_file("index.html"))


@app.get("/projects")
def list_projects() -> dict[str, str]:
    return {"detail": "Project listing is available from /ircengg"}


@app.get("/api/projects")
def list_project_api() -> dict[str, list[dict[str, str]]]:
    return {"projects": list_project_cards()}


@app.get("/api/projects/{project_id}/files")
def list_project_files_api(project_id: str) -> dict[str, object]:
    project_dir(project_id)
    return {"project_id": project_id, "files": list_project_files(project_id)}


@app.get("/api/admin/projects")
def admin_list_projects(_admin: None = Depends(require_admin)) -> dict[str, list[dict[str, object]]]:
    projects = []
    for project in list_project_cards():
        files = list_project_files(project["id"])
        projects.append({**project, "files": files, "file_count": len(files)})
    return {"projects": projects}


@app.post("/api/admin/projects")
def admin_create_project(
    client_name: str = Form(""),
    project_name: str = Form(""),
    project_details: str = Form(""),
    _admin: None = Depends(require_admin),
) -> dict[str, str]:
    new_id = new_project_id()
    root = (PROJECTS_DIR / new_id).resolve()
    if root.exists():
        raise HTTPException(status_code=400, detail="Project already exists")
    root.mkdir(parents=True)
    write_metadata(
        new_id,
        {
            "id": new_id,
            "client_name": client_name.strip(),
            "project_name": project_name.strip(),
            "project_details": project_details.strip(),
        },
    )
    return {"id": new_id}


@app.put("/api/admin/projects/{project_id}")
def admin_update_project(
    project_id: str,
    client_name: str = Form(""),
    project_name: str = Form(""),
    project_details: str = Form(""),
    _admin: None = Depends(require_admin),
) -> dict[str, str]:
    project_dir(project_id)
    write_metadata(
        project_id,
        {
            "id": project_id,
            "client_name": client_name.strip(),
            "project_name": project_name.strip(),
            "project_details": project_details.strip(),
        },
    )
    return {"id": project_id}


@app.delete("/api/admin/projects/{project_id}")
def admin_delete_project(project_id: str, _admin: None = Depends(require_admin)) -> dict[str, str]:
    root = project_dir(project_id)
    shutil.rmtree(root)
    return {"id": project_id}


@app.get("/api/admin/projects/{project_id}/files")
def admin_list_files(project_id: str, _admin: None = Depends(require_admin)) -> dict[str, object]:
    return {"project_id": project_id, "files": list_project_files(project_id)}


@app.post("/api/admin/projects/{project_id}/files")
async def admin_upload_files(
    project_id: str,
    files: list[UploadFile] = File(...),
    path: str = Form(""),
    _admin: None = Depends(require_admin),
) -> dict[str, list[str]]:
    root = project_dir(project_id)
    base_path = path.strip()
    saved_paths = []
    extracted_paths = []

    if len(files) > 1 and base_path and Path(base_path).suffix:
        raise HTTPException(status_code=400, detail="Target path must be a folder when uploading multiple files")

    for upload in files:
        relative_path = str(Path(base_path) / upload.filename) if base_path and not Path(base_path).suffix else base_path or upload.filename
        if not relative_path:
            raise HTTPException(status_code=400, detail="Missing file path")

        target = (root / relative_path).resolve()
        if root != target and root not in target.parents:
            raise HTTPException(status_code=400, detail="Invalid file path")

        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("wb") as output:
            while chunk := await upload.read(1024 * 1024):
                output.write(chunk)

        saved_paths.append(target.relative_to(root).as_posix())

        if target.suffix.lower() == ".zip":
            before = {item.relative_to(root).as_posix() for item in root.rglob("*") if item.is_file()}
            safe_extract_zip(target, root)
            target.unlink(missing_ok=True)
            after = {item.relative_to(root).as_posix() for item in root.rglob("*") if item.is_file()}
            extracted_paths.extend(sorted(after - before))

    return {"saved": saved_paths, "extracted": extracted_paths}


@app.delete("/api/admin/projects/{project_id}/files/{path:path}")
def admin_delete_file(
    project_id: str,
    path: str,
    _admin: None = Depends(require_admin),
) -> dict[str, str]:
    target = project_file(project_id, path)
    if target.name == "project.json":
        raise HTTPException(status_code=400, detail="Cannot delete project metadata")
    target.unlink()
    return {"path": path}


@app.get("/ircengg")
def admin_alias() -> RedirectResponse:
    return RedirectResponse(url="/admin/", status_code=307)


@app.get("/ircengg-2026-2027")
def admin_legacy_alias() -> RedirectResponse:
    return RedirectResponse(url="/admin/", status_code=307)


@app.get("/ircengg-2026-2027", response_class=HTMLResponse)
def admin_page() -> str:
    projects = list_project_cards()
    rows = []
    for project in projects:
        rows.append(
            f"""
            <tr>
              <td><strong>{escape(project["project_name"] or project["id"])}</strong><span>{escape(project["id"])}</span></td>
              <td>{escape(project["client_name"] or "-")}</td>
              <td>{escape(project["project_details"] or "-")}</td>
              <td><a class="open-link" href="{project["url"]}" target="_blank">Open</a></td>
            </tr>
            """
        )

    project_rows = "\n".join(rows) or """
      <tr>
        <td colspan="4" class="empty">No projects uploaded yet.</td>
      </tr>
    """

    return f"""
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>IRC Engineering Admin</title>
        <style>
          * {{ box-sizing: border-box; }}
          body {{
            margin: 0;
            font-family: Arial, sans-serif;
            color: #e5e7eb;
            background: linear-gradient(135deg, #0f172a, #111827 48%, #18181b);
          }}
          main {{ width: min(1120px, calc(100% - 32px)); margin: 32px auto; }}
          header {{ display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 22px; }}
          h1 {{ margin: 0; font-size: 28px; }}
          .sub {{ margin-top: 6px; color: #94a3b8; }}
          .grid {{ display: grid; grid-template-columns: 380px 1fr; gap: 18px; align-items: start; }}
          section {{
            background: rgba(15, 23, 42, 0.9);
            border: 1px solid rgba(148, 163, 184, 0.28);
            border-radius: 12px;
            box-shadow: 0 18px 46px rgba(0, 0, 0, 0.3);
          }}
          form {{ display: grid; gap: 13px; padding: 18px; }}
          h2 {{ margin: 0 0 2px; font-size: 16px; }}
          label {{ display: grid; gap: 7px; color: #cbd5e1; font-size: 13px; font-weight: 700; }}
          input, textarea {{
            width: 100%;
            color: #f8fafc;
            background: #111827;
            border: 1px solid #475569;
            border-radius: 8px;
            padding: 10px 11px;
            outline: none;
          }}
          input:focus, textarea:focus {{ border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.18); }}
          textarea {{ min-height: 94px; resize: vertical; }}
          button {{
            height: 40px;
            color: #fff;
            font-weight: 800;
            background: #2563eb;
            border: 0;
            border-radius: 8px;
            cursor: pointer;
          }}
          button:hover {{ background: #1d4ed8; }}
          .table-wrap {{ overflow: auto; }}
          table {{ width: 100%; min-width: 620px; border-collapse: collapse; }}
          th, td {{ padding: 13px 14px; border-bottom: 1px solid rgba(148, 163, 184, 0.18); text-align: left; vertical-align: top; }}
          th {{ color: #93c5fd; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; background: rgba(30, 41, 59, 0.72); }}
          td span {{ display: block; margin-top: 4px; color: #94a3b8; font-size: 12px; }}
          .open-link {{ display: inline-flex; align-items: center; height: 32px; padding: 0 11px; color: #fff; background: #334155; border-radius: 8px; text-decoration: none; font-weight: 800; }}
          .open-link:hover {{ background: #475569; }}
          .empty {{ color: #94a3b8; text-align: center; }}
          @media (max-width: 860px) {{ .grid {{ grid-template-columns: 1fr; }} header {{ display: block; }} }}
        </style>
      </head>
      <body>
        <main>
          <header>
            <div>
              <h1>IRC Engineering Admin</h1>
              <div class="sub">Upload ZIP projects and open hosted viewers.</div>
            </div>
          </header>
          <div class="grid">
            <section>
              <form action="/ircengg/projects" method="post" enctype="multipart/form-data">
                <h2>New Project</h2>
                <label>
                  Client Name
                  <input name="client_name" required placeholder="GMR, KAMALANGA" />
                </label>
                <label>
                  Project Name
                  <input name="project_name" required placeholder="AUT 2ND PASS OF BOILER UNIT-2" />
                </label>
                <label>
                  Project Details
                  <textarea name="project_details" placeholder="Short notes about the inspection/project"></textarea>
                </label>
                <label>
                  Project ZIP
                  <input name="zip_file" type="file" accept=".zip,application/zip" required />
                </label>
                <button type="submit">Create Project</button>
              </form>
            </section>
            <section class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Client</th>
                    <th>Details</th>
                    <th>View</th>
                  </tr>
                </thead>
                <tbody>{project_rows}</tbody>
              </table>
            </section>
          </div>
        </main>
      </body>
    </html>
    """


@app.post("/ircengg/projects")
async def create_project(
    client_name: str = Form(...),
    project_name: str = Form(...),
    project_details: str = Form(""),
    zip_file: UploadFile = File(...),
) -> RedirectResponse:
    if not zip_file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Upload must be a ZIP file")

    project_id = new_project_id()
    root = PROJECTS_DIR / project_id
    root.mkdir(parents=True)

    zip_path = root / "_upload.zip"
    try:
      with zip_path.open("wb") as output:
          while chunk := await zip_file.read(1024 * 1024):
              output.write(chunk)

      safe_extract_zip(zip_path, root)
      zip_path.unlink(missing_ok=True)
      flatten_single_wrapping_folder(root)

      write_metadata(
          project_id,
          {
              "id": project_id,
              "client_name": client_name.strip(),
              "project_name": project_name.strip(),
              "project_details": project_details.strip(),
          },
      )
    except Exception:
        shutil.rmtree(root, ignore_errors=True)
        raise

    return RedirectResponse(url="/ircengg", status_code=303)


@app.get("/p/{project_id}")
def redirect_project_index(project_id: str) -> RedirectResponse:
    project_dir(project_id)
    return RedirectResponse(url=f"/?project={quote(project_id, safe='')}", status_code=307)


@app.get("/p/{project_id}/")
def redirect_project_viewer(project_id: str) -> RedirectResponse:
    project_dir(project_id)
    return RedirectResponse(url=f"/?project={quote(project_id, safe='')}", status_code=307)


@app.get("/p/{project_id}/assets/{path:path}")
def serve_project_viewer_asset(project_id: str, path: str) -> FileResponse:
    return FileResponse(project_file(project_id, f"assets/{path}"))


@app.get("/p/{project_id}/{path:path}")
def serve_project_asset(project_id: str, path: str) -> FileResponse:
    return FileResponse(project_file(project_id, path))


@app.get("/{path:path}")
def serve_frontend_static_or_app(path: str) -> FileResponse:
    try:
        return FileResponse(frontend_file(path))
    except HTTPException:
        return FileResponse(frontend_file("index.html"))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(CONFIG["port"]))
