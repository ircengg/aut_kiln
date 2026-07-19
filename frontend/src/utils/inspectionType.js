export function isSpotInspection(section) {
  return String(section?.inspectionType || '').trim().toLowerCase() === 'spot';
}

