# Proposal: SDD + TDD Verification

## Estado

**Fecha**: 2026-03-28
**Problema**: Necesitamos verificar que SDD y TDD se usen correctamente y que todos los tests verifiquen requerimientos

---

## Problema

1. **SDD**: ¿Se usa correctamente para todos los cambios?
2. **TDD**: ¿Los tests verifican requerimientos y no implementación?
3. **Contract Test**: ¿Detecta gaps de mocks automáticamente?
4. **Tests existentes**: ¿Todos verifican requerimientos actuales?

---

## Análisis Requerido

### 1. SDD Usage

- ¿Todos los cambios pasan por SDD?
- ¿Los artifacts (proposal, spec, design, tasks) están actualizados?
- ¿El workflow se sigue?

### 2. TDD Usage

- ¿Los tests verifican requerimientos o implementación?
- ¿Hay tests que fallan por configuración y no por código?
- ¿Los tests son necesarios para el sistema?

### 3. Contract Test

- ¿El contract test funciona correctamente?
- ¿Detecta métodos faltantes?

### 4. Test Coverage

- ¿Qué tests verifican requerimientos actuales?
- ¿Cuáles son heredados y no necesarios?

---

## Scope

1. Audit de SDD en cambios recientes
2. Análisis de cada test que falla
3. Documentar uso de TDD
4. Verificar contract test
5. Recomendaciones

---

## Approach

1. Analizar artifacts de SDD existentes
2. Categorizar tests que fallan
3. Verificar contract test
4. Documentar hallazgos
5. Recomendaciones

---

## Success Criteria

- SDD documentado y usándose
- TDD documentado y entendiéndose
- Contract test funcionando
- Tests categorizados por tipo de requerimiento
