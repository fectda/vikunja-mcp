# PRD: Vikunja MCP - Tests de Validación de Servicios

## Objetivo

Validar que todos los servicios del MCP funcionan correctamente contra la API de Vikunja.

---

## Tests por Servicio

### 1. Auth

| Test                     | Input                             | Expected                                                  |
| ------------------------ | --------------------------------- | --------------------------------------------------------- |
| Connect con API token    | `VIKUNJA_API_TOKEN=tk_...`        | `{ success: true, authenticated: true }`                  |
| Connect con JWT          | `VIKUNJA_API_TOKEN=eyJ...`        | `{ success: true, authenticated: true, authType: 'jwt' }` |
| Connect con credenciales | `VIKUNJA_USER + VIKUNJA_PASSWORD` | Auto-login obtiene JWT                                    |
| Status sin auth          | Sin token                         | `{ authenticated: false }`                                |

### 2. Projects CRUD

| Test              | Input                                 | Expected                                                    |
| ----------------- | ------------------------------------- | ----------------------------------------------------------- |
| Create project    | `{ title: "Test Project" }`           | `{ success: true, data: { id: X, title: "Test Project" } }` |
| List projects     | `{}`                                  | `{ success: true, data: [...] }`                            |
| Get project       | `{ id: X }`                           | `{ success: true, data: { id: X } }`                        |
| Update project    | `{ id: X, title: "New Title" }`       | `{ success: true, data: { id: X, title: "New Title" } }`    |
| Delete project    | `{ id: X }`                           | `{ success: true }`                                         |
| Archive project   | `{ id: X }`                           | `{ success: true }`                                         |
| Unarchive project | `{ id: X }`                           | `{ success: true }`                                         |
| Get children      | `{ id: X }`                           | `{ success: true, data: [...] }`                            |
| Get tree          | `{ id: X }`                           | `{ success: true, data: { children: [...] } }`              |
| Get breadcrumb    | `{ id: childId }`                     | `{ success: true, data: [...] }`                            |
| Move project      | `{ id: childId, parentProjectId: Y }` | `{ success: true }`                                         |

### 3. Tasks CRUD

| Test        | Input                                  | Expected                                                 |
| ----------- | -------------------------------------- | -------------------------------------------------------- |
| Create task | `{ projectId: X, title: "Test Task" }` | `{ success: true, data: { id: Y, title: "Test Task" } }` |
| List tasks  | `{ projectId: X }`                     | `{ success: true, data: [...] }`                         |
| Get task    | `{ id: Y }`                            | `{ success: true, data: { id: Y } }`                     |
| Update task | `{ id: Y, done: true }`                | `{ success: true, data: { id: Y, done: true } }`         |
| Delete task | `{ id: Y }`                            | `{ success: true }`                                      |

### 4. Assignees ✅ FIXED

| Test                       | Input                                                  | Expected                                           |
| -------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| Create task with assignees | `{ projectId: X, title: "Task", assignees: [userId] }` | `{ success: true, data: { assignees: [...] } }` ✅ |
| Assign users               | `{ id: Y, assignees: [userId] }`                       | `{ success: true }` ✅                             |
| List assignees             | `{ id: Y }`                                            | `{ success: true, data: [{ id: userId }] }` ✅     |
| Unassign user              | `{ id: Y, assignees: [userId] }`                       | `{ success: true }` ✅                             |

**FIXED**: Changed from bulk endpoint (POST /bulk) to single endpoint (PUT /assignees). Assignees now persist correctly.

### 5. Labels

| Test                   | Input                                   | Expected                               |
| ---------------------- | --------------------------------------- | -------------------------------------- |
| Create label           | `{ title: "Bug", hexColor: "#FF0000" }` | `{ success: true, data: { id: L } }`   |
| Get label              | `{ id: L }`                             | `{ success: true, data: { id: L } }`   |
| Update label           | `{ id: L, title: "Updated" }`           | `{ success: true }`                    |
| Delete label           | `{ id: L }`                             | `{ success: true }`                    |
| Apply label to task    | `{ taskId: Y, labels: [L] }`            | `{ success: true }`                    |
| List labels on task    | `{ taskId: Y }`                         | `{ success: true, data: [{ id: L }] }` |
| Remove label from task | `{ taskId: Y, labels: [L] }`            | `{ success: true }`                    |

### 6. Tasks Extended

