import { parseInspection } from './excelParser';
import { getApiBaseUrl, resolveProjectId } from './projectContext';

export async function loadDataInspections() {
  const projectId = await resolveProjectId();

  const response = await fetch(`${getApiBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/files`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Project "${projectId}" was not found.`);
    }
    throw new Error(`Unable to load project files for "${projectId}".`);
  }

  const payload = await response.json();
  const workbookSources = (payload.files || [])
    .filter((file) => file.type === 'workbook' || /\.xlsx?$/i.test(file.name))
    .map((file) => ({
      id: `${projectId}:${file.path}`,
      name: file.name,
      projectId,
      path: file.path,
      url: `${getApiBaseUrl()}${file.url}`,
    }));

  if (!workbookSources.length) {
    throw new Error(`Project "${projectId}" has no Excel workbook files.`);
  }

  return Promise.all(workbookSources.map(parseInspection));
}
