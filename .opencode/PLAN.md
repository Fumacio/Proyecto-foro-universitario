# PLAN MAESTRO — Foro Universitario UTN FRT

> **Regla de oro:** Una cosa a la vez. Nada entra al plan sin decisión explícita registrada acá.
> Cada ítem tiene: `Por qué`, `Qué implica`, `Decisión` (PENDIENTE / ACEPTADO / RECHAZADO / HECHO).

---

## Contexto (entrevista Fase 0 — COMPLETADA)

- **Tipo de proyecto:** Portfolio + eventualmente herramienta real para UTN FRT.
- **Deadline:** No hay. Calidad > velocidad.
- **Usuarios finales:** Alumnos y profesores de la UTN FRT (Tucumán), público abierto cuando salga.
- **Entorno objetivo:** Producción pública (deploy pendiente de definir dónde).
- **Stack actual:** Node + Express 5 (CommonJS, JS), MySQL, Front vanilla HTML/JS.
- **Estado:** funcional básico (auth, posts, comentarios, votos, tags, reportes, bans, admin, perfil).

### Definición de "terminado" (criterio de cierre del proyecto)

1. Cualquier alumno/profesor puede registrarse y publicar (ideas, apuntes, clases, temas de parcial, opiniones, preguntas).
2. Grupo de admins puede moderar (reportes, bans) cuando hay problemas.
3. Anda correctamente en uso real (sin errores tontos, flujos completos).
4. **Muy buena seguridad** (prioridad explícita del dueño).
5. **Vista atractiva e inspirada en foros tipo Reddit** (prioridad explícita del dueño).
6. Que sea **útil, segura y libre**.

### Prioridades explícitas del dueño (orden importa)

1. Seguridad robusta.
2. Mejora visual del frontend (atractiva, estilo Reddit si hace falta).
3. Que funcione bien de punta a punta.
4. Que el código sea presentable (es portfolio).

---

## FASE 0 — Entrevista de descubrimiento (COMPLETADA)

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 0.1 | ¿Qué es el proyecto? | Portfolio, con vocación de uso real en UTN FRT. |
| 0.2 | ¿Fecha límite? | No hay. |
| 0.3 | ¿Quién lo usa? | Público: alumnos y profesores de UTN FRT. |
| 0.4 | ¿Se publica? | Sí, quiere que salga a la luz y lo usen. |
| 0.5 | ¿Qué es "terminado"? | Ver checklist arriba. |
| 0.6 | ¿Qué molesta ya? | La vista; quiere algo atractivo tipo Reddit. |

---

## Candidatos a funcionalidad / mejora (banco de ideas)

> Nada de esto está aceptado todavía. Se mueve a fase solo con decisión.

### A. Deuda de seguridad (ya detectada en README + skill)

| ID | Item | Por qué | Esfuerzo | Decisión |
|----|------|---------|----------|----------|
| SEC-01 | JWT con `expiresIn` | Tokens eternos = robo = acceso permanente | Bajo | **RECHAZADO** |
| SEC-02 | Validación de input (Zod) en auth/posts/comments | Datos basura, bugs, agujeros | Medio | **ACEPTADO** |
| SEC-03 | `helmet` + `compression` | Headers seguridad + perf | Bajo | **ACEPTADO** |
| SEC-04 | Jerarquía de errores (`AppError`) + handler global real | Hoy todo devuelve 500 | Medio | **ACEPTADO** |
| SEC-05 | Rotar secretos del `.env` commiteado | Ya comprometido en historial Git | Bajo | **ACEPTADO** |
| SEC-06 | Sanitizar logs (no loguear `err` completo en prod) | Fuga de queries/paths en logs | Bajo | **ACEPTADO** |

### B. Calidad de código / arquitectura (skill nodejs-backend-patterns)

