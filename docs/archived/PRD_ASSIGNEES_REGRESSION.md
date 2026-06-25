# PRD — Bug: assignees no persisten después de revertir a bulk endpoint

## Estado
**MCP Version**: `@democratize-technology/vikunja-mcp@0.2.2`
**Commit**: `d02f016` (específicamente: `fix: revert AssigneeOperationsService to use bulk endpoint`)
**Fecha**: 2026-04-01
**Reportado por**: vikunja-mcp-docker wrapper (test de persistencia)
**Severidad**: Alto — asignar usuarios a tareas no funciona
**Regressión**: SÍ — en la versión anterior (`9a28126`) assignees SÍ funcionaban

---

## Resumen

El commit `fix: revert AssigneeOperationsService to use bulk endpoint` revirtió la asignación de usuarios de llamadas individuales (`assignUserToTask`) al endpoint bulk (`bulkAssignUsersToTask`). El endpoint bulk de Vikunja no funciona correctamente con JWT — la operación parece exitosa pero los assignees **no persisten**.

---

## Comportamiento Esperado

Llamar `vikunja_task_assignees` con `{ operation: "assign", id: 270, assignees: [7] }` debería asignar el usuario 7 a la tarea 270.

## Comportamiento Actual

- MCP responde: `## ✅ Success`
- API directa GET `/tasks/270`: `assignees: null`

El usuario NO se asigna.

---

## Regresión Confirmada

| Versión | Commit | Assignees funciona |
|---------|--------|--------------------|
| Anterior | `9a28126` | ✅ SÍ (usaba `assignUserToTask` individual) |
| Actual | `d02f016` | ❌ NO (revirtió a `bulkAssignUsersToTask`) |

---

## Causa Raíz

En `tools/tasks/assignees/AssigneeOperationsService.js`:

```javascript
// ACTUAL (bug — usa bulk que no funciona):
await client.tasks.bulkAssignUsersToTask(taskId, { user_ids: assigneeIds });

// ANTERIOR (funcionaba — individual):
await client.tasks.assignUserToTask(taskId, userId);
```

El endpoint bulk de Vikunja (`POST /tasks/{id}/assignees/bulk`) tiene problemas conocidos:
- Devuelve 401 con JWT válido en muchas instancias
- O acepta la petición pero no persiste los datos

Las llamadas individuales (`PUT /tasks/{id}/assignees` con cada usuario) SÍ funcionan.

---

## Propuesta de Solución

Revertir el revert. Usar asignación individual:

```javascript
async assignUsersToTask(taskId, assigneeIds) {
    const client = await getClientFromContext();
    for (const userId of assigneeIds) {
        await withRetry(
            () => client.tasks.assignUserToTask(taskId, userId),
            { ...RETRY_CONFIG.AUTH_ERRORS, shouldRetry: isAuthenticationError }
        );
    }
}
```

O mantener el bulk como primario con fallback a individual:

```javascript
try {
    await client.tasks.bulkAssignUsersToTask(taskId, { user_ids: assigneeIds });
} catch (error) {
    // Fallback: assign individually
    for (const userId of assigneeIds) {
        await client.tasks.assignUserToTask(taskId, userId);
    }
}
```

---

## Impacto

- **Endpoints afectados**: `vikunja_task_assignees` (assign, list)
- **Usuarios afectados**: Todos los que necesitan asignar usuarios a tareas
- **Workaround**: Ninguno desde el MCP

---

## Referencias

- Commit que introdujo la regresión: `d02f016` — "fix: revert AssigneeOperationsService to use bulk endpoint"
- `docs/mcp-issues/PRD_AUTH_FIX.md` — Documentación de problemas de auth con assignees
