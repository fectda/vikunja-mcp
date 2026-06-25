# PRD: Análisis de Restauración de Funcionalidad

## Estado

**Fecha**: 2026-03-28
**Objetivo**: Documentar cambios de código no sincronizados con tests y analizar costos/beneficios de restauración

---

## Resumen Ejecutivo

Se identificaron **203 tests fallando** debido a cambios en código fuente no sincronizados. Estos cambios pueden clasificarse en:

| Categoría                            | Cantidad Tests | Justificación Documentada      |
| ------------------------------------ | -------------- | ------------------------------ |
| Cambios documentados (Filters Zod)   | ~20            | ✅ Sí (REFACTORING_SUMMARY.md) |
| Cambios no documentados (Config)     | ~16            | ❌ No                          |
| Cambios menores (formatos, mensajes) | ~170           | ❓ Ambiguo                     |

---

## Componente 1: ConfigurationManager

### Estado Actual

```typescript
// src/config/ConfigurationManager.ts:219-222
private loadFromEnvironmentVariables(): Partial<ApplicationConfig> {
  // AORP requires direct configuration - no backward compatibility
  return {};
}
```

###Documentación Existente

- **CONFIGURATION_MIGRATION.md**: Planea migración gradual CON backward compatibility
- Línea 163-172 del doc: Mapeo de 33 variables de entorno
- Línea 160: "All existing environment variables continue to work"

### Contradicción

| Lo que dice la docs           | Lo que hace el código             |
| ----------------------------- | --------------------------------- |
| "Backward compatibility"      | `return {}` (sin compatibilidad)  |
| Mapeo de 33 vars              | No carga ninguna                  |
| "Migration timeline 20 hours" | Cambio implementado sin migración |

### Tests Afectados (16)

```
ConfigurationManager.test.ts:
- should load authentication configuration from environment variables
- should load logging configuration from environment variables
- should load rate limiting configuration from environment variables
- should load feature flags from environment variables
- should apply development environment profile
- should apply test environment profile
- should apply production environment profile
- should allow environment variables to override profile defaults
- should parse boolean values correctly
- should parse integer values correctly
- should preserve string values when not numeric or boolean
- should reject invalid log levels
- should return auth configuration section
- should return logging configuration section
- should return rate limiting configuration section
```

### Análisis de Opciones

| Opción                    | Beneficio                | Costo   | Riesgo                        |
| ------------------------- | ------------------------ | ------- | ----------------------------- |
| **A) Restaurar env vars** | Tests pasan,文档一致     | 4 horas | Bajo - solo revive código     |
| **B) Actualizar tests**   | Docs quedan igual        | 2 horas | Medio - oculta intención real |
| **C) Actualizar docs**    | Código coincide con docs | 1 hora  | Alto - rompe expectativas     |

### Recomendación: **OPCION A**

El código contradice la documentación existente. La restauración revive la funcionalidad promiseida.

---

## Componente 2: Filter System (Zod Migration)

### Estado Actual

- Sistema completo migrado a Zod validation
- Parser personalizado eliminado (850+ líneas removidas)
- Mensajes de error diferentes

### Documentación

- **REFACTORING_SUMMARY.md**: "95 out of 101 filter tests pass"
- "6 failing tests test implementation details, not core functionality"

### Tests Afectados (~20)

```
filters.test.ts:
- should reject non-boolean values for done field
- should reject expressions with too many conditions
- should handle custom max conditions
- should convert multiple condition group to string
- should convert expression to string

filters-security.test.ts:
- should accept filter strings at the length limit
- should reject filter strings with script injection attempts
- should accept valid international characters
- etc.
```

### Cambios de Comportamiento Identificados

| Antes (Custom)               | Ahora (Zod)                                 |
| ---------------------------- | ------------------------------------------- |
| Error: "Too many conditions" | Error diferente                             |
| "Invalid filter syntax"      | "Filter string contains invalid characters" |
| `\|\|` para OR               | `OR` para OR                                |
| `(cond && cond)`             | `cond && (cond \|\| cond)`                  |

### Análisis de Opciones

| Opción                  | Beneficio                      | Costo       | Riesgo                 |
| ----------------------- | ------------------------------ | ----------- | ---------------------- |
| **A) Restaurar parser** | Tests pasan                    | 850+ líneas | Alto - revierte mejora |
| **B) Actualizar tests** | Documenta nuevo comportamiento | 4 horas     | Bajo                   |
| **C) Híbrido**          | Mantener ambos parsers         | 20+ horas   | Alto                   |

### Recomendación: **OPCION B**