| ID | Item | Por qué | Esfuerzo | Decisión |
|----|------|---------|----------|----------|
| ARC-01 | Capa `services/` + `repositories/` | Controllers mezclan negocio + SQL | Alto | **ACEPTADO** (siguiente tras SEC) |
| ARC-02 | `asyncHandler` / quitar try/catch repetido | Menos ruido, errores centralizados | Bajo | **ACEPTADO** |
| ARC-03 | Logging estructurado (Pino) | Observabilidad real | Medio | **DUDANDO** (el dueño no está seguro) |
| ARC-04 | Graceful shutdown (SIGINT/SIGTERM + pool.end) | No cortar conexiones a medias | Bajo | **ACEPTADO** |
| ARC-05 | Migrar a TypeScript | Tipos | Muy alto | **RECHAZADO** — proyecto personal chico, solo JS |
| ARC-06 | Dependency Injection | Testing más fácil | Medio | **PENDIENTE** (no se decidió aún) |

### C. Testing

| ID | Item | Por qué | Esfuerzo | Decisión |
|----|------|---------|----------|----------|
| TST-01 | Tests de integración de rutas críticas (auth, posts) | Regresiones silenciosas | Medio | **ACEPTADO** |
| TST-02 | Cobertura mínima configurada (jest config) | Saber si estamos cubriendo algo | Bajo | **ACEPTADO** |

### D. Funcionalidades de producto (nuevas, NO mejoras)

| ID | Item | Por qué podríamos quererlo | Esfuerzo | Decisión |
|----|------|---------------------------|----------|----------|
| FEAT-01 | Paginación / búsqueda mejorada | Ya existe parcial; refinar | Bajo-Medio | **ACEPTADO** |
| FEAT-02 | Notificaciones + campana (mini menú estilo Facebook) | El dueño la pidió explícitamente | Alto | **ACEPTADO** — pero va en fase de producto, no ahora |
| FEAT-03 | Edición/eliminación de comentarios con permisos | Esperable en cualquier foro | Medio | **ACEPTADO** |
| FEAT-04 | Dark mode / mejora visual frontend | El dueño la pidió pero **para el final** | Medio | **ACEPTADO — ORDEN: ÚLTIMO** |
| FEAT-05 | Markdown en posts | Útil para apuntes; sin decidir | Medio | **PENDIENTE** |
| FEAT-06 | Refresh tokens (access 15m + refresh 7d) | Explicado al dueño; sin decidir | Medio | **PENDIENTE** |

---

## Fases propuestas (ordenado por PRIORIDADES DEL DUEÑO)

```
FASE 0  Entrevista y criterio de "terminado"          [HECHA]
FASE 1  SEGURIDAD base — SEC-02/03/04/05/06           [COMPLETADA ✅]
        (SEC-01 rechazado; el dueño prueba antes de abrir Fase 2)
FASE 2  VISTA — rediseño atractivo estilo Reddit      [siguiente — a la espera del dueño]
FASE 3  ARQUITECTURA — ARC-01 (services/repos)        [después de que el dueño pruebe Fase 2]
        ARC-02, ARC-04 aceptados (van en su momento)
        ARC-03 dudando; ARC-05 rechazado; ARC-06 sin decidir
FASE 4  ROBUSTEZ — TST-01 + TST-02                    [aceptados]
FASE 5  PRODUCTO — FEAT-01, FEAT-03 (útiles ya)
        FEAT-02 (campana notifs) cuando el dueño diga
        FEAT-04 (dark mode/visual) ÚLTIMO por decisión del dueño
        FEAT-05, FEAT-06 pendientes de decisión
FASE 6  LANZAMIENTO (deploy, dominio, monitoreo)      [por definir]
```

**Regla de avance:** El dueño prueba después de cada fase antes de abrir la siguiente.

---

## Registro de decisiones

