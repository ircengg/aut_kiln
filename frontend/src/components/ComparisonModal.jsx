import {
  Badge,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { getSectionDataForCoil } from "../utils/excelParser";
import { getDisplayValue, formatMeasurement } from "../utils/measurements";

const CHART_WIDTH = 760;
const CHART_HEIGHT = 150;
const CHART_PADDING = 42;

function parseDateValue(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);

  if (match) {
    const [, day, month, year] = match;
    const fullYear = Number(year.length === 2 ? `20${year}` : year);
    return new Date(fullYear, Number(month) - 1, Number(day)).getTime();
  }

  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getTubeDataIndex(sectionData, tubeNumber) {
  const tubeNumbers = sectionData?.tubeNumbers?.length
    ? sectionData.tubeNumbers
    : Array.from(
        { length: sectionData?.dataTubeCount || sectionData?.tubeCount || 0 },
        (_, index) => index + 1,
      );

  return tubeNumbers.findIndex((tube) => Number(tube) === Number(tubeNumber));
}

function summarizeValues(values, nominal) {
  if (!values.length) return null;

  const thicknessValues = values.map((item) => item.thickness);
  const wallLossValues = thicknessValues
    .map((value) => getDisplayValue(value, "wallLoss", nominal))
    .filter(Number.isFinite);
  const totalThickness = thicknessValues.reduce((sum, value) => sum + value, 0);

  return {
    count: values.length,
    minThickness: Math.min(...thicknessValues),
    maxThickness: Math.max(...thicknessValues),
    avgThickness: totalThickness / values.length,
    maxWallLoss: wallLossValues.length ? Math.max(...wallLossValues) : null,
    avgWallLoss: wallLossValues.length
      ? wallLossValues.reduce((sum, value) => sum + value, 0) /
        wallLossValues.length
      : null,
  };
}

function buildComparisonRows(inspections, selection, selectedCoil, windowSize) {
  if (!selection) return [];

  return inspections
    .map((inspection) => {
      const rawSectionData = inspection.wallData?.[selection.wall];
      const sectionData = getSectionDataForCoil(rawSectionData, selectedCoil);
      const dataTubeIndex = getTubeDataIndex(sectionData, selection.tube);
      const dataTubeCount =
        sectionData?.dataTubeCount ||
        sectionData?.tubeNumbers?.length ||
        sectionData?.tubeCount ||
        0;

      if (!sectionData?.values?.length || dataTubeIndex < 0 || !dataTubeCount) {
        return null;
      }

      const values = sectionData.elevations
        .map((elevation, rowIndex) => {
          if (Math.abs(elevation - selection.elevation) > windowSize)
            return null;

          const thickness =
            sectionData.values[rowIndex * dataTubeCount + dataTubeIndex];
          if (!Number.isFinite(thickness)) return null;

          return { elevation, thickness };
        })
        .filter(Boolean);
      const summary = summarizeValues(values, sectionData.tubeNominal);

      if (!summary) return null;

      return {
        id: inspection.id,
        name: inspection.inspectionName || inspection.fileName || "Inspection",
        date: inspection.inspectionDate || "",
        dateValue: parseDateValue(inspection.inspectionDate),
        sourceFile: inspection.fileName,
        ...summary,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.dateValue !== null && b.dateValue !== null)
        return a.dateValue - b.dateValue;
      if (a.dateValue !== null) return -1;
      if (b.dateValue !== null) return 1;
      return a.name.localeCompare(b.name);
    });
}

function getChartPoint(row, index, rows, minY, maxY, key) {
  const usableWidth = CHART_WIDTH - CHART_PADDING * 2;
  const usableHeight = CHART_HEIGHT - CHART_PADDING * 2;
  const x =
    rows.length === 1
      ? CHART_WIDTH / 2
      : CHART_PADDING + (index / (rows.length - 1)) * usableWidth;
  const y =
    CHART_HEIGHT -
    CHART_PADDING -
    ((row[key] - minY) / Math.max(maxY - minY, 0.001)) * usableHeight;

  return { x, y };
}

function ComparisonChart({ rows }) {
  const values = rows
    .flatMap((row) => [row.minThickness, row.avgThickness])
    .filter(Number.isFinite);

  if (rows.length === 0 || values.length === 0) {
    return (
      <Paper className="comparison-empty-chart" withBorder>
        <Text c="dimmed">
          Select a mapped reading to compare inspection trends.
        </Text>
      </Paper>
    );
  }

  const minY = Math.min(...values) - 0.2;
  const maxY = Math.max(...values) + 0.2;
  const avgPoints = rows.map((row, index) =>
    getChartPoint(row, index, rows, minY, maxY, "avgThickness"),
  );
  const minPoints = rows.map((row, index) =>
    getChartPoint(row, index, rows, minY, maxY, "minThickness"),
  );
  const toPoints = (points) =>
    points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="comparison-chart-wrap">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="comparison-chart"
        role="img"
      >
        <line
          x1={CHART_PADDING}
          y1={CHART_PADDING}
          x2={CHART_PADDING}
          y2={CHART_HEIGHT - CHART_PADDING}
        />
        <line
          x1={CHART_PADDING}
          y1={CHART_HEIGHT - CHART_PADDING}
          x2={CHART_WIDTH - CHART_PADDING}
          y2={CHART_HEIGHT - CHART_PADDING}
        />
        {[0, 0.5, 1].map((tick) => {
          const y = CHART_PADDING + tick * (CHART_HEIGHT - CHART_PADDING * 2);
          const value = maxY - tick * (maxY - minY);

          return (
            <g key={tick}>
              <line
                className="chart-grid-line"
                x1={CHART_PADDING}
                y1={y}
                x2={CHART_WIDTH - CHART_PADDING}
                y2={y}
              />
              <text x={8} y={y + 4}>
                {value.toFixed(2)}
              </text>
            </g>
          );
        })}
        <polyline
          className="chart-line chart-line-avg"
          points={toPoints(avgPoints)}
        />
        <polyline
          className="chart-line chart-line-min"
          points={toPoints(minPoints)}
        />
        {rows.map((row, index) => {
          const avg = avgPoints[index];
          const min = minPoints[index];

          return (
            <g key={row.id}>
              <circle
                className="chart-point chart-point-avg"
                cx={avg.x}
                cy={avg.y}
                r="5"
              />
              <circle
                className="chart-point chart-point-min"
                cx={min.x}
                cy={min.y}
                r="5"
              />
              <text className="chart-x-label" x={avg.x} y={CHART_HEIGHT - 12}>
                {row.date || `#${index + 1}`}
              </text>
            </g>
          );
        })}
      </svg>
      <Group gap="md" className="comparison-legend">
        <span>
          <i className="legend-line avg" /> Average thickness
        </span>
        <span>
          <i className="legend-line min" /> Minimum thickness
        </span>
      </Group>
    </div>
  );
}

