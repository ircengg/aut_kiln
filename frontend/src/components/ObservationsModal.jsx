import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { getProjectFileUrl } from "../utils/projectContext";

function getMediaUrl(fileName) {
  if (!fileName) return "";
  return getProjectFileUrl(fileName);
}

function getObservationMedia(observation) {
  return [
    ...(observation?.images || []).map((src) => ({ type: "image", src })),
    ...(observation?.videos || []).map((src) => ({ type: "video", src })),
  ];
}

function ObservationsModal({
  opened,
  onClose,
  observations = [],
  sectionName,
}) {
  const firstCriticalIndex = observations.findIndex((item) => item.isCritical);
  const criticalCount = observations.filter((item) => item.isCritical).length;
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(firstCriticalIndex, 0),
  );
  const [mediaIndex, setMediaIndex] = useState(0);
  const selectedObservation =
    observations[selectedIndex] || observations[0] || null;
  const media = useMemo(
    () => getObservationMedia(selectedObservation),
    [selectedObservation],
  );
  const selectedMedia = media[mediaIndex] || null;

  useEffect(() => {
    if (opened) {
      setSelectedIndex(Math.max(firstCriticalIndex, 0));
      setMediaIndex(0);
    }
  }, [firstCriticalIndex, opened]);

  useEffect(() => {
    setMediaIndex(0);
  }, [selectedIndex]);

  const showNextMedia = () => {
    if (!media.length) return;
    setMediaIndex((value) => (value + 1) % media.length);
  };

  const showPreviousMedia = () => {
    if (!media.length) return;
    setMediaIndex((value) => (value <= 0 ? media.length - 1 : value - 1));
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="92vw"
      title={
        <Group gap="xs" className="observations-title">
          <span className="observations-title-icon">i</span>
          <Title order={3}>Inspection Observations</Title>
          <Badge variant="light" className="section-badge">{sectionName}</Badge>
          {criticalCount > 0 && (
            <Badge color="red" variant="filled" className="critical-badge title-critical-badge">
              ! {criticalCount} Critical
            </Badge>
          )}
        </Group>
      }
      classNames={{
        content: "observations-modal",
        body: "observations-modal-body",
      }}
    >
      <div className="observations-grid">
        <ScrollArea className="observations-list" offsetScrollbars>
          <Stack gap="xs">
            {observations.length === 0 ? (
              <Text c="dimmed">
                No summary observations found for this component.
              </Text>
            ) : (
              observations.map((observation, index) => (
                <Paper
                  key={observation.id}
                  className={`observation-card ${index === selectedIndex ? "is-active" : ""} ${observation.isCritical ? "is-critical" : ""}`}
                  withBorder
                  p="sm"
                  onClick={() => setSelectedIndex(index)}
                  style={{ "--item-index": index }}
                >
                  <Group
                    justify="space-between"
                    align="flex-start"
                    gap="xs"
                    wrap="nowrap"
                  >
                    <div>
                      <Text size="sm" fw={800}>
                        {observation.location}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={3}>
                        {observation.remarks || "No remarks."}
                      </Text>
                    </div>
                    {observation.isCritical && (
                      <Badge
                        color="red"
                        variant="filled"
                        className="critical-badge"
                      >
                        ! Critical
                      </Badge>
                    )}
                  </Group>
                </Paper>
              ))
            )}
          </Stack>
        </ScrollArea>

        <div className="observation-media-panel">
          {selectedObservation ? (
            <>
              <Group justify="space-between" align="flex-start" mb="sm">
                <div>
                  <Group gap="xs" mb={4}>
                    <Text
                      size="xs"
                      tt="uppercase"
                      fw={800}
                      className="signal-text"
                    >
                      {selectedObservation.isCritical
                        ? "Critical Observation"
                        : "Visual Observation"}
                    </Text>
                    {selectedObservation.isCritical && (
                      <Badge color="red" variant="filled" className="critical-badge">
                        ! Action Required
                      </Badge>
                    )}
                  </Group>
                  <Title order={4}>{selectedObservation.location}</Title>
                </div>
                <Group gap={4}>
                  <ActionIcon
                    variant="light"
                    disabled={media.length < 2}
                    onClick={showPreviousMedia}
                    aria-label="Previous media"
                  >
                    &lt;
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    disabled={media.length < 2}
                    onClick={showNextMedia}
                    aria-label="Next media"
                  >
                    &gt;
                  </ActionIcon>
                </Group>
              </Group>

              <div className="media-stage" key={`${selectedIndex}-${mediaIndex}`}>
                {!selectedMedia ? (
                  <Text c="dimmed">No images or videos attached.</Text>
                ) : selectedMedia.type === "video" ? (
                  <video
                    key={selectedMedia.src}
                    src={getMediaUrl(selectedMedia.src)}
                    controls
                    autoPlay
                    muted
                    className="observation-video"
                  />
                ) : (
                  <img
                    src={getMediaUrl(selectedMedia.src)}
                    alt={selectedObservation.location}
                    className="observation-image"
                  />
                )}
              </div>

              {media.length > 0 && (
                <Group justify="center" gap={6} mt="xs">
                  {media.map((item, index) => (
                    <button
                      type="button"
                      key={`${item.type}-${item.src}`}
                      className={`media-dot ${index === mediaIndex ? "is-active" : ""}`}
                      aria-label={`Show ${item.type} ${index + 1}`}
                      onClick={() => setMediaIndex(index)}
                    />
                  ))}
                </Group>
              )}

              <Text mt="md" size="sm" className="observation-remarks">
                {selectedObservation.remarks || "No remarks."}
              </Text>
            </>
          ) : (
            <Stack align="center" justify="center" h="100%">
              <Text c="dimmed">No observations available.</Text>
              <Button variant="light" onClick={onClose}>
                Close
              </Button>
            </Stack>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default ObservationsModal;
