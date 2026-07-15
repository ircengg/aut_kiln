import { parseInspection } from './excelParser';

const workbookModules = import.meta.glob('../../data/*.xlsx', {
  eager: true,
  import: 'default',
  query: '?url',
});

const getFileName = (path) => path.split('/').pop();

export const dataWorkbookSources = Object.entries(workbookModules).map(([path, url]) => ({
  id: path,
  name: getFileName(path),
  url,
}));

export async function loadDataInspections() {
  return Promise.all(dataWorkbookSources.map(parseInspection));
}
