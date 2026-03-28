# PRD — Fix Completo: Vikunja Authentication & Assignee/Label Operations

## Estado

**Fecha**: 2026-03-27
**Prioridad**: 🔴 CRITICAL — Operaciones básicas de asignación no funcionan

## Problema Resumido

El MCP server "responde que sí pero no hace nada" — las operaciones de asignar usuarios a tareas y aplicar labels no se persisten en Vikunja. El MCP devuelve éxito pero la API de Vikunja rechaza la operación silenciosamente.

## Root Causes (3 problemas entrelazados)

### RC-1: Auto-login JWT bloqueado por `VIKUNJA_API_TOKEN` existente

**Archivo**: `src/index.ts` línea 30
**Bug**:

```typescript
// BUG: condición !process.env.VIKUNJA_API_TOKEN previene JWT
if (process.env.VIKUNJA_USER && process.env.VIKUNJA_PASSWORD && !process.env.VIKUNJA_API_TOKEN && vikunjaUrl)
```

Cuando `.env` tiene AMBOS `VIKUNJA_API_TOKEN=tk_...` + `VIKUNJA_USER`/`VIKUNJA_PASSWORD`, el JWT nunca se genera. El token API (`tk_*`) se usa para todo, y Vikunja rechaza operaciones de assignees/labels con 401/403.

