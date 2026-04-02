# PRD — Fix: Endpoints que requieren JWT Authentication

## Estado
**Fecha**: 2026-03-27
**Problema**: Ciertos endpoints de la API de Vikunja requieren JWT authentication y fallan con API tokens (`tk_*`), incluso con todos los permisos habilitados.
**Issues upstream**: [go-vikunja/vikunja#266](https://github.com/go-vikunja/vikunja/issues/266), [go-vikunja/vikunja#399](https://github.com/go-vikunja/vikunja/issues/399) (cerrado como "not planned" — es comportamiento intencional)

---

## Contexto del Problema

Vikunja tiene **dos tipos de autenticación**:
1. **API Token** (`tk_*`): Generado en Settings → API Tokens. Trabaja para endpoints de proyecto/tarea básicos.
2. **JWT Token** (`eyJ...`): Generado por el endpoint `/api/v1/login`. Requerido para endpoints de usuario y operaciones sensibles.

El `vikunja-mcp` ya implementa detección automática de tipo de token en `AuthManager.detectAuthType()`:
- Tokens que empiezan con `tk_` → `api-token`
- Tokens que empiezan con `eyJ` con 3 partes → `jwt`

---

## Clasificación de Endpoints por Tipo de Auth

### ✅ FUNCIONAN con API Token (`tk_*`)

| MCP Tool | Endpoint Vikunja | Método | Descripción |
|----------|-----------------|--------|-------------|
| `vikunja_projects` (list, create, get, update, delete) | `/projects`, `/projects/{id}` | GET, PUT, POST, DELETE | CRUD de proyectos |
| `vikunja_tasks` / `vikunja_task_crud` (create, get, update, delete) | `/projects/{id}/tasks`, `/tasks/{id}` | GET, PUT, POST, DELETE | CRUD de tareas |
| `vikunja_tasks` (done, undone) | `/tasks/{id}/done`, `/tasks/{id}/undone` | POST | Marcar tarea completada |
| `vikunja_labels` (list, create, get, update, delete) | `/labels`, `/labels/{id}` | GET, PUT, POST, DELETE | CRUD de etiquetas |
| `vikunja_task_labels` (list-labels) | `/tasks/{id}/labels` | GET | Leer etiquetas de tarea |
| `vikunja_task_assignees` (list-assignees) | `/tasks/{id}/assignees` | GET | Leer assignees de tarea |
| `vikunja_filters` (build, validate) | N/A (local) | — | Construir/validar filtros (operación local) |
| `vikunja_auth` | `/api/v1/login` | POST | Login (no requiere auth previa) |

### ❌ REQUIEREN JWT (no funcionan con `tk_*`)

| MCP Tool | Endpoint Vikunja | Método | Descripción |
|----------|-----------------|--------|-------------|
| `vikunja_users` (current) | `/user` | GET | Obtener usuario actual |
| `vikunja_users` (search) | `/users` | GET | Buscar usuarios |
| `vikunja_users` (settings) | `/user/settings/general` | GET | Obtener configuración |
| `vikunja_users` (update-settings) | `/user/settings/general` | POST | Actualizar configuración |

**NOTA**: La librería `vikunja-mcp` YA verifica esto explícitamente en `tools/index.js` línea 81:
```javascript
if (authManager.isAuthenticated() && authManager.getAuthType() === 'jwt') {
    registerUsersTool(server, authManager, clientFactory);
    registerExportTool(server, authManager, clientFactory);
}
```
Y en `tools/users.js` línea 87:
```javascript
if (authManager.getAuthType() !== 'jwt') {
    throw new MCPError(ErrorCode.PERMISSION_DENIED, 'User operations require JWT authentication...');
}
```

### ⚠️ FALLAN INTERMITENTEMENTE con API Token (Known Bug de Vikunja)

Estos endpoints tienen **comportamiento inconsistente** con API tokens. La librería `node-vikunja` ya implementa retry logic con headers alternativos (`X-API-Token`, `authorization` lowercase) pero **sigue fallando en muchas instancias**.

| MCP Tool | Endpoint Vikunja | Método | Error |
|----------|-----------------|--------|-------|
| `vikunja_task_assignees` (assign) | `/tasks/{id}/assignees/bulk` | POST | 401/403 |
| `vikunja_task_assignees` (assign) | `/tasks/{id}/assignees` | PUT | 401/403 |
| `vikunja_task_assignees` (unassign) | `/tasks/{id}/assignees/{userId}` | DELETE | 401/403 |
| `vikunja_task_labels` (apply-label) | `/tasks/{id}/labels` | PUT | 401/403 |
| `vikunja_task_labels` (apply-label) | `/tasks/{id}/labels/bulk` | POST | 401/403 |
| `vikunja_task_labels` (remove-label) | `/tasks/{id}/labels/{labelId}` | DELETE | 401/403 |

**Mensajes de error del código fuente** (en `tools/tasks/constants.js`):
```
"Assignee operations may have authentication issues with certain Vikunja API versions. 
This is a known limitation."
```

---

## Causa Raíz del Docker Wrapper

En `src/index.js` línea 16:
```javascript
if (vikunjaUser && vikunjaPassword && !vikunjaApiToken && vikunjaUrl) {
```

La condición `!vikunjaApiToken` impide el auto-login JWT cuando existe un API token en `.env`. Dado que el `.env` tiene AMBOS (`VIKUNJA_API_TOKEN=tk_...` + `VIKUNJA_USER`/`VIKUNJA_PASSWORD`), el JWT nunca se genera, y los endpoints de assignees/labels fallan.

Incluso si se quita `VIKUNJA_API_TOKEN` del `.env`, el wrapper SÍ generaría JWT, pero:
1. JWT expira (~24h típicamente)
2. No hay refresh automático
3. El container necesita reinicio para renovar

---

## Requerimientos

### RF-01 — Auto-login JWT siempre que haya credenciales
El wrapper DEBE intentar obtener JWT via `/api/v1/login` siempre que `VIKUNJA_USER` y `VIKUNJA_PASSWORD` estén presentes, **sin importar** si `VIKUNJA_API_TOKEN` existe.

**Archivos**: `src/index.js`

### RF-02 — Prioridad: JWT sobre API Token
Cuando ambas credenciales existen:
- Intentar login JWT primero
- Si el login JWT tiene éxito → usar JWT (permisos completos)
- Si el login JWT falla → fallback a API token
- Loggear qué tipo de auth se está usando

**Archivos**: `src/index.js`

### RF-03 — Log de auth type para debugging
El wrapper DEBE loggear al inicio:
- Qué tipo de token se está usando (`jwt` vs `api-token`)
- Si el JWT fue obtenido via auto-login o provisto directamente
- Timestamp de cuándo se obtuvo (para debugging de expiración)

### RF-04 — Documentar endpoints JWT-only
El README DEBE documentar claramente:
- Qué endpoints requieren JWT obligatoriamente
- Qué endpoints fallan intermitentemente con API tokens (known bug)
- Cómo obtener JWT manualmente si el auto-login falla
- Que JWT expira y el container necesita reinicio

---

## Resultados de Pruebas Actuales

Del archivo `docs/TEST_FAILURES.md`:

| Test | Error | Causa |
|------|-------|-------|
| `tasks.update` | `undefined undefined` | Bug del test (response parsing), NO es auth |
| `tasks.create_with_assignees` | `Cannot read properties of null (reading 'code')` | Assignee endpoint 401/403 → response es null |
| `tasks.assign` | `Cannot read properties of null (reading 'code')` | `/tasks/{id}/assignees/bulk` 401/403 |
| `tasks.list_assignees` | `Internal Server Error` | `/tasks/{id}/assignees` 401/403 |
| `tasks.unassign` | `Cannot read properties of null (reading 'code')` | `/tasks/{id}/assignees/{userId}` DELETE 401/403 |
| `tasks.add_label` | `labels: null` | `/tasks/{id}/labels/bulk` 401/403 |
| `filters.list` | `undefined filters` | Bug del test (params incorrectos), NO es auth |

---

## Solución Propuesta

### Cambio 1: `src/index.js` — Siempre intentar JWT

```javascript
// ANTES (línea 16):
if (vikunjaUser && vikunjaPassword && !vikunjaApiToken && vikunjaUrl) {

// DESPUÉS:
if (vikunjaUser && vikunjaPassword && vikunjaUrl) {
```

### Cambio 2: `src/index.js` — Fallback lógico

```javascript
async function autoLoginWithCredentials() {
  if (vikunjaUser && vikunjaPassword && vikunjaUrl) {
    const loginUrl = vikunjaUrl.replace('/api/v1', '') + '/api/v1/login';
    console.log('Attempting auto-login with credentials for user:', vikunjaUser);

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: vikunjaUser,
          password: vikunjaPassword,
        }),
      });

      const data = await response.json();

      if (data.token) {
        process.env.VIKUNJA_API_TOKEN = data.token;
        console.log('✅ Auto-login successful — using JWT auth (full API access)');
      } else {
        console.log('⚠️ Auto-login failed:', data.message || 'No token received');
        if (vikunjaApiToken) {
          console.log('📋 Falling back to API token — some endpoints may not work');
        }
      }
    } catch (error) {
      console.error('Auto-login error:', error instanceof Error ? error.message : String(error));
      if (vikunjaApiToken) {
        console.log('📋 Falling back to API token — some endpoints may not work');
      }
    }
  }
}
```

### Cambio 3: `src/index.js` — Loggear auth type al inicio

```javascript
autoLoginWithCredentials().then(() => {
  // ... validación existente ...
  
  const tokenType = process.env.VIKUNJA_API_TOKEN?.startsWith('eyJ') ? 'JWT' : 
                    process.env.VIKUNJA_API_TOKEN?.startsWith('tk_') ? 'API Token' : 'Unknown';
  console.log('Auth type:', tokenType);
  console.log('Token prefix:', process.env.VIKUNJA_API_TOKEN?.substring(0, 10) + '...');
  
  // ... resto del código ...
});
```

---

## Criterios de Aceptación

| ID | Criterio |
|----|----------|
| CA-01 | Con `VIKUNJA_USER` + `VIKUNJA_PASSWORD` + `VIKUNJA_API_TOKEN` en `.env`, el wrapper genera JWT via auto-login |
| CA-02 | El log muestra "using JWT auth" cuando el auto-login tiene éxito |
| CA-03 | El log muestra "Falling back to API token" cuando el auto-login falla pero existe `VIKUNJA_API_TOKEN` |
| CA-04 | Con JWT, las operaciones de assignees y labels funcionan correctamente |
| CA-05 | `vikunja_users` se registra como tool disponible cuando el auth type es JWT |
| CA-06 | `vikunja_users` NO se registra cuando el auth type es API token |

---

## Riesgos

1. **JWT Expiración**: JWT expira (~24h). Sin refresh automático, el container necesita reinicio.
   - **Mitigación**: Documentar en README. Futuro: implementar refresh periódico.

2. **Rate Limiting en Login**: Si el login se intenta en cada request, puede causar rate limiting.
   - **Mitigación**: Login solo al inicio del container (ya está así).

3. **API Token como Fallback**: Si el login falla y se usa API token, assignees/labels seguirán fallando.
   - **Mitigación**: Log claro indicando las limitaciones.

---

## Archivos Afectados

- `src/index.js` — Cambios principales (auto-login logic)
- `PRD_AUTH_FIX.md` — Este documento
- `README.md` — Actualizar documentación de auth
- `.env.example` — Actualizar comentarios sobre JWT vs API token

---

## Referencias

- [go-vikunja/vikunja#266](https://github.com/go-vikunja/vikunja/issues/266) — Various API routes return 401 with valid token
- [go-vikunja/vikunja#399](https://github.com/go-vikunja/vikunja/issues/399) — API tokens return 401 for `/user/...` (closed as "not planned")
- `node_modules/vikunja-mcp/dist/auth/AuthManager.js` — Token type detection
- `node_modules/vikunja-mcp/dist/tools/users.js` — JWT check en línea 87
- `node_modules/vikunja-mcp/dist/tools/index.js` — Conditional tool registration línea 81
- `node_modules/vikunja-mcp/dist/utils/auth-error-handler.js` — Known issues documentation
- `node_modules/node-vikunja/dist/esm/services/task.service.js` — Retry logic con headers alternativos
