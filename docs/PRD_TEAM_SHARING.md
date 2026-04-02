# PRD — Team Sharing: endpoint incorrecto + campo incorrecto + falta paso 2

## Estado
**MCP Version**: `@democratize-technology/vikunja-mcp@0.2.2`
**Commit**: `76d3f4a`
**Fecha**: 2026-04-02
**Severidad**: Alto — compartir proyectos con equipos no funciona

---

## Resumen

El tool `vikunja_projects_team_sharing` tiene 3 bugs que impiden compartir proyectos con equipos con permisos correctos.

---

## Flujo correcto en Vikunja (2 pasos)

```
Paso 1: PUT /projects/{projectId}/teams
        body: {"team_id": {teamId}}
        → Crea el share con permission=0 (read por defecto)

Paso 2: POST /projects/{projectId}/teams/{teamId}
        body: {"permission": 2}
        → Actualiza el permiso a admin (2=admin, 1=write, 0=read)
```

---

## Bug 1: MCP usa endpoint incorrecto

### Actual (bug)
```
PUT /projects/{projectId}/teams/{teamId}
body: {"right": 2}
→ 405 Method Not Allowed
```

### Correcto
```
PUT /projects/{projectId}/teams
body: {"team_id": {teamId}}
→ 201 Created (permission=0 por defecto)
```

---

## Bug 2: MCP usa campo `right` en vez de `permission`

### Actual (bug)
```javascript
body: JSON.stringify({ right: numericRight })
// Vikunja ignora "right" completamente
```

### Correcto
```javascript
body: JSON.stringify({ permission: numericRight })
// Vikunja usa "permission": 0=read, 1=write, 2=admin
```

---

## Bug 3: MCP no hace el paso 2 (actualizar permisos)

Después de crear el share (paso 1), se necesita una segunda llamada para establecer los permisos:

```
POST /projects/{projectId}/teams/{teamId}
body: {"permission": 2}
```

Sin este paso, el permiso queda en 0 (read only).

---

## Fix necesario

```javascript
// PASO 1: Crear share
const createRes = await fetch(`${apiUrl}/projects/${projectId}/teams`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ team_id: teamId }),
});

// PASO 2: Actualizar permisos
if (right !== undefined && right !== 0) {
    await fetch(`${apiUrl}/projects/${projectId}/teams/${teamId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: right }),
    });
}
```

---

## Tabla de permisos

| Valor | Nombre | Descripción |
|-------|--------|-------------|
| 0 | read | Solo lectura (default) |
| 1 | write | Lectura y escritura |
| 2 | admin | Control total |

---

## Tests

Ver `tests/mcp-teams.test.js` → sección `projects.share_with_team`
