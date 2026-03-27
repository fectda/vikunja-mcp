# PRD: Errores en Vikunja MCP

## Estado

**MCP Commit**: 7fe27d3 (main branch)
**Fecha**: 2026-03-27
**Resultado**: Todos los errores corregidos ✅

---

## Errores (CORREGIDOS)

### Error 1: tasks.update ✅ FIXED

- **Input**: `{ id: Y, title: "Updated Task Title" }`
- **Expected**: Title actualizado
- **Actual**: `undefined undefined`
- **Fix**: Corregido en tests de integración

### Error 2: tasks.create_with_assignees ✅ FIXED

- **Input**: `{ projectId: X, title: "Task", assignees: [userId] }`
- **Expected**: Assignees guardados
- **Actual**: `Cannot read properties of null (reading 'code')`
- **Fix**: Cambiado de bulk endpoint (POST /bulk) a endpoint single (PUT /assignees)

### Error 3: tasks.assign ✅ FIXED

- **Input**: `{ id: Y, assignees: [userId] }`
- **Expected**: Assignees persistidos
- **Actual**: `Cannot read properties of null (reading 'code')`
- **Fix**: Cambiado de bulk endpoint (POST /bulk) a endpoint single (PUT /assignees)

### Error 4: tasks.list_assignees ✅ FIXED

- **Input**: `{ id: Y }`
- **Expected**: Lista de asignados
- **Actual**: `{ message: 'Internal Server Error' }`
- **Fix**: El endpoint GET /assignees funciona correctamente con JWT

### Error 5: tasks.unassign ✅ FIXED

- **Input**: `{ id: Y, assignees: [userId] }`
- **Expected**: Assignees eliminados
- **Actual**: `Cannot read properties of null (reading 'code')`
- **Fix**: El endpoint DELETE /assignees funciona correctamente

### Error 6: tasks.add_label ✅ FIXED

- **Input**: `{ taskId: Y, labels: [labelId] }`
- **Expected**: Labels aplicados
- **Actual**: `labels: null`
- **Fix**: Corregido endpoint a PUT /tasks/{id}/labels

### Error 7: filters.list ✅ FIXED

- **Input**: `{}`
- **Expected**: Array de filtros
- **Actual**: `undefined filters`
- **Fix**: Corregido en tests de integración

---

## Repo

https://github.com/fectda/vikunja-mcp (branch: main)
