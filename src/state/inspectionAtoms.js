import { atom } from "jotai";

export const WALLS = ["FrontWall", "RearWall", "LeftSideWall", "RightSideWall"];

export const WALL_LABELS = {
  FrontWall: "Front Wall",
  RearWall: "Rear Wall",
  LeftSideWall: "Left Side Wall",
  RightSideWall: "Right Side Wall",
};

export const inspectionsAtom = atom([]);
export const selectedInspectionAtom = atom(null);
export const selectedWallAtom = atom("FrontWall");
export const zoomAtom = atom(1);
export const panAtom = atom({ x: 0, y: 0 });
export const hoverCellAtom = atom(null);
export const selectedCellAtom = atom(null);
export const colorRangeAtom = atom({ min: null, max: null });
export const displayModeAtom = atom("wallLoss");
export const appViewAtom = atom("welcome");
export const soundEnabledAtom = atom(true);
