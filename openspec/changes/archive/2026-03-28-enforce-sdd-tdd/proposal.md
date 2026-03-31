# Proposal: Enforce SDD + TDD in Project

## Estado

**Fecha**: 2026-03-28
**Objetivo**: Forzar el uso de SDD y TDD en el proyecto

---

## Problema

1. **SDD** no está documentado como requerido en AGENTS.md
2. **TDD** no está enforced - tests se escriben después del código
3. No hay proceso claro para desarrollo guiado por specs y tests

---

## Análisis

### Estado Actual

| Práctica      | Estado                   | Problema                   |
| ------------- | ------------------------ | -------------------------- |
| SDD           | Configurado en openspec/ | No está enforced           |
| TDD           | Mentioned en CLAUDE.md   | No se usa consistentemente |
| Contract Test | Working                  | No está documentado        |

### Impacto

- Cambios no documentados consistentemente
- Tests pueden no verificar requerimientos
- Tests heredados que fallan no se limpian

---

## Solución Propuesta

### 1. Renombrar CLAUDE.md → AGENTS.md

- Archivo existe pero tiene otro nombre según convenciones

### 2. Agregar SDD Requirements

- Todo cambio sustancial requiere artifacts SDD
- Usar openspec para artifacts

### 3. Agregar TDD Requirements

- Tests primero (RED → GREEN → REFACTOR)
- Usar `npm run test:watch` para desarrollo

### 4. Agregar Contract Test

- `npm run test:contract` debe pasar
- Detecta gaps en mocks automáticamente

---

## Scope

1. Renombrar archivo
2. Agregar SDD workflow
3. Agregar TDD workflow
4. Agregar Contract Test
5. Documentar en AGENTS.md

---

## Approach

1. Crear proposal
2. Crear spec
3. Crear design
4. Implementar cambios
5. Verificar
6. Archivar

---

## Success Criteria

- AGENTS.md tiene SDD y TDD documentados
- Todos los cambios usan SDD
- Todos los cambios usan TDD
- Contract test pasa
