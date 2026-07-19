# GMR Static Project Host

This repo contains a static tube thickness viewer plus a lightweight FastAPI host for multiple projects.

## Project Layout

Each hosted project lives under `projects/`:

```text
projects/
  P_11111111111111/
    Inspection-001.xlsx
    image-or-video-files.ext
```

All Excel, drawing, image, and video files should be placed directly inside the project's `/` folder.
The shared React viewer is built from `frontend/` and opened with `/?project={project_id}`.
Project files and media are served from `/p/{project_id}/{file}`.

## Run

```powershell
cd frontend
pnpm install
pnpm run build
cd ..
uv venv
uv sync
uv run uvicorn server:app --host 0.0.0.0 --port 8127 --reload
```

Open:

```text
http://127.0.0.1:8127/
http://127.0.0.1:8127/?project=P_11111111111111
http://127.0.0.1:8127/ircengg
```

The `/ircengg` route is a simple no-auth admin page for listing projects and uploading a new project ZIP with client/project details.

## Docker

Build and run directly:

```powershell
docker build -t gmr-project-host .
docker run --name gmr-project-host -p 8127:8127 -v ${PWD}/projects:/app/projects -v ${PWD}/config.json:/app/config.json:ro gmr-project-host
```

Or run with Compose:

```powershell
docker compose up -d --build
```

Uploaded projects are stored in `./projects` on the host through the Docker volume mount.

For remote Docker servers, `./projects` means the folder on that remote host beside `docker-compose.yml`.
Keep that folder backed up or bind it to the host path where project data should permanently live. The image
does not bake project files into the container.