**Issues upstream**: [go-vikunja/vikunja#266](https://github.com/go-vikunja/vikunja/issues/266), [#399](https://github.com/go-vikunja/vikunja/issues/399) (cerrado como "not planned" — comportamiento intencional de Vikunja)

### RC-2: `withRetry` usa circuit breaker con nombre `'anonymous'` (bug de caching)

**Archivo**: `src/utils/retry.ts` línea 133
**Bug**:

```typescript
const breaker = createCircuitBreaker(operation, 'anonymous', opts);
```

`createCircuitBreaker` cachea por nombre. Usar `'anonymous'` significa que TODAS las llamadas a `withRetry` comparten el mismo circuit breaker, incluso con operaciones diferentes. El `volumeThreshold` de 5 puede causar que errores no se marquen como failures hasta el 5to intento.

### RC-3: JWT no se renueva y `refresh` es un no-op

**Archivo**: `src/tools/auth.ts` línea 92-103
**Bug**: `vikunja_auth.refresh` dice "tokens do not expire" — esto es falso. JWT expira en ~24h. No hay mecanismo para renovar el token sin reiniciar el container.

### RC-4: `assignUsers()` envuelve TODOS los errores perdiendo diagnóstico

**Archivo**: `src/tools/tasks/assignees/index.ts` línea 31-36
**Bug**:

```typescript
} catch (error) {
  throw new MCPError(ErrorCode.API_ERROR,
    `Failed to assign users to task: ${error instanceof Error ? error.message : String(error)}`);
}
```

Si el error original es un `MCPError(PERMISSION_DENIED)` con un mensaje claro, se pierde y se envuelve en un genérico "Failed to assign users". El usuario no sabe que es un problema de autenticación.

---

## Clasificación de Endpoints por Auth Type

### ✅ FUNCIONAN con API Token (`tk_*`)

| MCP Tool                              | Endpoint Vikunja                         | Método              | Descripción               |
| ------------------------------------- | ---------------------------------------- | ------------------- | ------------------------- |
| `vikunja_projects`                    | `/projects`, `/projects/{id}`            | GET/PUT/POST/DELETE | CRUD proyectos            |
| `vikunja_tasks` / `vikunja_task_crud` | `/projects/{id}/tasks`, `/tasks/{id}`    | GET/PUT/POST/DELETE | CRUD tareas               |
| `vikunja_tasks`                       | `/tasks/{id}/done`, `/tasks/{id}/undone` | POST                | Completar tarea           |
| `vikunja_labels`                      | `/labels`, `/labels/{id}`                | GET/PUT/POST/DELETE | CRUD etiquetas            |
| `vikunja_task_labels` (list)          | `/tasks/{id}/labels`                     | GET                 | Leer etiquetas            |
| `vikunja_task_assignees` (list)       | `/tasks/{id}/assignees`                  | GET                 | Leer assignees            |
| `vikunja_filters`                     | N/A (local)                              | —                   | Construir/validar filtros |

### ❌ REQUIEREN JWT (no funcionan con `tk_*`)

| MCP Tool                   | Endpoint Vikunja         | Método   | Descripción           |
| -------------------------- | ------------------------ | -------- | --------------------- |
| `vikunja_users` (current)  | `/user`                  | GET      | Usuario actual        |
| `vikunja_users` (search)   | `/users`                 | GET      | Buscar usuarios       |
| `vikunja_users` (settings) | `/user/settings/general` | GET/POST | Configuración usuario |

### ⚠️ FALLAN INTERMITENTEMENTE con API Token (Known Bug de Vikunja)

| MCP Tool                            | Endpoint Vikunja                 | Método | Error   |
| ----------------------------------- | -------------------------------- | ------ | ------- |
| `vikunja_task_assignees` (assign)   | `/tasks/{id}/assignees`          | PUT    | 401/403 |
| `vikunja_task_assignees` (assign)   | `/tasks/{id}/assignees/bulk`     | POST   | 401/403 |
| `vikunja_task_assignees` (unassign) | `/tasks/{id}/assignees/{userId}` | DELETE | 401/403 |
| `vikunja_task_labels` (apply)       | `/tasks/{id}/labels`             | PUT    | 401/403 |
| `vikunja_task_labels` (apply)       | `/tasks/{id}/labels/bulk`        | POST   | 401/403 |
| `vikunja_task_labels` (remove)      | `/tasks/{id}/labels/{labelId}`   | DELETE | 401/403 |

**Solución**: Usar JWT en lugar de API Token para estos endpoints.

---

## Requerimientos

### RF-01 — Auto-login JWT cuando hay credenciales (incluso con API Token)

**Prioridad**: CRITICAL

Eliminar la condición `!vikunjaApiToken` para que el auto-login JWT se ejecute siempre que haya `VIKUNJA_USER` + `VIKUNJA_PASSWORD`.

**Flujo**:

1. Si hay `VIKUNJA_USER` + `VIKUNJA_PASSWORD` → intentar login JWT
2. Si login JWT tiene éxito → usar JWT (sobreescribe `VIKUNJA_API_TOKEN`)
3. Si login JWT falla + hay `VIKUNJA_API_TOKEN` → fallback con warning
4. Si solo hay `VIKUNJA_API_TOKEN` → usar directamente con warning de limitaciones

**Archivos**: `src/index.ts`

### RF-02 — Fix del circuit breaker en `withRetry`

**Prioridad**: HIGH

Cambiar el nombre del circuit breaker de `'anonymous'` a un nombre único por operación, o desactivar el circuit breaker para operaciones de retry.

**Archivos**: `src/utils/retry.ts`

### RF-03 — Implementar `vikunja_auth.refresh` real

**Prioridad**: MEDIUM

El refresh debe:

1. Intentar `client.renewToken()` (endpoint `/user/token` POST)
2. Actualizar el token en el AuthManager y VikunjaClientFactory
3. Detectar el nuevo tipo de token (JWT vs API)

**Archivos**: `src/tools/auth.ts`, `src/auth/AuthManager.ts`

### RF-04 — Agregar login con credenciales al tool de auth

**Prioridad**: MEDIUM

Agregar subcommand `login` a `vikunja_auth` que permita login con usuario/contraseña desde el cliente MCP, obteniendo un JWT sin necesidad de reiniciar el server.

**Archivos**: `src/tools/auth.ts`

### RF-05 — Mejorar mensajes de error para auth failures

**Prioridad**: HIGH

Los errores de autenticación en assignees/labels deben ser específicos, no genéricos. El usuario debe saber inmediatamente que el problema es de autenticación y cómo resolverlo.

**Archivos**: `src/tools/tasks/assignees/index.ts`, `src/tools/tasks/labels/index.ts`

### RF-06 — Logging del tipo de auth al inicio

**Prioridad**: LOW

Loggear al inicio:

- Tipo de token siendo usado (JWT vs API Token)
- Fuente del token (auto-login, directo, fallback)
- Timestamp (para debugging de expiración)

**Archivos**: `src/index.ts`

---

## Resultados de Pruebas Actuales

Del archivo `docs/TEST_FAILURES.md`:

| Test                          | Error                                             | Causa                                           |
| ----------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| `tasks.create_with_assignees` | `Cannot read properties of null (reading 'code')` | Assignee endpoint 401/403 → response null       |
| `tasks.assign`                | `Cannot read properties of null (reading 'code')` | `/tasks/{id}/assignees/bulk` 401/403            |
| `tasks.list_assignees`        | `Internal Server Error`                           | `/tasks/{id}/assignees` 401/403                 |
| `tasks.unassign`              | `Cannot read properties of null (reading 'code')` | `/tasks/{id}/assignees/{userId}` DELETE 401/403 |
| `tasks.add_label`             | `labels: null`                                    | `/tasks/{id}/labels/bulk` 401/403               |

---

## Solución Detallada

### Cambio 1: `src/index.ts` — Auto-login siempre

```typescript
// ANTES (línea 30):
if (
  process.env.VIKUNJA_USER &&
  process.env.VIKUNJA_PASSWORD &&
  !process.env.VIKUNJA_API_TOKEN &&  // ← ESTA CONDICIÓN CAUSA EL BUG
  vikunjaUrl
)

// DESPUÉS:
if (process.env.VIKUNJA_USER && process.env.VIKUNJA_PASSWORD && vikunjaUrl) {
```

Y agregar fallback logging:

```typescript
if (data.token) {
  process.env.VIKUNJA_API_TOKEN = data.token;
  logger.info('✅ Auto-login JWT successful — full API access available');
} else {
  logger.warn('⚠️ Auto-login failed:', data.message || 'No token received');
  if (process.env.VIKUNJA_API_TOKEN) {
    logger.warn('📋 Falling back to API token — assignees/labels may not work');
  }
}
```

### Cambio 2: `src/utils/retry.ts` — Fix circuit breaker naming

```typescript
// ANTES:
const breaker = createCircuitBreaker(operation, 'anonymous', opts);

// DESPUÉS: Use a sequential name or disable circuit breaker for retry
const breaker = createCircuitBreaker(operation, `retry-op-${Date.now()}-${Math.random()}`, opts);

// O mejor: No usar circuit breaker para retry individual
// El circuit breaker es para proteger el servidor, no para retry de operaciones individuales
```

### Cambio 3: `src/tools/auth.ts` — Implementar refresh real

```typescript
case 'refresh': {
  const status = authManager.getStatus();
  if (!status.authenticated) {
    throw new MCPError(ErrorCode.AUTH_REQUIRED, 'Not authenticated. Connect first.');
  }

  try {
    const client = await getClientFromContext();
    const newToken = await client.renewToken();
    if (newToken.token) {
      authManager.connect(status.apiUrl!, newToken.token);
      logger.info('Token refreshed successfully');
    }
  } catch (error) {
    logger.error('Token refresh failed:', error);
    throw new MCPError(ErrorCode.API_ERROR, 'Token refresh failed. Please reconnect.');
  }
  break;
}
```

### Cambio 4: `src/tools/auth.ts` — Agregar login subcommand

```typescript
subcommand: z.enum(['connect', 'status', 'refresh', 'disconnect', 'login']),

case 'login': {
  if (!args.apiUrl || !args.username || !args.password) {
    throw new MCPError(ErrorCode.VALIDATION_ERROR,
      'apiUrl, username, and password are required for login');
  }

  const loginUrl = args.apiUrl.replace('/api/v1', '') + '/api/v1/login';
  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: args.username, password: args.password }),
  });

  const data = await response.json() as { token?: string; message?: string };
  if (!data.token) {
    throw new MCPError(ErrorCode.AUTH_REQUIRED,
      `Login failed: ${data.message || 'No token received'}`);
  }

  authManager.connect(args.apiUrl, data.token);
  // Reinicializar client factory con nuevo token
  if (clientFactory) {
    await clearGlobalClientFactory();
    const newFactory = await createVikunjaClientFactory(authManager);
    await setGlobalClientFactory(newFactory);
  }

  return { content: [{ type: 'text', text: '✅ Logged in successfully with JWT' }] };
}
```

### Cambio 5: `src/tools/tasks/assignees/index.ts` — Mejorar errores

```typescript
} catch (error) {
  // Preservar MCPError originales para no perder diagnóstico
  if (error instanceof MCPError) {
    throw error;
  }

  // Detectar errores de auth específicos
  if (isAuthenticationError(error)) {
    const authStatus = await getAuthStatus(); // verificar tipo de auth
    if (authStatus.authType === 'api-token') {
      throw new MCPError(ErrorCode.PERMISSION_DENIED,
        'Assignment failed: API tokens (tk_*) do not support assignee operations in Vikunja.\n' +
        'Solution: Connect with a JWT token (login with username/password) or enable auto-login:\n' +
        '  VIKUNJA_USER=your_user\n' +
        '  VIKUNJA_PASSWORD=your_password'
      );
    }
  }

  throw new MCPError(ErrorCode.API_ERROR,
    `Failed to assign users to task: ${error instanceof Error ? error.message : String(error)}`);
}
```

---

## Criterios de Aceptación

| ID    | Criterio                                                                             | Verificación                              |
| ----- | ------------------------------------------------------------------------------------ | ----------------------------------------- |
| CA-01 | Con `VIKUNJA_USER` + `VIKUNJA_PASSWORD` + `VIKUNJA_API_TOKEN`, el wrapper genera JWT | Verificar log "Auto-login JWT successful" |
| CA-02 | Con JWT, `vikunja_task_assignees assign` funciona y persiste                         | Asignar usuario, verificar en Vikunja UI  |
| CA-03 | Con JWT, `vikunja_task_labels apply` funciona y persiste                             | Aplicar label, verificar en Vikunja UI    |
| CA-04 | `vikunja_users` se registra cuando auth type es JWT                                  | Verificar tools disponibles               |
| CA-05 | `vikunja_users` NO se registra cuando auth type es API token                         | Verificar tools disponibles               |
| CA-06 | Con solo API token (sin credenciales), el error es claro y accionable                | Verificar mensaje de error                |
| CA-07 | `vikunja_auth.refresh` renueva el token exitosamente                                 | Llamar refresh, verificar nuevo token     |
| CA-08 | Tests existentes pasan sin regresiones                                               | `npm run test:coverage`                   |

---

## Riesgos

| Riesgo                          | Impacto                        | Mitigación                              |
| ------------------------------- | ------------------------------ | --------------------------------------- |
| JWT expira en ~24h              | Operaciones fallan sin warning | Log claro + implementar refresh (RF-03) |
| Rate limiting en login          | Login falla                    | Login solo al inicio (ya está así)      |
| Breaking change en API          | Compatibilidad                 | Mantener fallback a API token           |
| Circuit breaker fix rompe retry | Operaciones sin retry          | Tests unitarios de retry                |

---

## Archivos Afectados

| Archivo                                                  | Cambio                                       |
| -------------------------------------------------------- | -------------------------------------------- |
| `src/index.ts`                                           | RF-01: Auto-login condition, RF-06: Logging  |
| `src/utils/retry.ts`                                     | RF-02: Fix circuit breaker naming            |
| `src/tools/auth.ts`                                      | RF-03: Refresh real, RF-04: Login subcommand |
| `src/auth/AuthManager.ts`                                | RF-03: Método para actualizar token          |
| `src/tools/tasks/assignees/index.ts`                     | RF-05: Mejorar errores                       |
| `src/tools/tasks/assignees/AssigneeOperationsService.ts` | RF-05: Mejorar errores                       |
| `PRD_AUTH_FIX.md`                                        | Este documento                               |
| `README.md`                                              | Documentar JWT vs API token                  |

---

## Orden de Implementación

1. **RF-01** — Auto-login (resolverá el 90% del problema inmediatamente)
2. **RF-02** — Fix circuit breaker (prevenir comportamiento impredecible)
3. **RF-05** — Mejorar errores (mejor debugging)
4. **RF-06** — Logging (observabilidad)
5. **RF-03** — Refresh real (cuando JWT expire)
6. **RF-04** — Login subcommand (conveniencia)

---

## Referencias

- [go-vikunja/vikunja#266](https://github.com/go-vikunja/vikunja/issues/266) — Various API routes return 401 with valid token
- [go-vikunja/vikunja#399](https://github.com/go-vikunja/vikunja/issues/399) — API tokens return 401 for `/user/...`
- `src/index.ts` — Auto-login logic
- `src/utils/retry.ts` — Circuit breaker implementation
- `src/tools/auth.ts` — Auth tool
- `src/tools/tasks/assignees/` — Assignee operations
- `node_modules/node-vikunja/dist/esm/services/task.service.js` — Retry logic con headers alternativos
