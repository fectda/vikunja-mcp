# MD Files Organization

## Estructura de Documentación

```
vikunja-mcp/
├── README.md                 # README principal del proyecto
├── CLAUDE.md                 # Guía para Claude Code (antes AGENTS.md)
├── LICENSE
├── package.json
├── docs/                     # Documentación técnica
│   ├── ARCHITECTURE.md       # Arquitectura del sistema
│   ├── BREAKING_CHANGES.md  # Cambios que rompen compatibilidad
│   ├── CONFIGURATION.md     # Configuración
│   ├── RATE_LIMITING.md     # Rate limiting
│   ├── SECURITY_AUDIT_REPORT.md
│   ├── STORAGE.md           # Sistema de almacenamiento
│   ├── TECHNICAL_SPEC.md    # Especificación técnica
│   ├── ROADMAP.md           # Roadmap de desarrollo
│   ├── VIKUNJA_API_ISSUES.md # Issues de la API de Vikunja
│   ├── API_NOTES.md         # Notas de implementación
│   ├── CONFIGURATION_MIGRATION.md
│   ├── MCP-TEST-CHECKLIST.md
│   ├── OPOSSUM_MIGRATION.md
│   ├── BULK_OPERATIONS_PERFORMANCE_OPTIMIZATION.md
│   └── MD_FILES_ORGANIZATION.md  # Este archivo
├── openspec/                # SDD - Spec-Driven Development
│   ├── config.yaml
│   └── changes/
│       └── fix-auth-assignees/
│           ├── proposal.md
│           ├── specs.md
│           ├── design.md
│           ├── tasks.md
│           └── state.yaml
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── pull_request_template.md
└── (archivos de código)
```

## Archivos Movidos a docs/

Los siguientes archivos fueron movidos de la raíz a `docs/`:

| Archivo Original                          | Nueva Ubicación                           | Descripción                  |
| ----------------------------------------- | ----------------------------------------- | ---------------------------- |
| `PRD_AUTH_FIX.md`                         | `docs/AUTH_FIX_PRD.md`                    | PRD del fix de autenticación |
| `MCP_TEST_REQUIREMENTS.md`                | `docs/MCP_TEST_REQUIREMENTS.md`           | Requisitos de tests          |
| `MCP_VALIDATION_REPORT.md`                | `docs/MCP_VALIDATION_REPORT.md`           | Reporte de validación        |
| `MIGRATION_GUIDE.md`                      | `docs/MIGRATION_GUIDE.md`                 | Guía de migración            |
| `ARCHITECTURE_SIMPLIFICATION.md`          | `docs/ARCHITECTURE_SIMPLIFICATION.md`     | Resumen de refactoring       |
| `BUG_FIXES_DOCUMENTATION.md`              | `docs/BUG_FIXES.md`                       | Documentación de bugs        |
| `REFACTORING_SUMMARY.md`                  | `docs/REFACTORING_SUMMARY.md`             | Resumen de refactoring       |
| `SECURITY_IMPLEMENTATION.md`              | `docs/SECURITY_IMPLEMENTATION.md`         | Implementación de seguridad  |
| `SIMPLERESPONSE_MIGRATION_TEST_REPORT.md` | `docs/SIMPLERESPONSE_MIGRATION_REPORT.md` | Reporte de migración         |
| `TECH_DEBT.md`                            | `docs/TECH_DEBT.md`                       | Deuda técnica                |
| `TEST_BASELINE_ANALYSIS.md`               | `docs/TEST_BASELINE_ANALYSIS.md`          | Análisis de tests            |
| `TEST_FAILURES.md`                        | `docs/TEST_FAILURES.md`                   | Errores de tests             |
| `TEST_MAPPING_DOCUMENTATION.md`           | `docs/TEST_MAPPING.md`                    | Mapeo de tests               |
| `TYPE_SAFETY_FIXES_SUMMARY.md`            | `docs/TYPE_SAFETY_FIXES.md`               | Resumen de tipos             |

## Convenciones

1. ** CLAUDE.md** - Nombre correcto para guía de Claude Code (no AGENTS.md)
2. ** docs/** - Toda la documentación técnica
3. ** openspec/** - Solo artefactos SDD activos
4. ** .github/** - Templates de GitHub (no mover)

## Fecha de Organización

2026-03-28