El cambio está justificado y documentado. Los tests deben actualizarse al nuevo comportamiento.

---

## Componente 3: Logger

### Estado Actual

- El logger usa placeholders (`%s`, `%d`) en lugar de strings reemplazados
- Tests esperan strings remplazados

### Tests Afectados (8)

```
logger.test.ts:
- should default to INFO level when no environment variables are set
- should respect LOG_LEVEL environment variable
- should handle all log levels correctly
```

### Error Específico

```
Expected: "[INFO] test info"
Received: "[INFO] test %s"
```

### Análisis de Opciones

| Opción                | Beneficio      | Costo   | Riesgo |
| --------------------- | -------------- | ------- | ------ |
| **A) Cambiar tests**  | Código estable | 1 hora  | Bajo   |
| **B) Cambiar logger** | Mejora logging | 2 horas | Medio  |

### Recomendación: **OPCION A**

El código funciona correctamente, solo los tests esperan formato diferente.

---

## Componente 4: Retry Utility

### Estado Actual

- Usa placeholders para mensajes de debug

### Tests Afectados (1)

```
retry.test.ts:
- should calculate exponential backoff correctly
```

### Error Específico

```
Expected: "Retry attempt 1/"
Received: "Retry attempt %d/%d after %dms"
```

### Recomendación: **OPCION A**

Igual que Logger - cambiar tests.

---

## Componente 5: Input Sanitization

### Estado Actual

- `sanitizeString()` ya no lanza para ciertos inputs
- El test espera que lance

### Tests Afectados (1)

```
input-sanitization.test.ts:
- should block boolean-based SQL injection
```

### Análisis

Los tests esperan que `sanitizeString()` lance para "SQL injection" pero ahora:

- El código acepta el input
- La validación ocurre en otro lugar (Zod)

### Recomendación: **Investigar**

Possible cambio de arquitectura de validación que necesita revisión.

---

## Componente 6: Mocks en Tests Individuales

### Estado Actual

- ~170 tests fallan por mocks locales incompletos
- El contract test detecta esto automáticamente

### Ejemplo

```typescript
// tests/tools/tasks.test.ts
const mockClient = {
  tasks: {
    // Falta: assignUserToTask, addLabelToTask, etc.
  },
};
```

### Recomendación: **AUTOMATICO**

El contract test ya detecta esto. Los desarrolladores deben agregar métodos faltantes cuando el contract test falle.

---

## Resumen de Recomendaciones

| #   | Componente           | Recomendación            | Horas Estimadas |
| --- | -------------------- | ------------------------ | --------------- |
| 1   | ConfigurationManager | Restaurar env vars       | 4               |
| 2   | Filter System        | Actualizar tests         | 4               |
| 3   | Logger               | Actualizar tests         | 1               |
| 4   | Retry                | Actualizar tests         | 0.5             |
| 5   | Input Sanitization   | Investigar               | 2               |
| 6   | Mocks (automático)   | Contract test ya detecta | 0               |

**Total estimado: 11.5 horas**

---

## Plan de Acción

### Fase 1: Restaurar ConfigurationManager (4h)

1. Implementar carga de variables de entorno
2. Agregar mapeo de 33 vars documentado
3. Verificar 16 tests pasan

### Fase 2: Actualizar Tests de Filters (4h)

1. Actualizar assertions de mensajes de error
2. Verificar ~20 tests pasan

### Fase 3: Fixes Menores (1.5h)

1. Logger: actualizar assertions
2. Retry: actualizar assertions

### Fase 4: Investigar (2h)

1. Input Sanitization: determinar si es bug o cambio intencional

---

## Preguntas Pendientes

1. **Input Sanitization**: ¿Por qué `sanitizeString()` ya no lanza para SQL injection patterns?
2. **AORP**: ¿El comentario "AORP requires direct configuration" es una decisión de producto o implementación?
3. **Filters**: ¿El cambio de `||` a `OR` es intencional o bug?

---

## Métricas Objetivo

| Métrica       | Actual            | Objetivo         |
| ------------- | ----------------- | ---------------- |
| Tests pasando | 1965/2168 (90.6%) | 2168/2168 (100%) |
| Contract test | ✅ PASS           | ✅ PASS          |
| TypeScript    | ✅ PASS           | ✅ PASS          |
| ESLint        | 5 errors          | 0 errors         |

---

## Firmas de Aprobación

- [ ] **Technical Lead**: ******\_\_\_******
- [ ] **Product Owner**: ******\_\_\_******
- [ ] **Fecha**: ******\_\_\_******