| Fecha | Decisión | Por qué |
|-------|----------|---------|
| 2026-09-22 | Proyecto = portfolio + uso real UTN FRT, sin deadline, público | Entrevista Fase 0 |
| 2026-09-22 | Prioridad 1 = seguridad, Prioridad 2 = vista Reddit, Prioridad 3 = robustez | Dueño explícito |
| 2026-09-22 | Features nuevas (FEAT-0x) quedan FUERA por defecto hasta que un usuario las pida | Regla "no hacer la app al azar" |
| 2026-09-22 | Fase 0 cerrada; se abre entrevista de Fase 1 (seguridad base) | Siguiente paso |
| 2026-09-22 | SEC-01 RECHAZADO | Dueño decidió no poner expiración a JWT por ahora |
| 2026-09-22 | SEC-03 ACEPTADO (helmet + compression) | Quick win, bajo riesgo |
| 2026-09-22 | SEC-05 ACEPTADO (rotar secretos) | Secretos ya comprometidos en Git |
| 2026-09-22 | SEC-06 ACEPTADO (sanitizar logs) | Evita fuga de info en producción |
| 2026-09-22 | SEC-02 ACEPTADO (validación Zod) | Dueño |
| 2026-09-22 | SEC-04 ACEPTADO (errores tipados) | Dueño |
| 2026-09-22 | ARC-01 ACEPTADO (services/repositories) | Dueño — va después de SEC |
| 2026-09-22 | ARC-02 ACEPTADO (asyncHandler) | Dueño |
| 2026-09-22 | ARC-04 ACEPTADO (graceful shutdown) | Dueño |
| 2026-09-22 | ARC-05 RECHAZADO (TypeScript) | Dueño: proyecto personal chico, solo JS |
| 2026-09-22 | ARC-03 DUDANDO (Pino) | Dueño no está seguro aún |
| 2026-09-22 | ARC-06 SIN DECIDIR (DI) | No se preguntó aún |
| 2026-09-22 | TST-01, TST-02 ACEPTADOS | Dueño |
| 2026-09-22 | FEAT-01 ACEPTADO (paginación/búsqueda) | Dueño |
| 2026-09-22 | FEAT-02 ACEPTADO (campana notifs estilo FB) | Dueño la pidió; fase de producto |
| 2026-09-22 | FEAT-03 ACEPTADO (editar/borrar comentarios) | Dueño |
| 2026-09-22 | FEAT-04 ACEPTADO pero ORDEN: ÚLTIMO | Dueño: "ahora no, va para el último" |
| 2026-09-22 | FEAT-05 PENDIENTE (markdown) | Dueño: "no sé si va" |
| 2026-09-22 | FEAT-06 PENDIENTE (refresh tokens) | Pendiente de explicación al dueño |
| 2026-09-22 | Se ejecuta FASE 1 (SEC-02/03/04/05/06) de una; el dueño prueba al final | Dueño: "primero haz las sec" |
| 2026-09-22 | **FASE 1 COMPLETADA** — todos los SEC hechos y verificados | Tests 22/22 + smoke HTTP OK |
| 2026-09-22 | Fix post-SEC-05: `.env` con path absoluto + fail-fast DB + auto-logout front en 401 de token | Token viejo tras rotar secret confundía al dueño |

---

## Estado de FASE 1 (Seguridad base) — COMPLETADA ✅

| Ítem | Estado |
|------|--------|
| SEC-01 — JWT expiresIn | ❌ RECHAZADO |
| SEC-02 — Validación input (Zod) | ✅ HECHO — middleware `validate` + schemas en `Back/schemas/` enganchados en los 10 routers |
| SEC-03 — helmet + compression | ✅ HECHO — instalados y montados en `server.js` |
| SEC-04 — Errores tipados (AppError) | ✅ HECHO — `Back/utils/errors.js` + `errorHandler` global |
| SEC-05 — Rotar secretos | ✅ HECHO — `JWT_SECRET` nuevo, `.env.example` creado, `.gitignore` ok |
| SEC-06 — Sanitizar logs | ✅ HECHO — `errorHandler` + `sendError` según `NODE_ENV` |

**Verificación:** `npm test` → 22/22 ✅ · server arranca ✅ · smoke test HTTP de validación → 400 correctos ✅

**Regla de la fase:** El dueño prueba TODO junto al terminar. Si algo se rompe, se arregla antes de abrir Fase 2.

---

## Changelog del plan

- v0.1 — Esqueleto creado, entrevista Fase 0 abierta.
- v0.2 — Fase 0 completada; prioridades y fases reordenadas; se abre Fase 1.
- v0.3 — Todas las decisiones del banco registradas (SEC/ARC/TST/FEAT). Fase 1 en ejecución.
- v0.4 — Explicación FEAT-06 pendiente de respuesta del dueño.
- v0.5 — **FASE 1 completada** (SEC-02/03/04/05/06). A la espera de que el dueño pruebe antes de abrir Fase 2 (vista Reddit).
