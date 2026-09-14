---
name: spec-impl-game
description: Implementa una spec de juego aprobada exactamente igual que /spec-impl, y al terminar encadena skin-designer y, solo cuando ese termine, mobile-porter sobre el juego implementado — secuencial, nunca en paralelo.
disable-model-invocation: true
argument-hint: <NN-juego-slug>
allowed-tools: Read, Glob, Grep, Edit, Write, Task, Agent, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*), Bash(date:*)
---

# /spec-impl-game — Implementador de specs de juego + post-proceso

## Contexto de sesión

Estado actual del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles en esta carpeta:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

Config de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, sin archivo de config)"`

Catálogo actual de motores:
!`ls lib/games/ 2>/dev/null`

---

## Instrucciones

### Fases 1 a 4 — idénticas a `/spec-impl`

Antes de hacer nada más, lee completo `.claude/skills/spec-impl/SKILL.md` con la tool `Read`
y ejecuta sus Fases 1, 2, 3 y 4 al pie de la letra, sin reinterpretarlas ni resumirlas de
memoria: identificar la spec, validar que el estado significa "Aprobado" (en cualquier
idioma), crear o cambiar de rama, mostrar el resumen de la spec (objetivo, alcance, plan de
implementación, criterios de aceptación), e implementar paso a paso con pausas para revisar
cada diff. `$ARGUMENTS` es el argumento que recibe ese flujo completo.

Las mismas reglas duras de `/spec-impl` aplican sin excepción: **nunca commitear
automáticamente**, ni por paso ni al final; nunca improvisar ante una ambigüedad que la
spec no resuelve (deténte, describe la ambigüedad, presenta opciones, espera la decisión);
nunca salirte del alcance de la spec.

Si la Fase 2 de `/spec-impl` determina que el estado **no** significa "Aprobado", el
bloqueo es intencional: muestra el mismo mensaje de error estándar y **detente ahí**. No
llegues nunca a la Fase 5 de este skill sin haber completado las cuatro fases anteriores.

**Nota de alcance:** además de `specs/NN-*.md`, este comando acepta specs de juego bajo
`specs/game-jam/<game-id>/` (borradores producidos por el agente `game-jam`). La validación
de estado de la Fase 2 aplica igual — un borrador que no está en estado "Aprobado" no se
implementa, sin importar en qué carpeta viva.

La única diferencia real con `/spec-impl` es que el mensaje de cierre de su Fase 4
(`✅ All steps of the plan are implemented...`) **no termina la corrida aquí**: continúa
inmediatamente en la Fase 5 de abajo.

---

### Fase 5 — Post-proceso: skin-designer → mobile-porter (secuencial)

Esta fase solo se alcanza si las Fases 1-4 completaron todos los pasos del plan de
implementación. Todo lo que sigue se hace en español, como el resto del repo.

#### 5.0 — Resolver el juego objetivo

Extrae el `id` de catálogo del juego que acaba de implementarse a partir de la spec (el
encabezado de las specs de juego lo nombra explícitamente, p. ej. `SPEC 09 — Juego de Snake
real para la ficha \`serpentina\``→`id`=`serpentina`). Verifica ese `id`contra`lib/games.ts`y contra el mapa`ENGINES`en`app/juego/[id]/jugar/page.tsx`para confirmar
que existe y que ahora tiene un`engine` real asociado.

- Si la spec no identifica un juego único, o el `id` no aparece en el catálogo, o no queda
  claro qué `engine` le corresponde: **detente y pregunta** cuál es. Ni `skin-designer` ni
  `mobile-porter` eligen el juego por su cuenta — tampoco lo hace este comando.
- Si la spec implementada no era la de un juego (no añadió ningún motor jugable — por
  ejemplo, tocó plataforma, Supabase o UI general en vez de un `lib/games/<engine>/`),
  dilo explícitamente y termina aquí sin lanzar ningún agente. `spec-impl-game` es solo
  para specs de juego; una spec de plataforma se implementa con `/spec-impl` a secas.

#### 5.1 — Confirmación única

Antes de lanzar cualquier agente, muestra:

