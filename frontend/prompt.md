Here's a comprehensive Codex prompt you can use. It is written as a product specification with clear technical requirements so Codex can generate a clean project instead of overengineering it.

---

# Codex Prompt

You are a senior React + Javascript engineer.

Build a production-quality React application for visualizing boiler waterwall ultrasonic thickness (AUT) inspection data.

## Tech Stack

Use only the following:

- React 19
- Vite
- Javascript
- Mantine UI
- Jotai (state management)
- React Konva (2D canvas rendering)
- xlsx (SheetJS) for Excel parsing

Do NOT use Redux, Zustand, MobX, D3, Recharts or any heavy architecture.

Keep the project simple.

Project structure should only be:

```
src/
    pages/
    components/
    state/
    utils/
```

No feature folders.
No complicated architecture.

---

# Application Goal

The application visualizes corrosion mapping (wall tube thickness mapping) of power plant boiler waterwalls.

Each inspection comes as an Excel file.

Multiple inspection files can be loaded and compared.

Each file contains

all excel files will be placed in data folder and named like "data\Inspection_15_01_2025.xlsx"

```
Details
FrontWall
RearWall
LeftSideWall
RightSideWall
```

---

# Excel Structure

## Details sheet

Contains key-value pairs like

```
Inspection Details      AUT of Waterwall at GMR
Inspection Date         15-01-2025

Front Wall Tube Diameter     45
Front Wall Tube Length       50000
Front Wall Tube Pitch        80
Front Wall Tube Count        100

Rear Wall Tube Diameter      45
Rear Wall Tube Length        50000
Rear Wall Tube Pitch         80
Rear Wall Tube Count         100

...
```

Parse this into

```
Inspection

{
    id,
    inspectionDate,
    inspectionName,

    walls: {

        FrontWall:{
            tubeDiameter,
            tubeLength,
            tubePitch,
            tubeCount
        }

        RearWall...

    }

}
```

---

## Wall sheets

Example

```
Elevation(mm)/Tube No

        1     2     3     4

0       4.5   3.7   3.0   2.8

50      4.6   3.6   3.2   2.7

100     4.4   3.5   3.1   2.9
```

Meaning

Rows

= elevations

Columns

= tube numbers

Each cell

= measured thickness

Store internally as

```
WallData

tubeCount

elevations[]

matrix[][]

matrix[elevationIndex][tubeIndex]
```

---

# UI Layout

Use Mantine AppShell.

Layout

```
------------------------------------------
Sidebar

    Upload Excel

    Inspection

        Inspection 1

        Inspection 2

    ----------------

    Front Wall

    Rear Wall

    Left Side Wall

    Right Side Wall

------------------------------------------

Main Canvas

------------------------------------------

Bottom status bar

Mouse position

Tube

Elevation

Thickness
```

---

# Navigation

Selecting

Front Wall

should display

Front Wall visualization

Selecting Rear Wall

should display

Rear Wall visualization

Changing inspection changes displayed dataset.

---

# Canvas

Use

React Konva

NOT SVG.

Reason

Performance for very large tube counts.

Canvas should support

- Pan

- Zoom

- Mouse wheel zoom

- Reset View

- Resize with window

---

# Visualization

Each tube is drawn vertically.

The spacing between tubes comes from

Tube Pitch

Tube Count

Tube Diameter

from Details sheet.

Height comes from

Tube Length.

Do NOT draw to actual millimeter scale.

Automatically fit to viewport while maintaining proportions.

---

Each tube consists of many colored segments.

Each segment represents one elevation row.

Example

```
Tube 1

████

████

████

████

```

Each rectangle color corresponds to thickness.

---

# Heatmap

Use continuous interpolation.

Default colors

Low thickness

Red

↓

Orange

↓

Yellow

↓

Green

↓

Blue

High thickness

The color scale should automatically use

dataset min

dataset max

unless user specifies fixed limits later.

Create utility

```
getThicknessColor(value,min,max)
```

---

# Mouse Interaction

Hover segment

Show tooltip

```
Tube

Elevation

Thickness

Inspection

Wall
```

---

Click

Highlight segment

---

# Performance

Assume

100 tubes

×

1000 elevations

=

100,000 cells

Rendering must stay smooth.

Requirements

React Konva

Memoization

useMemo

Only redraw when needed.

Avoid unnecessary React renders.

No rendering every cell as React DOM.

Draw using Konva Rects.

---

# Inspection Management

User can upload multiple Excel files.

Maintain

```
inspections[]

```

Each inspection has

```
date

name

parsed data

```

Sidebar inspection selector.

---

# Future Comparison Support

Design data model so future comparison is easy.

Example

```
Inspection A

Inspection B

Inspection C
```

Comparison is NOT required now.

Only architecture support.

---

# State Management

Use Jotai only.

Atoms

```
inspectionsAtom

selectedInspectionAtom

selectedWallAtom

zoomAtom

panAtom

hoverCellAtom
```

Nothing else unless necessary.

---

# Components

Keep components small.

Example

```
pages/

HomePage.tsx

components/

Sidebar.tsx

WallCanvas.tsx

HeatmapLayer.tsx

TubeLayer.tsx

Tooltip.tsx

TopToolbar.tsx

UploadButton.tsx

state/

inspectionAtoms.ts

utils/

excelParser.ts

heatmap.ts

fitView.ts

types/

inspection.ts
```

---

# Excel Parser

Use SheetJS.

Create parser

```
parseInspection(file)

returns

Inspection
```

Parser should automatically detect

Details

FrontWall

RearWall

LeftSideWall

RightSideWall

Ignore unknown sheets.

---

# Toolbar

Above canvas

```
Zoom In

Zoom Out

Fit

Reset

```

---

# Responsive

Application should work from

1366×

768

up to

4K monitors.

Canvas always fills available space.

---

# Styling

Mantine default theme.

Minimal professional UI.

Dark mode support.

---

# Code Quality

Use

JSX/Javascript everywhere.

No any.

Proper interfaces.

No overengineering.

No unnecessary abstractions.

No complex hooks.

Readable code.

---

# Deliverables

Generate the complete application including

- all components

- all pages

- state

- parser

- types

- utilities

- Konva rendering

- upload functionality

- inspection switching

- wall switching

- responsive layout

The generated project should run immediately after

```
npm install

npm run dev
```

without additional modifications.

---

### Additional recommendation

I'd also instruct Codex to **draw only the visible area** rather than all cells once the dataset grows (e.g., 100 tubes × 5000 elevations = 500,000 rectangles). Adding this to the prompt helps future-proof performance:

> Implement viewport virtualization for the Konva canvas. Based on the current zoom and pan, only render tube segments that are visible within the viewport (plus a small buffer). This ensures smooth interaction even with datasets containing several hundred thousand measurement cells.
