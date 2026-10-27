# Plan de reconstrucción — Foro UTN v2

## Objetivo
Rehacer el foro desde cero con un stack moderno, un diseño actual (claro/oscuro, responsive,
mobile-first) y las funciones que se esperan de un foro hoy, dejándolo **listo para usar**
con un solo comando y datos de ejemplo.

## Stack
| Capa | Elección | Por qué |
|------|----------|---------|
| Front | **React 19 + Vite 7 + TypeScript** | SPA rápida, DX excelente |
| Estilos | **Tailwind CSS v4** + Radix UI primitives + lucide-react | Diseño propio, accesible |
| Datos (front) | **TanStack Query v5** | Cache, optimistic updates, infinite scroll |
| Router | **React Router 7** | Rutas anidadas |
| Back | **Node 20+ / Express 5 + TypeScript (tsx)** | Conocido por el equipo, simple |
| DB | **Prisma 6 + SQLite** | Cero instalación (sin XAMPP/MySQL); se cambia a Postgres/MySQL cambiando el provider |
| Validación | **Zod 4** | Mismo esquema de errores en toda la API |
| Auth | JWT en cookie **httpOnly** + `tokenVersion` | Sin tokens en localStorage; cerrar sesiones al cambiar contraseña |
| Tiempo real | **Server-Sent Events** (`/api/stream`) | Notificaciones y mensajes en vivo sin dependencias extra |
| Tests | **Vitest + Supertest** | Tests de integración de la API |

## Estructura
```
/
├── package.json        # scripts raíz: setup, dev, build, start, test
├── server/             # API Express + Prisma (node_modules propio)
│   ├── prisma/         # schema.prisma, seed.ts, dev.db (ignorado)
│   ├── src/            # app.ts, index.ts, routes/, lib/, middleware/
│   ├── uploads/        # imágenes subidas (ignorado)
│   └── tests/
├── web/                # SPA React (node_modules propio)
│   └── src/            # main.tsx, routes/pages, components/, lib/
└── docs/               # PLAN.md, API.md, screenshots/
```
`server/` y `web/` tienen `node_modules` separados (no workspaces) para que se puedan desarrollar en paralelo.

## Funciones
- **Cuentas**: registro, login (email o usuario), logout, recuperar contraseña (email o link en consola en dev),
  cambiar contraseña (cierra otras sesiones), editar perfil, avatar, borrar cuenta.
- **Comunidades** (materias / temas): unirse, feed por comunidad, reglas, ícono y color.
- **Posts**: texto, **pregunta** (con respuesta aceptada ✓), **encuesta**, link; markdown con preview,
  imágenes (subida / pegar / arrastrar), etiquetas, editar, borrar, fijar y cerrar (mods).
- **Comentarios**: hilos anidados colapsables, markdown, editar, borrar (queda “[eliminado]”), menciones `@usuario`.
- **Votos** con karma; orden **Hot / Nuevos / Top (día, semana, mes, año, siempre) / Más comentados**.
- **Feeds**: Inicio (todo), Siguiendo (mis comunidades + gente que sigo), Sin responder, Guardados.
- **Búsqueda** global (posts, usuarios, comunidades) con atajo `Ctrl/⌘ K`.
- **Social**: seguir usuarios, **mensajes directos** en tiempo real.
- **Notificaciones** en tiempo real: respuestas, menciones, nuevos seguidores, respuesta aceptada, mensajes.
- **Moderación**: reportes, cola de reportes, bans temporales/permanentes, roles
  (`ADMIN`, `MODERATOR`, `PROFESSOR`, `STUDENT`), panel con métricas, CRUD de comunidades y etiquetas.
- **UX**: tema claro/oscuro/sistema, vista tarjeta/compacta, skeletons, estados vacíos, toasts,
  updates optimistas, scroll infinito, navegación inferior en móvil, accesible por teclado.

## Ejecución con subagentes
1. **Orquestador** — plan, contrato de API (`docs/API.md`), esqueleto de paquetes y dependencias.
2. **Backend** (en paralelo) — Prisma schema, seed realista, toda la API, SSE, tests.
3. **Frontend** (en paralelo) — sistema de diseño y todas las páginas contra `docs/API.md`.
4. **Integración / QA** — levantar todo, recorrer los flujos con Playwright, arreglar diferencias,
   capturas, README, limpieza del código viejo.
