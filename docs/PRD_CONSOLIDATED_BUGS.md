# PRD — Bugs del MCP v0.2.2 consolidados

## Estado
**MCP Version**: `@democratize-technology/vikunja-mcp@0.2.2`
**Commit**: `2ff08dc`
**Fecha**: 2026-04-02
**Reportado por**: vikunja-mcp-docker wrapper (tests de persistencia)

---

## Bug 1: Team Sharing — permission debe ser numérico

### Descripción
El tool `vikunja_projects_team_sharing` implementa correctamente los 2 pasos (PUT crear + POST actualizar), pero en el paso 2 envía `permission` como string cuando Vikunja espera número.

### Reproducción
```bash
# MCP envía:
POST /projects/{id}/teams/{teamId}
{"permission": "admin"}

# Vikunja responde:
400 Invalid model provided
```

### Fix
Cambiar `{ permission: rightString }` por `{ permission: numericRight }` en el paso 2.

### Archivo
`tools/projects/team-sharing.js` — función `updateTeamShare` y `shareTeam` paso 2

---

## Bug 2: projects.update — description no persiste

### Descripción
Al actualizar la descripción de un proyecto via MCP, la operación devuelve OK pero la descripción queda vacía en Vikunja.

### Reproducción
```javascript
vikunja_projects({ subcommand: "update", id: 155, description: "Nueva descripción" })
// MCP responde: Success

GET /projects/155
// API responde: description: ""
```

### Causa probable
El MCP no envía `description` en el body del POST a Vikunja, o el campo se mapea incorrectamente.

### Archivo
`tools/projects/crud.js` — función `updateProject`

---

## Bug 3: projects.update — parentProjectId no persiste

### Descripción
Al cambiar el proyecto padre de un proyecto, la operación devuelve OK pero `parent_project_id` queda en 0.

### Reproducción
```javascript
vikunja_projects({ subcommand: "update", id: 155, parentProjectId: 156 })
// MCP responde: Success

GET /projects/155
// API responde: parent_project_id: 0 (esperado: 156)
```

### Causa probable
El MCP mapea `parentProjectId` a `parent_project_id` pero Vikunja puede esperar un campo diferente o el valor no se envía correctamente.

### Archivo
`tools/projects/crud.js` — función `updateProject`

---

## Bug 4: Team Sharing — endpoint incorrecto (ya fixeado parcialmente)

### Descripción
El commit `2ff08dc` fixeó el endpoint (2 pasos), pero el campo `permission` sigue siendo string en vez de número (Bug 1 de este PRD).

---

## Feature Requests: Campos que Vikunja soporta pero el MCP no

Estos campos existen en la API de Vikunja y funcionan correctamente, pero el MCP no los expone. Son features necesarias para uso completo de Vikunja via MCP.

| # | Campo | Entidad | Vikunja API | MCP | Prioridad |
|---|-------|---------|-------------|-----|-----------|
| 1 | `identifier` | project | ✅ `PUT /projects` | ❌ No en schema | Alta |
| 2 | `percent_done` | task | ✅ `PUT /tasks` | ❌ No en schema | Alta |
| 3 | `start_date` | task | ✅ `PUT /tasks` | ❌ No en schema | Alta |
| 4 | `end_date` | task | ✅ `PUT /tasks` | ❌ No en schema | Media |
| 5 | `hex_color` | task | ✅ `PUT /tasks` | ❌ No en schema | Baja |
| 6 | `attachments` | task | ✅ `PUT /tasks/{id}/attachments` | ❌ No hay tool | Alta |
| 7 | `move (project_id)` | task | ✅ `POST /tasks` con `project_id` | ❌ No hay tool | Media |

### Detalle por feature

#### 1. project.identifier
```javascript
// Vikunja: PUT /projects con {"identifier": "FEAT"}
// MCP debería agregar al schema de update:
identifier: z.string().optional()
```

#### 2. task.percent_done
```javascript
// Vikunja: PUT /tasks con {"percent_done": 50}
// MCP debería agregar al schema de update:
percentDone: z.number().min(0).max(100).optional()
```

#### 3. task.start_date
```javascript
// Vikunja: PUT /tasks con {"start_date": "2026-04-01T00:00:00Z"}
// MCP debería agregar al schema de update:
startDate: z.string().optional()
```

#### 4. task.end_date
```javascript
// Vikunja: PUT /tasks con {"end_date": "2026-04-30T23:59:59Z"}
// MCP debería agregar al schema de update:
endDate: z.string().optional()
```

#### 5. task.hex_color
```javascript
// Vikunja: PUT /tasks con {"hex_color": "#ff0000"}
// MCP debería agregar al schema de update:
hexColor: z.string().optional()
```

#### 6. task.attachments
```javascript
// Vikunja: PUT /tasks/{id}/attachments (multipart/form-data)
// MCP necesita un tool nuevo: vikunja_task_attachments
// Operaciones: upload, list, get, delete
```

#### 7. task.move (project_id)
```javascript
// Vikunja: POST /tasks/{id} con {"project_id": newProjectId}
// MCP podría agregar a vikunja_task_crud update:
// operation: "update", id: taskId, projectId: newProjectId
```

---

## Tests que verifican estos bugs

| Test | Archivo | Resultado |
|------|---------|-----------|
| projects.update — description | `mcp-teams.test.js` → `projects.update_advanced` | ❌ FAIL |
| projects.update — parentProjectId | `mcp-teams.test.js` → `projects.update_advanced` | ❌ FAIL |
| projects.update — hexColor | `mcp-teams.test.js` → `projects.update_advanced` | ⚠️ Limitación Vikunja |
| teams sharing — permission | `mcp-teams.test.js` → `projects.share_with_team` | ❌ FAIL (documentado) |

## Tests que SÍ pasan

| Test | Resultado |
|------|-----------|
| tasks.update — priority | ✅ |
| tasks.update — dueDate | ✅ |
| tasks.update — description | ✅ |
| tasks.update — done | ✅ |
| tasks.relations — relate/list | ✅ |
| tasks.comments — create/list | ✅ |
| teams CRUD completo | ✅ |
| teams members add/remove | ✅ |

## Features faltantes (Vikunja las soporta, MCP no)

| # | Campo | Entidad | Prioridad | Test | Estado |
|---|-------|---------|-----------|------|--------|
| 1 | `identifier` | project | Alta | `unsupported_fields` | ⚠️ Feature request |
| 2 | `percent_done` | task | Alta | `unsupported_fields` | ⚠️ Feature request |
| 3 | `start_date` | task | Alta | `unsupported_fields` | ⚠️ Feature request |
| 4 | `end_date` | task | Media | `unsupported_fields` | ⚠️ Feature request |
| 5 | `hex_color` | task | Baja | `unsupported_fields` | ⚠️ Feature request |
| 6 | `attachments` | task | Alta | `unsupported_fields` | ⚠️ Feature request |
| 7 | `move (project_id)` | task | Media | `unsupported_fields` | ⚠️ Feature request |
