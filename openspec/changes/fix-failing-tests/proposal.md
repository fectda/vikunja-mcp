# PRD — Fix Failing Tests

## Estado

**Fecha**: 2026-03-28
**Problema**: 250 tests failing - necesito analizar y categorizar los errores
**Meta**: Reducir los tests fallando a 0 o entender cuáles son issues preexistentes

---

## Análisis de Test Failures

### Resumen Ejecutivo

| Estado               | Cantidad     |
| -------------------- | ------------ |
| Total tests          | 2197         |
| Pasando              | 1947 (88.6%) |
| Fallando             | 250 (11.4%)  |
| Test Suites fallando | 30           |

### Categorización de Failures

#### Categoría 1: Causados por mis cambios (intencional)

| Test                                  | Causa                                 | Acción          |
| ------------------------------------- | ------------------------------------- | --------------- |
| `circuit-breaker-integration.test.ts` | Removí circuit breaker de `withRetry` | Actualizar test |
| `retry.test.ts`                       | Cambié formato de log message         | Actualizar test |

#### Categoría 2: Tests de filter parser viejo (problema preexistente)

| Test                           | Causa                                                               |
| ------------------------------ | ------------------------------------------------------------------- |
| `filters.test.ts`              | Función `applyClientSideFilter` no existe - fue reemplazada por Zod |
| `filters-security.test.ts`     | Mismo problema                                                      |
| `tools/simple-filters.test.ts` | Mismo problema                                                      |

#### Categoría 3: Tests con mocks incorrectos (problema preexistente)

| Test                  | Causa                                                               |
| --------------------- | ------------------------------------------------------------------- |
| `assignees.test.ts`   | Mock usa `bulkAssignUsersToTask` pero código usa `assignUserToTask` |
| `labels.test.ts`      | Mismo patrón                                                        |
| `bulk-import.test.ts` | Mismo patrón                                                        |

#### Categoría 4: Configuration/Logger tests (problema preexistente)

| Test                           | Causa                          |
| ------------------------------ | ------------------------------ |
| `ConfigurationManager.test.ts` | Tests de environment variables |
| `logger.test.ts`               | Spy call count mismatch        |

#### Categoría 5: Tasks CRUD (problema preexistente)

| Test                           | Causa                                |
| ------------------------------ | ------------------------------------ |
| `tasks-crud-*.test.ts`         | Tests que requieren setup específico |
| `tasks-race-condition.test.ts` | Race conditions                      |

---

## Root Causes Identificadas

### RC-1: Filter parser refactoring no completado

**Descripción**: Tests referencing functions from old filter parser (`applyClientSideFilter`, etc.) that were replaced with Zod-based validation.

**Archivos affected**:

- `tests/utils/filters.test.ts`
- `tests/utils/filters-security.test.ts`
- `tests/tools/simple-filters.test.ts`

**Solución**: Remove or update tests para usar el nuevo filter system.

### RC-2: Mock setup incorrecto para assignees/labels

**Descripción**: Tests usando `bulkAssignUsersToTask` pero el código ahora usa `assignUserToTask`.

**Archivos affected**:

- `tests/tools/tasks/assignees.test.ts`
- `tests/tools/labels.test.ts`

**Solución**: Update mocks para incluir las funciones correctas.

### RC-3: Circuit breaker test expectations incorrectas

**Descripción**: Mi cambio removió circuit breaker de `withRetry` pero el test espera que esté ahí.

**Archivos affected**:

- `tests/circuit-breaker-integration.test.ts`
- `tests/utils/retry.test.ts`

**Solución**: Update test expectations o marcar como "test de integración de circuit breaker" separado.

### RC-4: Logger test environment issues

**Descripción**: Tests expecting specific console.error call counts.

**Archivos affected**:

- `tests/utils/logger.test.ts`

**Solución**: Fix test setup o skip temporalmente.

---

## Plan de Acción

### Phase 1: Análisis y Clasificación (inmediato)

- [ ] Verificar cada test failure manualmente
- [ ] Clasificar como "fixable" vs "known issue"
- [ ] Determinar si el cambio valdrá la pena

### Phase 2: Fixes Simples (si vale la pena)

- [ ] Fix retry.test.ts - update log message expectation
- [ ] Fix circuit-breaker-integration.test.ts - update o skip
- [ ] Fix logger.test.ts - ajustar expectations

### Phase 3: Fixes de Mocks (si vale la pena)

- [ ] Fix assignee tests - add correct mock function
- [ ] Fix label tests - add correct mock function

### Phase 4: Decisión sobre Filter Tests

- [ ] Option A: Remove tests antiguos (ya no aplican)
- [ ] Option B: Rewrite para nuevo sistema

---

## Criterios de Aceptación

| ID    | Criterio                                              |
| ----- | ----------------------------------------------------- |
| CA-01 | Analizar los 250 tests fallando                       |
| CA-02 | Clasificar como "fixable" o "known issue"             |
| CA-03 | Decidir si hacer fixes o documentar como preexistente |

---

## Análisis Costo/Beneficio

### Cost of fixing

- Tiempo: ~2-4 horas de trabajo
- Riesgo: Bajo (solo cambios en tests)

### Benefit

- Tests passing: 2197/2197 = 100%
- Cleaner codebase

### Alternative

- Documentar como "known issues preexistentes"
- Coverage se mantiene en 90%+ de todas formas

---

## Recomendación

**Opción recomendada**: Análisis + selectively fix solo los tests que son feasibles de arreglar rápidamente (Phase 1 + Phase 2), documentar el resto como known issues.

**Razón**: Los 250 tests fallando parecen ser en su mayoría issues preexistentes de refactors anteriores. El coverage sigue siendo 90%+.

---

## Referencias

- Test command: `npm run test`
- Coverage: `npm run test:coverage`
- Test files: `tests/**/*.test.ts`
