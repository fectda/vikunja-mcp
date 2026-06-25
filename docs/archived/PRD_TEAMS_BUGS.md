# PRD — Bugs en gestión de Teams (update, members.update, members.remove)

## Estado
**MCP Version**: `@democratize-technology/vikunja-mcp@0.2.2`
**Commit**: `105234a` (incluye `fix: use user_id instead of username in team member API calls`)
**Fecha**: 2026-04-02
**Reportado por**: vikunja-mcp-docker wrapper (test de persistencia)
**Severidad**: Medio — operaciones de teams no persisten

---

## Resumen

3 operaciones de teams devuelven "Success" del MCP pero los cambios **no persisten** en Vikunja. Todos los bugs están en `tools/teams.js`.

---

## Bug 1: teams.update no actualiza el nombre

### Comportamiento
```
MCP:  vikunja_teams { subcommand: "update", id: 3, name: "Updated Name" }
Resp: "✅ Success — Team updated"

API:  GET /teams/3 → name: "Original Name" (NO CAMBIÓ)
```

### Causa probable
El MCP responde OK pero no envía el `name` en el body del PUT a Vikunja, o el schema no acepta `name` como campo de update.

---

## Bug 2: teams.members.update no cambia rol de admin

### Comportamiento
```
MCP:  vikunja_teams { subcommand: "members", memberSubcommand: "update",
                      id: 3, userId: 8, admin: false }
Resp: "✅ Success — Member updated"

API:  GET /teams/3 → members[0].admin: true (NO CAMBIÓ)
```

### Causa probable
El campo `admin` no se envía en el body del PUT, o el endpoint de Vikunja no acepta este campo en el formato que el MCP envía.

---

## Bug 3: teams.members.remove no remueve el usuario

### Comportamiento
```
MCP:  vikunja_teams { subcommand: "members", memberSubcommand: "remove",
                      id: 3, userId: 8 }
Resp: "✅ Success — Member removed"

API:  GET /teams/3 → members sigue incluyendo userId 8
```

### Causa probable
El MCP usa DELETE o PUT para remover, pero el endpoint de Vikunja requiere un formato específico que no se está enviando correctamente.

---

## Contexto

Estos bugs son similares al bug de `projects.update` que fue arreglado en commits anteriores. La causa raíz es probablemente la misma: el MCP no envía los datos correctamente en el body del request de update.

### Patrón común
1. MCP responde "Success"
2. La operación real en Vikunja falla silenciosamente (o no se ejecuta)
3. El MCP no verifica el resultado con un GET posterior

### Commits relacionados
- `105234a` — `fix: use user_id instead of username in team member API calls`
  - Este fix corrigió el `user_id` pero no las operaciones de update/remove

---

## Propuesta de Solución

### Para todos los bugs: Verificar que el body del request contiene los datos

En cada operación de update/remove, verificar que:
1. El body del PUT/DELETE contiene los campos correctos
2. El formato coincide con lo que Vikunja espera
3. Hacer un GET después del update para confirmar que persistió

### Ejemplo de fix para teams.update:
```javascript
// Verificar que name se envía en el body
const updateData = {};
if (args.name !== undefined) updateData.name = args.name;
if (args.description !== undefined) updateData.description = args.description;

// Enviar y verificar
await client.teams.updateTeam(teamId, updateData);
const updated = await client.teams.getTeam(teamId); // Verificar
```

---

## Impacto

- **Endpoints afectados**: `vikunja_teams` (update, members.update, members.remove)
- **Usuarios afectados**: Quienes necesitan modificar teams o miembros
- **Workaround**: Usar la API de Vikunja directamente para estas operaciones

---

## Tests que fallan

```
❌ teams.update — API directa: Name API: "Test Team X", esperado: "Updated Team X"
❌ teams.members.update — API directa: admin=true, esperado: false
❌ teams.members.remove — API directa: Usuario X AÚN está en equipo
```

Los tests están en `tests/mcp-teams.test.js` y validan con API directa (GET después de cada operación).