| Test            | Input                                                   | Expected                         |
| --------------- | ------------------------------------------------------- | -------------------------------- |
| Add comment     | `{ taskId: Y, comment: "test" }`                        | `{ success: true }`              |
| List comments   | `{ taskId: Y }`                                         | `{ success: true, data: [...] }` |
| Bulk create     | `{ projectId: X, tasks: [{title: "A"}, {title: "B"}] }` | `{ success: true }`              |
| Bulk update     | `{ taskIds: [Y, Z], field: "done", value: true }`       | `{ success: true }`              |
| Bulk delete     | `{ taskIds: [Y, Z] }`                                   | `{ success: true }`              |
| Add reminder    | `{ taskId: Y, date: "2025-01-01" }`                     | `{ success: true }`              |
| List reminders  | `{ taskId: Y }`                                         | `{ success: true, data: [...] }` |
| Remove reminder | `{ taskId: Y, reminderId: R }`                          | `{ success: true }`              |
| Relate tasks    | `{ taskId: Y, relatedTaskId: Z, relation: "blocks" }`   | `{ success: true }`              |
| List relations  | `{ taskId: Y }`                                         | `{ success: true, data: [...] }` |
| Unrelate        | `{ taskId: Y, relatedTaskId: Z }`                       | `{ success: true }`              |

### 7. Filters

| Test            | Input                                       | Expected                             |
| --------------- | ------------------------------------------- | ------------------------------------ |
| Create filter   | `{ name: "High", filter: "priority >= 4" }` | `{ success: true, data: { id: F } }` |
| List filters    | `{}`                                        | `{ success: true, data: [...] }`     |
| Validate filter | `{ filter: "done = false" }`                | `{ valid: true }`                    |
| Build filter    | `{ conditions: [...] }`                     | `{ filter: "...", valid: true }`     |

### 8. Webhooks

| Test           | Input                                                       | Expected                                         |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| List events    | `{}`                                                        | `{ success: true, data: ["task.created", ...] }` |
| Create webhook | `{ projectId: X, targetUrl: "https://...", events: [...] }` | `{ success: true, data: { id: W } }`             |
| List webhooks  | `{ projectId: X }`                                          | `{ success: true, data: [...] }`                 |
| Get webhook    | `{ projectId: X, webhookId: W }`                            | `{ success: true, data: { id: W } }`             |
| Update webhook | `{ projectId: X, webhookId: W, ... }`                       | `{ success: true }`                              |
| Delete webhook | `{ projectId: X, webhookId: W }`                            | `{ success: true }`                              |

### 9. Teams

| Test       | Input | Expected                         |
| ---------- | ----- | -------------------------------- |
| List teams | `{}`  | `{ success: true, data: [...] }` |

### 10. Users (requiere JWT)

| Test         | Input               | Expected                               |
| ------------ | ------------------- | -------------------------------------- |
| Current user | `{}`                | `{ success: true, data: { id, ... } }` |
| Search users | `{ query: "test" }` | `{ success: true, data: [...] }`       |

### 11. Templates

| Test            | Input                          | Expected                             |
| --------------- | ------------------------------ | ------------------------------------ |
| List templates  | `{}`                           | `{ success: true, data: [...] }`     |
| Create template | `{ projectId: X, title: "T" }` | `{ success: true, data: { id: T } }` |

### 12. Export (requiere JWT)

| Test                | Input              | Expected            |
| ------------------- | ------------------ | ------------------- |
| Export project      | `{ projectId: X }` | `{ success: true }` |
| Request user export | `{}`               | `{ success: true }` |

---

## Cómo Ejecutar

```bash
# Tests unitarios
npm test

# Tests de integración (API real)
VIKUNJA_URL=... VIKUNJA_USER=... VIKUNJA_PASSWORD=... node tests/mcp-tests.js
```

---

## Criterios de Éxito

| Prioridad | Servicio          | Requisito                   |
| --------- | ----------------- | --------------------------- |
| ALTA      | Tasks CRUD        | ✅ Todos pasan              |
| ALTA      | Projects CRUD     | ✅ Todos pasan              |
| ALTA      | Assignees         | ✅ Persisten al crear tarea |
| ALTA      | Labels            | ✅ Todos pasan              |
| MEDIA     | Bulk Operations   | ✅ Todos pasan              |
| MEDIA     | Filters           | ✅ Todos pasan              |
| MEDIA     | Webhooks          | ✅ Todos pasan              |
| MEDIA     | Project Hierarchy | ✅ Todos pasan              |
| BAJA      | Users             | ✅ Con JWT                  |
| BAJA      | Templates         | ✅ Todos pasan              |
| BAJA      | Export            | ✅ Con JWT                  |

---

## Bugs a Corregir

1. **Assignees no persisten al crear tarea** — Expected: `data.assignees` contiene los users
2. **API token 401 en POST** — Tokens `tk_` fallan en POST endpoints
3. **User endpoints fallan** — even con token válido
