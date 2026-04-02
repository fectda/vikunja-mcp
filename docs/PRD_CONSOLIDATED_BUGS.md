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

## Campos no soportados por el MCP (no son bugs, son features faltantes)

| Campo | Entidad | Nota |
|-------|---------|------|
| `identifier` | project | No hay campo en update |
| `percent_done` | task | No hay campo en update |
| `start_date` | task | No hay campo en update |
| `end_date` | task | No hay campo en update |
| `hex_color` | task | No hay campo en update |
| `attachments` | task | No hay tool para adjuntar archivos |
| `move (project_id)` | task | No hay tool para mover entre proyectos |
