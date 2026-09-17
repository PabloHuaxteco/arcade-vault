# Memoria del agente `security-auditor`

Archivo de memoria persistente del subagente `security-auditor` (`.claude/agents/security-auditor.md`).
Lo lee al arrancar cada ronda y lo actualiza al terminar. No editar a mano salvo para corregir
un estado (por ejemplo, marcar `Resuelto` un hallazgo que ya se arregló en otra spec).

## Última auditoría

_(vacío — ninguna ronda ejecutada todavía)_

## Hallazgos

| Fecha | Área | Severidad | Hallazgo | Estado | Nota |
| ----- | ---- | --------- | -------- | ------ | ---- |

Áreas: `BD` (base de datos / Supabase) · `App` (Next.js / código) · `Deps` (dependencias npm).
Estados: `Abierto` · `Resuelto` · `Aceptado` · `Diferido`.

- `Aceptado`: riesgo conocido que el usuario decidió no mitigar (queda documentado con su razón
  en la columna Nota); el agente no lo vuelve a levantar como hallazgo nuevo en rondas futuras.
- `Diferido`: mitigación pospuesta por una razón externa objetiva (por ejemplo, requiere un plan
  de pago de Supabase) — se revisa cuando esa condición cambie, no en cada ronda.

## Verificaciones manuales

Puntos que viven en el panel de Supabase Auth y no son inspeccionables por SQL ni por el MCP:
longitud mínima de contraseña, protección de contraseñas filtradas (HaveIBeenPwned), límite de
registros por IP. Cada fila registra cuándo se confirmó a mano por última vez.

| Fecha | Qué se verificó (panel de Supabase) | Resultado |
| ----- | ------------------------------------ | --------- |

## Criterios aprendidos

- (riesgos que el usuario aceptó explícitamente en rondas anteriores, o preferencias sobre qué
  auditar con más o menos énfasis)
