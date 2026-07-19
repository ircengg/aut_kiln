export function getProjectIdFromLocation() {
  const queryProject = new URLSearchParams(window.location.search).get('project');
  if (queryProject) return queryProject;

  const match = window.location.pathname.match(/^\/p\/([^/]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return null;
}

export function getApiBaseUrl() {
  const { hostname, port } = window.location;
  const isViteDev = ['5173', '5174', '5175'].includes(port);

  if (isViteDev && (hostname === 'localhost' || hostname === '127.0.0.1')) {
    return 'http://127.0.0.1:8127';
  }

  return '';
}

export async function resolveProjectId() {
  const projectId = getProjectIdFromLocation();
  if (projectId) return projectId;

  throw new Error('No project selected. Open the viewer with ?project=<project_id>.');
}

export function getProjectFileUrl(filePath, projectId = getProjectIdFromLocation()) {
  if (!filePath) return '';
  if (/^(https?:)?\/\//i.test(filePath) || filePath.startsWith('/')) return filePath;
  if (!projectId) return filePath;

  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  return `${getApiBaseUrl()}/p/${encodeURIComponent(projectId)}/${encodedPath}`;
}
