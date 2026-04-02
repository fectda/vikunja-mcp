# PRD — Team Sharing: permission debe ser numérico, no string

## Estado
**MCP Version**: `@democratize-technology/vikunja-mcp@0.2.2`
**Commit**: `2ff08dc` (fix: correct team sharing API endpoints and 2-step flow)
**Fecha**: 2026-04-02
**Severidad**: Alto — team sharing falla en paso 2

---

## Resumen

El fix de team sharing implementa correctamente los 2 pasos (PUT para crear, POST para actualizar), pero en el paso 2 envía `permission` como string (`"admin"`) cuando Vikunja espera número (`2`).

---

## Bug

### El MCP envía:
```json
POST /projects/{id}/teams/{teamId}
{"permission": "admin"}
```
**Respuesta**: `400 Invalid model provided`

### Vikunja espera:
```json
POST /projects/{id}/teams/{teamId}
{"permission": 2}
```
**Respuesta**: `200 OK`

---

## Fix

```javascript
// ANTES (bug):
body: JSON.stringify({ permission: rightString })  // "admin"

// DESPUÉS (fix):
body: JSON.stringify({ permission: numericRight })  // 2
```

---

## Valores de permission

| Valor | Nombre |
|-------|--------|
| 0 | read |
| 1 | write |
| 2 | admin |

---

## Tests

Ver `tests/mcp-teams.test.js` → sección `projects.share_with_team`
