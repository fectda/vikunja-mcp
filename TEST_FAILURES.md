# PRD: Errores en Vikunja MCP

## Estado

**MCP Commit**: 601654cc618ab16ca47d5b48eca521887ee4ac92 (main branch)
**Fecha**: 2026-03-27
**Resultado**: 10 passed, 7 failed

---

## Errores

### Error 1: tasks.update
- **Input**: `{ id: Y, title: "Updated Task Title" }`
- **Expected**: Title actualizado
- **Actual**: `undefined undefined`

### Error 2: tasks.create_with_assignees
- **Input**: `{ projectId: X, title: "Task", assignees: [userId] }`
- **Expected**: Assignees guardados
- **Actual**: `Cannot read properties of null (reading 'code')`

### Error 3: tasks.assign
- **Input**: `{ id: Y, assignees: [userId] }`
- **Expected**: Assignees persistidos
- **Actual**: `Cannot read properties of null (reading 'code')`

### Error 4: tasks.list_assignees
- **Input**: `{ id: Y }`
- **Expected**: Lista de asignados
- **Actual**: `{ message: 'Internal Server Error' }`

### Error 5: tasks.unassign
- **Input**: `{ id: Y, assignees: [userId] }`
- **Expected**: Assignees eliminados
- **Actual**: `Cannot read properties of null (reading 'code')`

### Error 6: tasks.add_label
- **Input**: `{ taskId: Y, labels: [labelId] }`
- **Expected**: Labels aplicados
- **Actual**: `labels: null`

### Error 7: filters.list
- **Input**: `{}`
- **Expected**: Array de filtros
- **Actual**: `undefined filters`

---

## Repo

https://github.com/fectda/vikunja-mcp (branch: main)