function ComparisonModal({
  opened,
  onClose,
  inspections = [],
  selectedCell,
  selectedCoil,
  sectionName,
  lengthLabel = "Elevation",
}) {
  const [windowSize, setWindowSize] = useState(250);
  const rows = useMemo(
    () =>
      buildComparisonRows(inspections, selectedCell, selectedCoil, windowSize),
    [inspections, selectedCell, selectedCoil, windowSize],
  );
  const bestRow = rows.reduce(
    (current, row) =>
      !current || row.maxWallLoss > current.maxWallLoss ? row : current,
    null,
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="98vw"
      title={
        <Group gap="xs" className="comparison-title">
          <span className="comparison-title-icon">T</span>
          <Title order={3}>Thickness Comparison</Title>
          <Badge variant="light" className="section-badge">
            {sectionName}
          </Badge>
        </Group>
      }
      classNames={{
        content: "comparison-modal",
        body: "comparison-modal-body",
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <div>
            <Text size="xs" tt="uppercase" fw={800} className="signal-text">
              Selected area
            </Text>
            <Title order={4}>
              {selectedCell
                ? `Tube ${selectedCell.tube} at ${Math.round(selectedCell.elevation)} mm`
                : "No reading selected"}
            </Title>
            <Text size="sm" c="dimmed">
              {selectedCell
                ? `${lengthLabel} window +/- ${windowSize} mm across ${rows.length} inspection${rows.length === 1 ? "" : "s"}`
                : "Click a tube reading in the viewer first, then open comparison."}
            </Text>
          </div>
          <NumberInput
            label={`${lengthLabel} window +/- mm`}
            value={windowSize}
            min={0}
            max={5000}
            step={50}
            w={190}
            onChange={(value) => setWindowSize(Number(value) || 0)}
          />
        </Group>

        <div className="comparison-grid">
          <Paper className="comparison-chart-panel" withBorder>
            <ComparisonChart rows={rows} />
          </Paper>

          <div className="comparison-kpis">
            <Paper className="comparison-kpi" withBorder>
              <Text size="xs" c="dimmed">
                Compared
              </Text>
              <Title order={2}>{rows.length}</Title>
            </Paper>
            <Paper className="comparison-kpi" withBorder>
              <Text size="xs" c="dimmed">
                Highest loss
              </Text>
              <Title order={2}>
                {Number.isFinite(bestRow?.maxWallLoss)
                  ? `${bestRow.maxWallLoss.toFixed(1)}%`
                  : "ND"}
              </Title>
            </Paper>
            <Paper className="comparison-kpi" withBorder>
              <Text size="xs" c="dimmed">
                Lowest thickness
              </Text>
              <Title order={2}>
                {Number.isFinite(bestRow?.minThickness)
                  ? formatMeasurement(bestRow.minThickness, "thickness")
                  : "ND"}
              </Title>
            </Paper>
          </div>
        </div>

        <ScrollArea className="comparison-table-scroll" offsetScrollbars>
          <Table className="comparison-table" striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Inspection</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Readings</Table.Th>
                <Table.Th>Min Thickness</Table.Th>
                <Table.Th>Avg Thickness</Table.Th>
                <Table.Th>Max Thickness</Table.Th>
                <Table.Th>Avg Loss</Table.Th>
                <Table.Th>Max Loss</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.length ? (
                rows.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>{row.name}</Table.Td>
                    <Table.Td>{row.date || "-"}</Table.Td>
                    <Table.Td>{row.count}</Table.Td>
                    <Table.Td>
                      {formatMeasurement(row.minThickness, "thickness")}
                    </Table.Td>
                    <Table.Td>
                      {formatMeasurement(row.avgThickness, "thickness")}
                    </Table.Td>
                    <Table.Td>
                      {formatMeasurement(row.maxThickness, "thickness")}
                    </Table.Td>
                    <Table.Td>
                      {Number.isFinite(row.avgWallLoss)
                        ? `${row.avgWallLoss.toFixed(2)}%`
                        : "ND"}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          row.maxWallLoss > 20
                            ? "red"
                            : row.maxWallLoss > 10
                              ? "yellow"
                              : "green"
                        }
                        variant="filled"
                      >
                        {Number.isFinite(row.maxWallLoss)
                          ? `${row.maxWallLoss.toFixed(2)}%`
                          : "ND"}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text c="dimmed" ta="center" py="md">
                      No matching readings found in other inspections.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Stack>
    </Modal>
  );
}

export default ComparisonModal;
