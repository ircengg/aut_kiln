import {
  Badge,
  Button,
  FileInput,
  Group,
  Modal,
  Paper,
  PasswordInput,
  ScrollArea,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../utils/projectContext";

const emptyProject = {
  id: "",
  client_name: "",
  project_name: "",
  project_details: "",
};

function getStoredCredentials() {
  try {
    return JSON.parse(
      window.localStorage.getItem("irc_admin_credentials") || "{}",
    );
  } catch {
    return {};
  }
}

function Admin() {
  const [credentials, setCredentials] = useState(getStoredCredentials);
  const [loginDraft, setLoginDraft] = useState({
    email: credentials.email || "",
    password: credentials.password || "",
  });
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [projectDraft, setProjectDraft] = useState(emptyProject);
  const [uploadPath, setUploadPath] = useState("");
  const [uploadFiles, setUploadFiles] = useState([]);
  const [createOpened, setCreateOpened] = useState(false);
  const [createDraft, setCreateDraft] = useState(emptyProject);
  const [error, setError] = useState("");
  const apiBase = getApiBaseUrl();
  const isLoggedIn = Boolean(credentials.email && credentials.password);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId) || projects[0],
    [projects, selectedId],
  );

  const authHeaders = useMemo(
    () => ({
      "X-Admin-Email": credentials.email || "",
      "X-Admin-Password": credentials.password || "",
    }),
    [credentials.email, credentials.password],
  );

  const request = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${apiBase}${path}`, {
        ...options,
        headers: {
          ...authHeaders,
          ...(options.headers || {}),
        },
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || "Request failed");
      }

      return response.json();
    },
    [apiBase, authHeaders],
  );

  const loadProjects = useCallback(async () => {
    if (!isLoggedIn) return;
    setError("");
    try {
      const payload = await request("/api/admin/projects");
      setProjects(payload.projects || []);
      setSelectedId((current) => current || payload.projects?.[0]?.id || null);
    } catch (nextError) {
      setError(nextError.message);
    }
  }, [isLoggedIn, request]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (selectedProject) {
      setProjectDraft({
        id: selectedProject.id,
        client_name: selectedProject.client_name || "",
        project_name: selectedProject.project_name || "",
        project_details: selectedProject.project_details || "",
      });
    }
  }, [selectedProject]);

  const login = () => {
    const next = {
      email: loginDraft.email.trim(),
      password: loginDraft.password,
    };
    window.localStorage.setItem("irc_admin_credentials", JSON.stringify(next));
    setCredentials(next);
  };

  const logout = () => {
    window.localStorage.removeItem("irc_admin_credentials");
    setCredentials({});
    setProjects([]);
  };

  const saveDetails = async () => {
    const body = new FormData();
    body.set("client_name", projectDraft.client_name);
    body.set("project_name", projectDraft.project_name);
    body.set("project_details", projectDraft.project_details);
    await request(
      `/api/admin/projects/${encodeURIComponent(projectDraft.id)}`,
      {
        method: "PUT",
        body,
      },
    );
    await loadProjects();
  };

  const createProject = async () => {
    const body = new FormData();
    body.set("client_name", createDraft.client_name);
    body.set("project_name", createDraft.project_name);
    body.set("project_details", createDraft.project_details);
    const payload = await request("/api/admin/projects", {
      method: "POST",
      body,
    });
    setCreateOpened(false);
    setCreateDraft(emptyProject);
    setSelectedId(payload.id);
    await loadProjects();
  };

  const deleteProject = async () => {
    if (!selectedProject) return;
    const confirmed = window.confirm(`Delete project ${selectedProject.id}?`);
    if (!confirmed) return;
    await request(
      `/api/admin/projects/${encodeURIComponent(selectedProject.id)}`,
      { method: "DELETE" },
    );
    setSelectedId(null);
    await loadProjects();
  };

  const uploadSelectedFile = async () => {
    if (!selectedProject || uploadFiles.length === 0) return;
    const body = new FormData();
    uploadFiles.forEach((file) => body.append("files", file));
    body.set("path", uploadPath);
    await request(
      `/api/admin/projects/${encodeURIComponent(selectedProject.id)}/files`,
      {
        method: "POST",
        body,
      },
    );
    setUploadFiles([]);
    setUploadPath("");
    await loadProjects();
  };

  const deleteFile = async (filePath) => {
    if (!selectedProject) return;
    const confirmed = window.confirm(`Delete ${filePath}?`);
    if (!confirmed) return;
    await request(
      `/api/admin/projects/${encodeURIComponent(selectedProject.id)}/files/${filePath.split("/").map(encodeURIComponent).join("/")}`,
      { method: "DELETE" },
    );
    await loadProjects();
  };

  if (!isLoggedIn) {
    return (
      <main className="admin-shell">
        <Paper className="admin-login" p="xl" withBorder>
          <Title order={2}>IRC Engineering Admin</Title>
          <Text size="sm" c="dimmed" mt={4}>
            Sign in to manage hosted inspection projects.
          </Text>
          <Stack mt="lg">
            <TextInput
              label="Admin Email"
              value={loginDraft.email}
              onChange={(event) =>
                setLoginDraft({
                  ...loginDraft,
                  email: event.currentTarget.value,
                })
              }
            />
            <PasswordInput
              label="Admin Password"
              value={loginDraft.password}
              onChange={(event) =>
                setLoginDraft({
                  ...loginDraft,
                  password: event.currentTarget.value,
                })
              }
            />
            <Button className="primary-action" onClick={login}>
              Login
            </Button>
          </Stack>
        </Paper>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <Group justify="space-between" mb="md">
        <div>
          <Text size="xs" fw={800} tt="uppercase" className="signal-text">
            Admin Console
          </Text>
          <Title order={1}>Project Management</Title>
        </div>
        <Group>
          <Button variant="light" onClick={() => setCreateOpened(true)}>
            New Project
          </Button>
          <Button variant="subtle" onClick={logout}>
            Logout
          </Button>
        </Group>
      </Group>

      {error && (
        <Paper p="sm" mb="md" withBorder className="admin-error">
          {error}
        </Paper>
      )}

      <div className="admin-grid">
        <Paper withBorder className="admin-project-list">
          <ScrollArea h="calc(100vh - 168px)" offsetScrollbars>
            <Stack gap="xs" p="sm">
              {projects.map((project) => (
                <button
                  type="button"
                  key={project.id}
                  className={`admin-project-card ${selectedProject?.id === project.id ? "is-active" : ""}`}
                  onClick={() => setSelectedId(project.id)}
                >
                  <strong>{project.project_name || project.id}</strong>
                  <span>
                    {project.client_name || "No client"} |{" "}
                    {project.file_count || 0} files
                  </span>
                </button>
              ))}
            </Stack>
          </ScrollArea>
        </Paper>

        <Paper withBorder p="md" className="admin-detail-panel">
          {selectedProject ? (
            <Tabs defaultValue="details">
              <Tabs.List>
                <Tabs.Tab value="details">Details</Tabs.Tab>
                <Tabs.Tab value="files">Files</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="details" pt="md">
                <Stack>
                  <TextInput
                    label="Project ID"
                    value={projectDraft.id}
                    disabled
                  />
                  <TextInput
                    label="Client Name"
                    value={projectDraft.client_name}
                    onChange={(event) =>
                      setProjectDraft({
                        ...projectDraft,
                        client_name: event.currentTarget.value,
                      })
                    }
                  />
                  <TextInput
                    label="Project Name"
                    value={projectDraft.project_name}
                    onChange={(event) =>
                      setProjectDraft({
                        ...projectDraft,
                        project_name: event.currentTarget.value,
                      })
                    }
                  />
                  <Textarea
                    label="Project Details"
                    minRows={5}
                    value={projectDraft.project_details}
                    onChange={(event) =>
                      setProjectDraft({
                        ...projectDraft,
                        project_details: event.currentTarget.value,
                      })
                    }
                  />
                  <Group justify="space-between">
                    <Button className="primary-action" onClick={saveDetails}>
                      Save Details
                    </Button>
                    <Button color="red" variant="light" onClick={deleteProject}>
                      Delete Project
                    </Button>
                    <Button
                      color="green"
                      variant="light"
                      onClick={() =>
                        window.open(`/?project=${projectDraft.id}`, "_blank")
                      }
                    >
                      Open Project
                    </Button>
                  </Group>
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="files" pt="md">
                <Stack>
                  <Group align="end">
                    <FileInput
                      label="Upload / Replace Files"
                      value={uploadFiles}
                      onChange={setUploadFiles}
                      placeholder="Choose files or ZIP"
                      multiple
                    />
                    <TextInput
                      label="Target Folder / Path"
                      value={uploadPath}
                      onChange={(event) =>
                        setUploadPath(event.currentTarget.value)
                      }
                      placeholder={
                        uploadFiles.length === 1
                          ? uploadFiles[0]?.name
                          : "optional-folder"
                      }
                    />
                    <Button
                      onClick={uploadSelectedFile}
                      disabled={uploadFiles.length === 0}
                    >
                      Upload
                    </Button>
                  </Group>
                  <ScrollArea h="calc(100vh - 322px)" offsetScrollbars>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Name</Table.Th>
                          <Table.Th>Type</Table.Th>
                          <Table.Th>Path</Table.Th>
                          <Table.Th>Action</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {(selectedProject.files || []).map((file) => (
                          <Table.Tr key={file.path}>
                            <Table.Td>{file.name}</Table.Td>
                            <Table.Td>
                              <Badge variant="light">{file.type}</Badge>
                            </Table.Td>
                            <Table.Td>{file.path}</Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                <Button
                                  component="a"
                                  href={file.url}
                                  target="_blank"
                                  size="xs"
                                  variant="subtle"
                                >
                                  Open
                                </Button>
                                <Button
                                  size="xs"
                                  color="red"
                                  variant="light"
                                  onClick={() => deleteFile(file.path)}
                                >
                                  Delete
                                </Button>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </Stack>
              </Tabs.Panel>
            </Tabs>
          ) : (
            <Text c="dimmed">Create a project to begin.</Text>
          )}
        </Paper>
      </div>

      <Modal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        title="New Project"
        centered
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Project ID will be generated automatically as a random hash.
          </Text>
          <TextInput
            label="Client Name"
            value={createDraft.client_name}
            onChange={(event) =>
              setCreateDraft({
                ...createDraft,
                client_name: event.currentTarget.value,
              })
            }
          />
          <TextInput
            label="Project Name"
            value={createDraft.project_name}
            onChange={(event) =>
              setCreateDraft({
                ...createDraft,
                project_name: event.currentTarget.value,
              })
            }
          />
          <Textarea
            label="Project Details"
            value={createDraft.project_details}
            onChange={(event) =>
              setCreateDraft({
                ...createDraft,
                project_details: event.currentTarget.value,
              })
            }
          />
          <Button className="primary-action" onClick={createProject}>
            Create
          </Button>
        </Stack>
      </Modal>
    </main>
  );
}

export default Admin;
