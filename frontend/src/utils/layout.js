export function isHorizontalLayout(layout) {
  return String(layout || '').trim().toLowerCase() === 'horizontal';
}

export function getLayoutOrientation(sectionData) {
  return isHorizontalLayout(sectionData?.layout) ? 'horizontal' : 'vertical';
}
