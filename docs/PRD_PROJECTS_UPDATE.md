# PRD — Bug: projects.update no funciona (parentProjectId validation)

## Estado
**MCP Version**: `@democratize-technology/vikunja-mcp@0.2.2`
**Commit actual**: `9a28126` (fix intentado pero incompleto)
**Commit anterior**: `64e03a1`
**Fecha**: 2026-03-28
**Reportado por**: vikunja-mcp-docker wrapper (test de persistencia)
**Severidad**: Alto — operación CRUD básica no funciona
**Estado fix**: ❌ El commit `9a28126` ("fix: make parentProjectId optional") NO resuelve el problema

---

## Resumen

La tool `vikunja_projects` con `subcommand: "update"` falla al intentar actualizar un proyecto. El MCP responde con error de validación y el cambio **nunca persiste** en Vikunja.

---

## Comportamiento Esperado

Llamar a `vikunja_projects` con `{ subcommand: "update", id: 83, title: "New Title" }` debería actualizar el título del proyecto en Vikunja.

## Comportamiento Actual

### Intento 1: Sin `parentProjectId`
```json
{ "subcommand": "update", "id": 83, "title": "New Title" }
```
**Respuesta MCP**: `"parentProjectId must be a positive integer"`

### Intento 2: Con `parentProjectId: 0`
```json
{ "subcommand": "update", "id": 83, "title": "New Title", "parentProjectId": 0 }
```
**Respuesta MCP**: `MCP error -32602: Input validation error: Invalid arguments for tool vikunja_projects`

### Verificación API directa
```
GET /projects/83 → title: "UpdateTest3" (NO CAMBIÓ)
```

---

## Pasos para Reproducir

1. Crear un proyecto via MCP:
   ```
   vikunja_projects { subcommand: "create", title: "TestProj" }
   ```

2. Intentar actualizar el título:
   ```
   vikunja_projects { subcommand: "update", id: <projectId>, title: "Updated" }
   ```

3. Verificar con API directa:
   ```
   GET /projects/<projectId> → title sigue siendo "TestProj"
   ```

---

## Análisis del Bug

El problema está en `tools/projects/crud.js` función `updateProject`:

```javascript
const resolvedParentProjectId = parentProjectId ??
    (currentProject && typeof currentProject.parent_project_id === 'number'
        ? currentProject.parent_project_id
        : undefined);

if (resolvedParentProjectId !== undefined) {
    validationUpdateData.parentProjectId = resolvedParentProjectId;
}
// ...
(0, validation_1.validateProjectData)(validationUpdateData, allProjects);
```

Y en `tools/projects/validation.js` función `validateProjectData`:

```javascript
if (data.parentProjectId !== undefined && allProjects) {
    (0, exports.validateId)(data.parentProjectId, 'parentProjectId');
    // validateId rechaza 0 como "not a positive integer"
}
```

### Cadena del bug:
1. Usuario llama `update(id=83, title="New Title")` — sin `parentProjectId`
2. `resolvedParentProjectId = undefined ?? currentProject.parent_project_id` → `0` (proyecto raíz)
3. `validationUpdateData.parentProjectId = 0`
4. `validateProjectData` llama `validateId(0, 'parentProjectId')`
5. `validateId` lanza error: `"parentProjectId must be a positive integer"`

### Causa raíz:
`validateId()` rechaza `0` como ID, pero `parent_project_id: 0` en Vikunja significa "sin proyecto padre" (raíz). El fix del commit `9a28126` solo hizo `parentProjectId` opcional en el schema de Zod, pero NO arregló la validación interna que convierte `undefined` en `0` y luego lo rechaza.

---

## Logs de Error

```
[DEBUG] Executing tool vikunja_projects { subcommand: 'update', id: 83, title: 'UpdatedTitle' }
→ "parentProjectId must be a positive integer"

[DEBUG] Executing tool vikunja_projects { subcommand: 'update', id: 83, title: 'UpdatedTitle', parentProjectId: 0 }
→ MCP error -32602: Input validation error: Invalid arguments
```

---

## Propuesta de Solución

### Fix necesario en `tools/projects/crud.js`:

```javascript
// ANTES (bug):
const resolvedParentProjectId = parentProjectId ??
    (currentProject && typeof currentProject.parent_project_id === 'number'
        ? currentProject.parent_project_id
        : undefined);

// DESPUÉS (fix):
// Solo resolver parentProjectId si el usuario lo proporcionó explícitamente
const resolvedParentProjectId = parentProjectId;
```

### O fix en `tools/projects/validation.js`:

```javascript
// ANTES (bug):
if (data.parentProjectId !== undefined && allProjects) {
    (0, exports.validateId)(data.parentProjectId, 'parentProjectId');
}

// DESPUÉS (fix):
if (data.parentProjectId !== undefined && data.parentProjectId > 0 && allProjects) {
    (0, exports.validateId)(data.parentProjectId, 'parentProjectId');
}
// parent_project_id: 0 significa "raíz" en Vikunja — no requiere validación
```

---

## Impacto

- **Endpoints afectados**: `vikunja_projects` con `subcommand: "update"`
- **Usuarios afectados**: Cualquier usuario que quiera renombrar o modificar un proyecto
- **Workaround**: Ninguno — el update simplemente no funciona

---

## Referencias

- Test de persistencia: `tests/mcp-integration.test.js` → `projects.update`
- Vikunja API: `PUT /projects/{id}` acepta body parcial (no requiere todos los campos)
- MCP source: `vikunja-mcp` → tools/projects