```
✅ Todos los pasos del plan están implementados.

Juego detectado:  <título> (`<id>`, engine `<engine>`)
Post-proceso:     1) skin-designer  →  2) mobile-porter   (secuencial, nunca en paralelo)

¿Lanzo el post-proceso? Recuerda verificar los criterios de aceptación de la
spec y hacer tú el commit final — yo no commiteo en ningún punto de este flujo.
```

Espera una confirmación explícita ("sí", "dale", "adelante" o equivalente) con
`AskUserQuestion` o esperando la respuesta del usuario. Si la respuesta es "no" o
equivalente, termina la corrida limpiamente: recuerda que ambos agentes se pueden invocar
después a mano (`@skin-designer <id>`, luego `@mobile-porter <id>`) cuando el usuario quiera.

#### 5.2 — Lanzar `skin-designer`, solo

Lanza **una única** invocación de agente con `subagent_type: "skin-designer"`, pasándole
el `id` de catálogo (y el título, como referencia) del juego resuelto en 5.0. Es la misma
convención de entrada que documenta `.claude/agents/skin-designer.md`: un `id` o nombre
reconocible del catálogo, nunca el engine key.

**Regla dura, sin excepciones:** esta es la única llamada a agente en este paso. Nunca la
combines en el mismo bloque de tool calls con el lanzamiento de `mobile-porter` — deben
quedar en turnos de tool-call separados porque el segundo depende del resultado del primero.

Espera a que `skin-designer` termine y lee su reporte completo antes de continuar. Resume
al usuario qué skins quedaron (`neon`, `retro`, `clasico`) y qué archivos tocó
(`lib/games/<engine>/engine.ts`, `app/_components/games/<engine>-game.tsx`,
`references/game-with-themes.md`).

Si `skin-designer` se detuvo pidiendo algo (juego ambiguo, error de build, etc.) en vez de
completar su trabajo, **no continúes a 5.3**: reporta lo que dijo y espera instrucciones del
usuario.

#### 5.3 — Lanzar `mobile-porter`, después

Solo una vez que 5.2 devolvió un reporte de trabajo completado, lanza una **única**
invocación de agente con `subagent_type: "mobile-porter"`, con el mismo `id` de catálogo.

`mobile-porter` puede legítimamente responder que el juego "ya está portado" o que "no
tiene motor" — eso es un resultado válido de su Fase 2 de clasificación, no un error de
este flujo; repórtalo tal cual. Si en cambio se detiene pidiendo aclarar el juego (no
debería, ya que 5.0 lo resolvió sin ambigüedad), repórtalo y espera.

#### 5.4 — Cierre

Cuando ambos agentes terminaron (o se detuvieron con un motivo legítimo), da un resumen
final con: spec implementada y su ruta, rama activa, qué skins quedaron, el estado del port
táctil, y el recordatorio final de `/spec-impl`: verificar uno por uno los criterios de
aceptación de la spec, cambiar su estado a "Implementado" (o el equivalente) y hacer el
commit final antes de fusionar la rama — eso lo decide y lo ejecuta el usuario, no este
comando.

---

## Resumen del comportamiento esperado

```
/spec-impl-game 09-juego-snake   (estado: Aprobado)

  Fases 1-4  →  (delegadas a /spec-impl) crea/activa spec-09-juego-snake,
                muestra resumen, implementa paso a paso con pausas
  Fase 5.0   →  Detecta id `serpentina`, engine `snake`, confirmado en lib/games.ts
  Fase 5.1   →  Muestra confirmación única, espera el sí
  Fase 5.2   →  Lanza skin-designer(serpentina) — espera su reporte completo
  Fase 5.3   →  Solo entonces lanza mobile-porter(serpentina)
  Fase 5.4   →  Resumen final + recordatorio de verificar criterios y commitear

/spec-impl-game 02-powerups   (estado: Borrador)

  Fase 2 (delegada)  →  Lee el estado → "Borrador" → ❌ se detiene
                         Muestra el mensaje de error estándar de /spec-impl
                         No crea rama, no toca código, no llega a la Fase 5,
                         no lanza ningún agente
```

**Nunca** se lanza `skin-designer` y `mobile-porter` en la misma llamada ni en el mismo
bloque de tool calls: el segundo agente arranca únicamente después de leer el reporte del
primero.
