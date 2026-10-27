// Contenido de ejemplo del seed. Fences de código con ~~~ para no escapar backticks.

export type SeedRole = 'ADMIN' | 'MODERATOR' | 'PROFESSOR' | 'STUDENT';

export interface SeedUser {
  username: string;
  email: string;
  role: SeedRole;
  displayName: string;
  career: string | null;
  bio: string | null;
  joinedDaysAgo: number;
  /** probabilidad base de votar (usuarios más activos votan más) */
  activity: number;
}

export const USERS: SeedUser[] = [
  {
    username: 'admin',
    email: 'admin@foro.utn',
    role: 'ADMIN',
    displayName: 'Admin Foro UTN',
    career: null,
    bio: 'Cuenta de administración del foro. Si algo no anda, mandame un mensaje privado.',
    joinedDaysAgo: 210,
    activity: 0.25,
  },
  {
    username: 'moderadora',
    email: 'mod@foro.utn',
    role: 'MODERATOR',
    displayName: 'Carla Medina',
    career: 'Ingeniería en Sistemas de Información',
    bio: 'Moderadora del foro y estudiante de 5.º año. Leé las reglas antes de postear 🙏',
    joinedDaysAgo: 200,
    activity: 0.55,
  },
  {
    username: 'prof_garcia',
    email: 'garcia@foro.utn',
    role: 'PROFESSOR',
    displayName: 'Ing. Marcela García',
    career: 'Docente — Análisis Matemático I · Algoritmos y Estructuras de Datos · Base de Datos',
    bio: 'JTP en la FRT desde 2014. Consultas presenciales los martes a las 18 h (aula 214) y, por supuesto, acá en el foro.',
    joinedDaysAgo: 190,
    activity: 0.45,
  },
  {
    username: 'lucia_dev',
    email: 'lucia_dev@foro.utn',
    role: 'STUDENT',
    displayName: 'Lucía Fernández',
    career: 'Ingeniería en Sistemas de Información',
    bio: '3.er año de Sistemas. Backend, mate amargo y apuntes prolijos. Ayudante alumna de Programación.',
    joinedDaysAgo: 170,
    activity: 0.8,
  },
  {
    username: 'tomi_ing',
    email: 'tomi_ing@foro.utn',
    role: 'STUDENT',
    displayName: 'Tomás Ibáñez',
    career: 'Ingeniería Electrónica',
    bio: '2.º año de Electrónica. Arduino, café y Física I (todavía).',
    joinedDaysAgo: 150,
    activity: 0.7,
  },
  {
    username: 'sofi_mate',
    email: 'sofi_mate@foro.utn',
    role: 'STUDENT',
    displayName: 'Sofía Romero',
    career: 'Ingeniería Química',
    bio: 'Ayudante alumna de Análisis Matemático I. Pregunten sin miedo ∫',
    joinedDaysAgo: 140,
    activity: 0.75,
  },
  {
    username: 'nico_frt',
    email: 'nico_frt@foro.utn',
    role: 'STUDENT',
    displayName: 'Nicolás Paz',
    career: 'Ingeniería Mecánica',
    bio: 'Ingresante 2026. Todavía me pierdo buscando las aulas.',
    joinedDaysAgo: 40,
    activity: 0.65,
  },
  {
    username: 'vale_sistemas',
    email: 'vale_sistemas@foro.utn',
    role: 'STUDENT',
    displayName: 'Valentina Ruiz',
    career: 'Ingeniería en Sistemas de Información',
    bio: '2.º año de Sistemas. Linux, Python y armar grupos de estudio.',
    joinedDaysAgo: 120,
    activity: 0.75,
  },
  // Cuentas extra (también con contraseña foro1234) para que haya votos y movimiento.
  { username: 'agus_civil', email: 'agus_civil@foro.utn', role: 'STUDENT', displayName: 'Agustín Medina', career: 'Ingeniería Civil', bio: 'Civil, 3.er año. Hormigón y fútbol los jueves.', joinedDaysAgo: 110, activity: 0.5 },
  { username: 'meli_quimica', email: 'meli_quimica@foro.utn', role: 'STUDENT', displayName: 'Melina Juárez', career: 'Ingeniería Química', bio: null, joinedDaysAgo: 95, activity: 0.45 },
  { username: 'fede_electro', email: 'fede_electro@foro.utn', role: 'STUDENT', displayName: 'Federico Sosa', career: 'Ingeniería Electrónica', bio: 'Si se puede soldar, lo sueldo.', joinedDaysAgo: 88, activity: 0.5 },
  { username: 'cami_frt', email: 'cami_frt@foro.utn', role: 'STUDENT', displayName: 'Camila Herrera', career: 'Ingeniería Eléctrica', bio: null, joinedDaysAgo: 80, activity: 0.4 },
  { username: 'juanpi_mec', email: 'juanpi_mec@foro.utn', role: 'STUDENT', displayName: 'Juan Pablo Díaz', career: 'Ingeniería Mecánica', bio: 'Ingresante. Fierros y termodinámica (algún día).', joinedDaysAgo: 38, activity: 0.45 },
  { username: 'rodri_sis', email: 'rodri_sis@foro.utn', role: 'STUDENT', displayName: 'Rodrigo Álvarez', career: 'Ingeniería en Sistemas de Información', bio: '4.º año. Trabajo de dev junior y curso de noche.', joinedDaysAgo: 75, activity: 0.5 },
  { username: 'mica_ing', email: 'mica_ing@foro.utn', role: 'STUDENT', displayName: 'Micaela Gómez', career: 'Ingeniería en Sistemas de Información', bio: null, joinedDaysAgo: 60, activity: 0.4 },
  { username: 'santi_k', email: 'santi_k@foro.utn', role: 'STUDENT', displayName: 'Santiago Correa', career: 'Ingeniería Electrónica', bio: null, joinedDaysAgo: 50, activity: 0.3 },
  { username: 'belu_frt', email: 'belu_frt@foro.utn', role: 'STUDENT', displayName: 'Belén Ortiz', career: 'Ingeniería Civil', bio: 'Primer año. Dibujo técnico me odia.', joinedDaysAgo: 36, activity: 0.45 },
  { username: 'promo_apuntes', email: 'promo.apuntes.tuc@gmail.com', role: 'STUDENT', displayName: 'Apuntes Express', career: null, bio: null, joinedDaysAgo: 3, activity: 0 },
];

export interface SeedCommunity {
  slug: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  rules: string[];
}

export const COMMUNITIES: SeedCommunity[] = [
  {
    slug: 'ingreso',
    name: 'Ingreso',
    icon: '🎒',
    color: '#f59e0b',
    description: 'Seminario Universitario, inscripciones, horarios y todo lo que necesitás para arrancar en la UTN FRT.',
    rules: [
      'Antes de preguntar, buscá: muchas dudas del ingreso ya tienen respuesta.',
      'Usá un título claro (ej.: "Inscripción a comisiones del Seminario").',
      'Nada de compartir datos personales de terceros.',
      'Respeto ante todo: todos fuimos ingresantes alguna vez.',
    ],
  },
  {
    slug: 'analisis-matematico-1',
    name: 'Análisis Matemático I',
    icon: '📈',
    color: '#ef4444',
    description: 'Límites, derivadas, integrales y series. Consultas de prácticos, parciales y finales de AM I.',
    rules: [
      'Mostrá lo que intentaste: ayudamos a entender, no a hacer la tarea.',
      'Escribí las expresiones con claridad (podés usar `código` o una foto prolija).',
      'Marcá como aceptada la respuesta que te sirvió.',
    ],
  },
  {
    slug: 'algebra-y-geometria',
    name: 'Álgebra y Geometría Analítica',
    icon: '📐',
    color: '#8b5cf6',
    description: 'Vectores, matrices, sistemas de ecuaciones, rectas, planos y cónicas.',
    rules: [
      'Indicá de qué guía o unidad es el ejercicio.',
      'Compartí tu planteo aunque esté incompleto.',
      'Sin pedidos de resoluciones de parciales en curso.',
    ],
  },
  {
    slug: 'fisica-1',
    name: 'Física I',
    icon: '⚛️',
    color: '#0ea5e9',
    description: 'Cinemática, dinámica, trabajo y energía, laboratorios e informes de Física I.',
    rules: [
      'Incluí el diagrama de cuerpo libre cuando sea un problema de dinámica.',
      'Respetá las unidades: un resultado sin unidades está incompleto.',
      'Los informes de laboratorio se discuten, no se copian.',
      'Sé amable: Física I es difícil para todos.',
    ],
  },
  {
    slug: 'programacion',
    name: 'Programación',
    icon: '💻',
    color: '#22c55e',
    description: 'C, Python, Git y buenas prácticas. Errores, dudas de sintaxis y recursos para aprender a programar.',
    rules: [
      'Pegá el código como bloque de código, no como captura.',
      'Incluí el error exacto y qué esperabas que pasara.',
      'Explicá las soluciones: un "probá esto" sin contexto no ayuda.',
    ],
  },
  {
    slug: 'algoritmos',
    name: 'Algoritmos y Estructuras de Datos',
    icon: '🌳',
    color: '#14b8a6',
    description: 'Pilas, colas, listas, árboles, recursividad y complejidad. Espacio de consulta de la cátedra de AED.',
    rules: [
      'Compartí pseudocódigo o código mínimo que reproduzca el problema.',
      'No publiques enunciados de evaluaciones en curso.',
      'Las respuestas de docentes se identifican con el rol PROFESSOR.',
    ],
  },
  {
    slug: 'base-de-datos',
    name: 'Base de Datos',
    icon: '🗄️',
    color: '#6366f1',
    description: 'Modelado ER, normalización, SQL y transacciones.',
    rules: [
      'Incluí el esquema de las tablas cuando consultes por una query.',
      'Indicá el motor (MySQL, PostgreSQL, SQLite…).',
      'Nada de datos reales o sensibles en los ejemplos.',
    ],
  },
  {
    slug: 'sistemas-operativos',
    name: 'Sistemas Operativos',
    icon: '🖥️',
    color: '#64748b',
    description: 'Procesos, hilos, memoria, planificación, Linux y la consola.',
    rules: [
      'Indicá distribución y versión si es un problema de Linux.',
      'Pegá la salida completa del comando que falla.',
      'Nada de comandos destructivos sin advertencia (sí, hablamos de rm -rf).',
    ],
  },
  {
    slug: 'sistemas',
    name: 'Ingeniería en Sistemas',
    icon: '🧠',
    color: '#3b82f6',
    description: 'Plan de estudios, correlatividades, PPS, pasantías y vida profesional en Sistemas de Información.',
    rules: [
      'Mantené las discusiones sobre la carrera y la profesión.',
      'Las ofertas laborales tienen que incluir empresa y condiciones.',
      'Respetá las opiniones distintas sobre materias y docentes.',
    ],
  },
  {
    slug: 'apuntes',
    name: 'Apuntes y Recursos',
    icon: '📚',
    color: '#d97706',
    description: 'Resúmenes, guías resueltas, libros y links útiles para todas las materias.',
    rules: [
      'Solo material propio o de libre distribución.',
      'Prohibida la venta de apuntes.',
      'Indicá materia, año y docente si corresponde.',
      'Usá la etiqueta "apuntes" o "recursos".',
    ],
  },
  {
    slug: 'vida-universitaria',
    name: 'Vida Universitaria',
    icon: '🧉',
    color: '#84cc16',
    description: 'Comedor, becas, transporte, centro de estudiantes y todo lo que pasa fuera del aula.',
    rules: ['Buena onda siempre.', 'Nada de política partidaria.', 'Los eventos con fecha, lugar y hora.'],
  },
  {
    slug: 'off-topic',
    name: 'Off-topic',
    icon: '🎲',
    color: '#ec4899',
    description: 'Series, música, juegos y charla libre para despejarse entre parcial y parcial.',
    rules: ['Off-topic no es sin reglas: el respeto sigue aplicando.', 'Sin spam ni autopromoción.', 'Nada de contenido NSFW.'],
  },
];

export const TAGS: { name: string; color: string }[] = [
  { name: 'duda', color: '#3b82f6' },
  { name: 'parcial', color: '#ef4444' },
  { name: 'final', color: '#a855f7' },
  { name: 'apuntes', color: '#f59e0b' },
  { name: 'tp', color: '#10b981' },
  { name: 'consulta', color: '#06b6d4' },
  { name: 'recursos', color: '#84cc16' },
  { name: 'evento', color: '#ec4899' },
];

export interface SeedComment {
  key?: string;
  by: string;
  body: string;
  /** horas después del padre (o del post) */
  h?: number;
  replies?: SeedComment[];
}

export interface SeedPost {
  key: string;
  community: string;
  by: string;
  type: 'TEXT' | 'QUESTION' | 'POLL' | 'LINK';
  title: string;
  body: string;
  tags?: string[];
  daysAgo: number;
  pinned?: boolean;
  locked?: boolean;
  url?: string;
  poll?: { options: string[]; closesInDays?: number; weights: number[] };
  /** key del comentario aceptado */
  accepted?: string;
  /** 0..1: qué tan probable es que lo voten positivo */
  quality: number;
  comments?: SeedComment[];
}

export const POSTS: SeedPost[] = [
  // ───────────────────────── Ingreso ─────────────────────────
  {
    key: 'bienvenida',
    community: 'ingreso',
    by: 'admin',
    type: 'TEXT',
    title: '📌 Bienvenida al Foro UTN FRT: leé esto antes de postear',
    daysAgo: 29.6,
    pinned: true,
    quality: 0.95,
    tags: ['recursos'],
    body: `¡Hola y bienvenida/o al **Foro UTN — Facultad Regional Tucumán**! 🎓

Este es un espacio hecho por y para estudiantes y docentes de la FRT: consultas de materias, apuntes, avisos y también charla de pasillo.

## Cómo funciona

- **Comunidades**: cada materia o tema tiene la suya. Unite a las que cursás para armar tu feed en *Siguiendo*.
- **Tipos de post**: texto, **pregunta** (podés marcar la respuesta que te sirvió con ✓), **encuesta** y link.
- **Votos**: votá positivo lo que aporta, no lo que te cae bien. El orden *Hot* combina votos y antigüedad.
- **Menciones**: escribí \`@usuario\` para avisarle a alguien.

## Reglas generales

1. **Respeto siempre.** Nada de insultos, burlas ni acoso. Se banea sin aviso.
2. **Buscá antes de preguntar** — la barra de arriba (o \`Ctrl + K\`) busca en todo el foro.
3. **Prohibida la venta de apuntes** y la publicidad.
4. **No publiques enunciados de evaluaciones en curso.**
5. Usá **títulos claros** y las **etiquetas** que correspondan (\`duda\`, \`parcial\`, \`tp\`…).

> Si ves algo que rompe las reglas, usá el botón **Reportar**. El equipo de moderación lo revisa en el día.

¡Éxitos en la cursada! 💪`,
    comments: [
      {
        by: 'lucia_dev',
        h: 3,
        body: '¡Qué bueno que por fin exista un foro de la facu! El grupo de WhatsApp de 400 personas ya era inmanejable 😅',
        replies: [
          { by: 'tomi_ing', h: 2, body: 'Literal, preguntabas algo y a los 5 minutos quedaba tapado por 80 stickers.' },
          { by: 'moderadora', h: 5, body: 'Esa es la idea: que las respuestas queden y se puedan buscar. ¡Gracias por sumarse!' },
        ],
      },
      {
        by: 'nico_frt',
        h: 20,
        body: 'Pregunta de ingresante: ¿se pueden subir fotos de apuntes hechos a mano?',
        replies: [
          {
            by: 'moderadora',
            h: 1.5,
            body: 'Sí, siempre que sean **tuyos** o de libre distribución. Si son fotocopias de un libro, mejor pasá la referencia (autor, edición, capítulo).',
            replies: [{ by: 'nico_frt', h: 0.5, body: 'Perfecto, gracias!' }],
          },
        ],
      },
      { by: 'rodri_sis', h: 48, body: 'Muy buena iniciativa. Sugerencia: una comunidad para ofertas de trabajo/pasantías estaría genial.' },
    ],
  },
  {
    key: 'inscripcion-seminario',
    community: 'ingreso',
    by: 'nico_frt',
    type: 'QUESTION',
    title: '¿Cómo me inscribo a las comisiones del Seminario Universitario?',
    daysAgo: 12.3,
    quality: 0.8,
    tags: ['duda', 'consulta'],
    accepted: 'insc-vale',
    body: `Hola! Soy ingresante a Mecánica y no encuentro dónde elegir la comisión del Seminario. En el SysAcad solo me aparece "Inscripción a cursado" pero no me deja elegir horario.

¿Alguien sabe si hay que hacer algo antes? Trabajo a la mañana así que necesito sí o sí una comisión de la tarde.`,
    comments: [
      {
        key: 'insc-vale',
        by: 'vale_sistemas',
        h: 1.2,
        body: `Te pasó lo mismo que a mí el año pasado. Los pasos son:

1. Entrá a **SysAcad → Trámites → Actualizar datos personales** y completá todo (si falta algo, no te habilita la inscripción).
2. Esperá a que Alumnos te valide la documentación (tarda 24–48 h).
3. Recién ahí aparece **Inscripción a cursado → Seminario Universitario** con la lista de comisiones y horarios.

Si trabajás, pedí en Alumnos el **certificado de trabajo** para tener prioridad en las comisiones de la tarde.`,
        replies: [
          {
            by: 'nico_frt',
            h: 3,
            body: 'Era eso, me faltaba cargar el título secundario. ¡Ya quedé en la comisión 7 (tarde)! Gracias @vale_sistemas 🙌',
          },
        ],
      },
      { by: 'tomi_ing', h: 2, body: 'Ojo que las comisiones de la tarde se llenan rapidísimo. Apenas se habilite, anotate.' },
      { by: 'juanpi_mec', h: 26, body: 'Dato: el certificado de trabajo tiene que tener firma y sello de la empresa, si no te lo rebotan.' },
    ],
  },
  {
    key: 'tips-primer-cuatri',
    community: 'ingreso',
    by: 'sofi_mate',
    type: 'TEXT',
    title: 'Tips para sobrevivir el primer cuatrimestre (de alguien que casi no lo sobrevive)',
    daysAgo: 20.4,
    quality: 0.9,
    tags: ['recursos'],
    body: `Después de tres años en la facu, esto es lo que me hubiese gustado saber el primer día:

- **Armá un grupo de estudio en la primera semana.** No esperes al parcial para conocer a tus compañeros.
- **Andá a las consultas.** Los docentes están ahí para eso y casi nadie va. Es una ventaja enorme.
- **Hacé los prácticos al día.** Análisis y Álgebra se acumulan muy rápido; dos semanas de atraso se sienten un montón.
- **Calendario de parciales en un solo lugar** (Google Calendar, agenda, lo que sea).
- **Dormí.** En serio: estudiar a las 4 de la mañana rinde la mitad.

> "No es que sea difícil, es que es mucho". — Un ayudante de Física, 2023

¿Qué agregarían ustedes?`,
    comments: [
      { by: 'nico_frt', h: 4, body: 'Lo del grupo de estudio es clave. Yo me sumé a uno recién en la semana 5 y fue otra cosa.' },
      {
        by: 'tomi_ing',
        h: 6,
        body: 'Sumo: **no dejen Física para el final de la semana**. Los problemas de dinámica necesitan tiempo para "decantar".',
        replies: [
          {
            by: 'sofi_mate',
            h: 1,
            body: 'Totalmente. Y hacer el diagrama de cuerpo libre SIEMPRE, aunque parezca obvio.',
            replies: [{ by: 'belu_frt', h: 30, body: 'Me lo voy a tatuar 😂' }],
          },
        ],
      },
      { by: 'meli_quimica', h: 30, body: 'Agrego: aprovechen la biblioteca, tienen varios ejemplares del Stewart y del Sears–Zemansky.' },
      { by: 'lucia_dev', h: 52, body: 'Y usar este foro, obvio 😉 Muchas dudas del primer año ya están respondidas acá.' },
    ],
  },
  {
    key: 'encuesta-ingreso',
    community: 'ingreso',
    by: 'vale_sistemas',
    type: 'POLL',
    title: '¿Qué módulo del Seminario Universitario les costó más?',
    daysAgo: 6.2,
    quality: 0.75,
    tags: ['consulta'],
    poll: {
      options: ['Matemática', 'Física', 'Química', 'Introducción a la Universidad'],
      closesInDays: 14,
      weights: [5, 3, 2, 0.4],
    },
    body: 'Estamos armando material de apoyo con el centro de estudiantes y queremos saber en qué módulo enfocarnos primero. ¡Voten y comenten por qué!',
    comments: [
      { by: 'belu_frt', h: 2, body: 'Matemática sin dudas. Los ejercicios de trigonometría del cuadernillo son durísimos.' },
      {
        by: 'juanpi_mec',
        h: 5,
        body: 'Física, porque nunca la tuve en la secundaria. Arranqué de cero.',
        replies: [{ by: 'vale_sistemas', h: 1, body: 'Anotado. Vamos a armar una guía de "Física desde cero" para el próximo ingreso.' }],
      },
    ],
  },

  // ───────────────────────── Análisis Matemático I ─────────────────────────
  {
    key: 'limite-sen3x',
    community: 'analisis-matematico-1',
    by: 'belu_frt',
    type: 'QUESTION',
    title: 'Límite que no me sale: sen(3x)/x cuando x → 0',
    daysAgo: 9.1,
    quality: 0.8,
    tags: ['duda', 'parcial'],
    accepted: 'lim-prof',
    body: `Estoy con la guía 3 y me trabé con este límite:

~~~
lim  sen(3x) / x
x→0
~~~

Sé que **sen(x)/x → 1**, pero acá tengo un 3 adentro del seno y no sé cómo usarlo. Si reemplazo directo me queda 0/0. ¿Hay que usar L'Hôpital?`,
    comments: [
      {
        key: 'lim-prof',
        by: 'prof_garcia',
        h: 2.5,
        body: `Muy buena pregunta, es un clásico de parcial. No hace falta L'Hôpital: la idea es **fabricar** el límite notable.

Multiplicá y dividí por 3:

~~~
sen(3x)      sen(3x)
-------  = 3 · -------
   x            3x
~~~

Si llamás \`u = 3x\`, cuando x → 0 también u → 0, entonces \`sen(u)/u → 1\` y el límite da **3 · 1 = 3**.

En general: \`lim sen(kx)/x = k\` cuando x → 0. Fijate que el argumento del seno y el denominador tienen que ser **exactamente iguales** para aplicar el límite notable.`,
        replies: [
          {
            by: 'belu_frt',
            h: 1,
            body: '¡Ahhh! Era multiplicar y dividir por lo mismo. Ahora me salieron los de sen(5x)/(2x) también. Gracias, profe!',
            replies: [{ by: 'prof_garcia', h: 0.7, body: 'Exacto, ese da 5/2. ¡Bien ahí!' }],
          },
        ],
      },
      {
        by: 'sofi_mate',
        h: 1,
        body: 'Con L\'Hôpital también sale (derivás arriba y abajo: 3cos(3x)/1 → 3), pero en el parcial de AM I suelen pedir que lo resuelvas **sin** L\'Hôpital en esta unidad.',
      },
    ],
  },
  {
    key: 'resumen-derivadas',
    community: 'analisis-matematico-1',
    by: 'sofi_mate',
    type: 'TEXT',
    title: 'Resumen: reglas de derivación + tabla para el parcial',
    daysAgo: 15.3,
    quality: 0.95,
    tags: ['apuntes', 'parcial'],
    body: `Les dejo el resumen que uso cuando doy clases de apoyo. Si encuentran un error, avisen y lo corrijo.

## Reglas

- **Suma:** (f + g)' = f' + g'
- **Producto:** (f · g)' = f' · g + f · g'
- **Cociente:** (f / g)' = (f' · g − f · g') / g²
- **Cadena:** (f ∘ g)'(x) = f'(g(x)) · g'(x)

## Tabla de derivadas

| Función | Derivada |
|---|---|
| xⁿ | n · xⁿ⁻¹ |
| eˣ | eˣ |
| ln(x) | 1/x |
| sen(x) | cos(x) |
| cos(x) | −sen(x) |
| tg(x) | 1 / cos²(x) |
| arctg(x) | 1 / (1 + x²) |

## Errores típicos

1. Olvidarse de la **regla de la cadena** en cosas como sen(x²).
2. Escribir (f·g)' = f'·g' (¡no!).
3. Confundir el signo en la derivada del coseno.

> Tip: cuando tengas un cociente "feo", a veces conviene reescribirlo como producto con exponente negativo.`,
    comments: [
      { by: 'nico_frt', h: 3, body: 'Guardadísimo. ¿Podrías agregar las de las funciones trigonométricas inversas que faltan?' },
      {
        by: 'prof_garcia',
        h: 8,
        body: 'Excelente resumen, @sofi_mate. Solo un detalle: para tg(x) también es válido escribir 1 + tg²(x), que a veces simplifica mucho.',
        replies: [{ by: 'sofi_mate', h: 1, body: '¡Gracias profe! Lo agrego a la tabla.' }],
      },
      { by: 'meli_quimica', h: 40, body: 'Me salvó el parcial del sábado. Gracias!!' },
    ],
  },
  {
    key: 'lhopital',
    community: 'analisis-matematico-1',
    by: 'tomi_ing',
    type: 'QUESTION',
    title: '¿Cuándo conviene usar L\'Hôpital y cuándo no?',
    daysAgo: 2.1,
    quality: 0.65,
    tags: ['duda'],
    body: `Siempre que veo un 0/0 aplico L'Hôpital de una, pero en el último práctico me quedó un desastre de derivadas que nunca terminaba.

¿Hay algún criterio para saber cuándo conviene y cuándo es mejor factorizar o usar límites notables?`,
    comments: [
      {
        by: 'sofi_mate',
        h: 2,
        body: `Mi criterio:

- Si es un **cociente de polinomios**, factorizá: es más rápido.
- Si aparecen **raíces**, probá multiplicar por el conjugado.
- Si hay **senos/cosenos** "chiquitos", buscá un límite notable.
- L'Hôpital cuando lo anterior no sale fácil, o hay exponenciales/logaritmos mezclados.

Y siempre verificá que sea 0/0 o ∞/∞ **antes** de derivar.`,
        replies: [{ by: 'tomi_ing', h: 4, body: 'Lo del conjugado no se me había ocurrido. Gracias!' }],
      },
      { by: 'fede_electro', h: 9, body: 'Ojo que hay límites donde L\'Hôpital entra en loop (te vuelve a quedar lo mismo). Ahí sí o sí hay que cambiar de estrategia.' },
    ],
  },

  // ───────────────────────── Álgebra y Geometría ─────────────────────────
  {
    key: 'producto-vectorial',
    community: 'algebra-y-geometria',
    by: 'vale_sistemas',
    type: 'QUESTION',
    title: 'Producto vectorial: ¿por qué el resultado es perpendicular a los dos vectores?',
    daysAgo: 18.2,
    quality: 0.75,
    tags: ['duda'],
    accepted: 'vect-sofi',
    body: `Entiendo cómo calcular **u × v** con el determinante, pero no termino de entender *por qué* el vector resultante es perpendicular a u y a v.

¿Hay alguna forma de verlo sin hacer todas las cuentas?`,
    comments: [
      {
        key: 'vect-sofi',
        by: 'sofi_mate',
        h: 5,
        body: `La forma más directa: calculá el **producto escalar** de u × v con u.

Si u × v = (u₂v₃ − u₃v₂, u₃v₁ − u₁v₃, u₁v₂ − u₂v₁), entonces

~~~
u · (u × v) = u₁(u₂v₃ − u₃v₂) + u₂(u₃v₁ − u₁v₃) + u₃(u₁v₂ − u₂v₁) = 0
~~~

Todos los términos se cancelan de a pares. Como el producto escalar da 0, son perpendiculares. Con v pasa lo mismo.

Otra forma de verlo: el determinante con dos filas iguales vale 0, y eso es exactamente lo que estás calculando.`,
        replies: [
          {
            by: 'vale_sistemas',
            h: 2,
            body: 'Lo del determinante con filas iguales me voló la cabeza. Ahora tiene todo sentido 🤯',
          },
        ],
      },
      { by: 'agus_civil', h: 30, body: 'En Civil lo usamos un montón para momentos de fuerzas, así que vale la pena entenderlo bien.' },
    ],
  },
  {
    key: 'guia-matrices',
    community: 'algebra-y-geometria',
    by: 'lucia_dev',
    type: 'TEXT',
    title: 'Guía resuelta de matrices y determinantes (TP 2)',
    daysAgo: 25.4,
    quality: 0.85,
    tags: ['apuntes', 'tp'],
    body: `Subí al drive de la comunidad (link en **Apuntes y Recursos**) mi resolución del TP 2. Incluye:

- Operaciones con matrices y propiedades
- Cálculo de determinantes por **Laplace** y por **triangulación**
- Matriz inversa por **Gauss–Jordan** y por adjunta
- Sistemas con **Cramer**

Está revisada por el ayudante, pero si ven algo raro avísenme. **No es para copiar**: la idea es que la usen para chequear sus resultados.`,
    comments: [
      { by: 'mica_ing', h: 6, body: 'Gracias Lu! El ejercicio 7 de inversa por adjunta lo tenía mal y no sabía dónde.' },
      {
        by: 'vale_sistemas',
        h: 12,
        body: 'En el 4.c creo que el determinante da −12 y no 12 (hay un cambio de filas al principio).',
        replies: [
          {
            by: 'lucia_dev',
            h: 2,
            body: 'Tenés razón, me olvidé de cambiar el signo al permutar filas. Ya lo corregí ✔️',
            replies: [{ by: 'vale_sistemas', h: 0.5, body: '🙌' }],
          },
        ],
      },
    ],
  },
  {
    key: 'conicas',
    community: 'algebra-y-geometria',
    by: 'nico_frt',
    type: 'QUESTION',
    title: 'Cónicas: ¿cómo identifico rápido si es elipse, hipérbola o parábola?',
    daysAgo: 1.1,
    quality: 0.6,
    tags: ['duda', 'parcial'],
    body: `Me dan ecuaciones del tipo \`4x² − 9y² + 16x + 18y − 29 = 0\` y tardo mucho completando cuadrados para recién ahí darme cuenta de qué cónica es.

¿Hay algún truco para saberlo de un vistazo?`,
    comments: [
      {
        by: 'agus_civil',
        h: 3,
        body: 'Mirá los signos de x² e y² (sin término xy): **mismo signo** → elipse (o circunferencia si son iguales), **signos opuestos** → hipérbola, **falta uno de los dos** → parábola. Igual para el parcial tenés que completar cuadrados para sacar centro y semiejes.',
      },
    ],
  },

  // ───────────────────────── Física I ─────────────────────────
  {
    key: 'plano-inclinado',
    community: 'fisica-1',
    by: 'tomi_ing',
    type: 'QUESTION',
    title: 'Plano inclinado con rozamiento: ¿por qué la normal no es igual al peso?',
    daysAgo: 10.4,
    quality: 0.8,
    tags: ['duda'],
    accepted: 'plano-fede',
    body: `En el problema 12 de la guía de dinámica hay un bloque de 5 kg en un plano inclinado a 30° con μ = 0,2.

Yo puse **N = m·g = 49 N** y me da mal la fuerza de rozamiento. En la resolución usan N = m·g·cos(30°). ¿Por qué el coseno?`,
    comments: [
      {
        key: 'plano-fede',
        by: 'fede_electro',
        h: 1.5,
        body: `Porque la normal es perpendicular **al plano**, no al piso. Si rotás los ejes para que x quede paralelo al plano:

- Componente del peso **paralela** al plano: m·g·sen(θ)
- Componente del peso **perpendicular** al plano: m·g·cos(θ)

En el eje perpendicular no hay aceleración, entonces **N = m·g·cos(30°) ≈ 42,4 N** y el rozamiento es μ·N ≈ 8,5 N.

N = m·g solo vale en una superficie horizontal y sin otras fuerzas verticales.`,
        replies: [
          {
            by: 'tomi_ing',
            h: 2,
            body: 'Claro, estaba pensando la normal como "lo que sostiene el peso" y no como perpendicular a la superficie. Gracias!',
          },
          { by: 'sofi_mate', h: 3, body: 'Esto es exactamente por qué siempre digo: ¡diagrama de cuerpo libre primero! 😄' },
        ],
      },
    ],
  },
  {
    key: 'informe-pendulo',
    community: 'fisica-1',
    by: 'tomi_ing',
    type: 'TEXT',
    title: 'Laboratorio de péndulo simple: ¿qué incluyen en el informe?',
    daysAgo: 4.3,
    quality: 0.6,
    tags: ['tp', 'consulta'],
    body: `Tenemos que entregar el informe del laboratorio de **péndulo simple** el viernes. La consigna dice "análisis de errores", pero no queda claro cuánto detalle quieren.

¿Ustedes incluyeron propagación de errores para g, o alcanza con el error estadístico de los períodos? ¿Gráfico T² vs L con ajuste lineal?`,
    comments: [
      {
        by: 'cami_frt',
        h: 4,
        body: 'Nosotros hicimos T² vs L con ajuste por cuadrados mínimos y sacamos g de la pendiente (g = 4π²/pendiente). La profe valoró mucho que discutiéramos por qué el ángulo tiene que ser chico.',
        replies: [
          {
            by: 'tomi_ing',
            h: 3,
            body: '¿Y el error de g lo propagaron desde el error de la pendiente?',
            replies: [{ by: 'cami_frt', h: 2, body: 'Sí, Δg = g · Δm / m. Queda muy prolijo.' }],
          },
        ],
      },
      { by: 'meli_quimica', h: 10, body: 'Incluyan las condiciones del experimento (longitud del hilo, masa, cantidad de oscilaciones medidas). Nos descontaron por no ponerlo.' },
    ],
  },
  {
    key: 'phet',
    community: 'fisica-1',
    by: 'sofi_mate',
    type: 'LINK',
    title: 'Simulaciones PhET para practicar cinemática y dinámica (gratis y en español)',
    url: 'https://phet.colorado.edu/es/simulations/filter?subjects=physics',
    daysAgo: 13.5,
    quality: 0.85,
    tags: ['recursos'],
    body: 'Las simulaciones de la Universidad de Colorado son ideales para ver cómo cambian las fuerzas en un plano inclinado o en un tiro oblicuo. Recomiendo especialmente **"Fuerzas y movimiento"** y **"Movimiento de proyectiles"**.',
    comments: [
      { by: 'nico_frt', h: 5, body: 'La de proyectiles es buenísima para entender por qué 45° da el alcance máximo.' },
      { by: 'fede_electro', h: 20, body: 'También tienen de circuitos, para los de Electrónica es oro.' },
    ],
  },

  // ───────────────────────── Programación ─────────────────────────
  {
    key: 'segfault',
    community: 'programacion',
    by: 'juanpi_mec',
    type: 'QUESTION',
    title: 'Segmentation fault al recorrer un array en C',
    daysAgo: 8.2,
    quality: 0.75,
    tags: ['duda', 'tp'],
    accepted: 'seg-prof',
    body: `Estoy haciendo el TP de vectores y el programa compila pero al ejecutarlo me tira **Segmentation fault (core dumped)**. Este es el código:

~~~c
#include <stdio.h>

int main(void) {
    int notas[5] = {7, 8, 6, 9, 10};
    int suma = 0;

    for (int i = 0; i <= 5; i++) {
        suma += notas[i];
    }

    printf("Promedio: %d\\n", suma / 5);
    return 0;
}
~~~

A veces funciona y a veces no, lo que me confunde más. ¿Qué estoy haciendo mal?`,
    comments: [
      {
        key: 'seg-prof',
        by: 'prof_garcia',
        h: 1.8,
        body: `El problema está en la condición del \`for\`: **\`i <= 5\`**. El array tiene 5 elementos, con índices de **0 a 4**. En la última vuelta accedés a \`notas[5]\`, que está fuera del array.

En C eso es *comportamiento indefinido*: a veces leés basura, a veces el sistema operativo te frena con un segfault. Por eso "a veces funciona".

~~~c
for (int i = 0; i < 5; i++) {   // < y no <=
    suma += notas[i];
}
~~~

Dos consejos:

1. Usá una constante para el tamaño (\`#define N 5\`) y recorré con \`i < N\`.
2. Compilá con \`gcc -Wall -Wextra -fsanitize=address\`: te avisa exactamente en qué línea te salís del array.

Ah, y \`suma / 5\` es división entera: si querés decimales, usá \`(double) suma / 5\` y \`%.2f\`.`,
        replies: [
          { by: 'juanpi_mec', h: 1, body: 'Era eso!! Y lo de -fsanitize=address no lo conocía, me muestra todo. Gracias profe 🙏' },
          { by: 'lucia_dev', h: 3, body: 'Lo de `-fsanitize=address` debería ser obligatorio en todos los TPs jaja' },
        ],
      },
      { by: 'rodri_sis', h: 0.8, body: 'Fijate el `<=` del for 👀' },
    ],
  },
  {
    key: 'guia-git',
    community: 'programacion',
    by: 'lucia_dev',
    type: 'TEXT',
    title: 'Mini guía de Git para los TPs grupales (sin perder el trabajo de nadie)',
    daysAgo: 16.4,
    quality: 0.95,
    tags: ['recursos', 'tp'],
    body: `Cada cuatrimestre veo grupos mandándose el TP por WhatsApp como \`tp_final_v3_AHORA_SI.zip\`. Les dejo el flujo mínimo que usamos en la cátedra:

## 1. Una sola vez

~~~bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu@mail.com"
git clone https://github.com/grupo/tp-aed.git
~~~

## 2. Cada vez que trabajás

~~~bash
git pull                       # traer lo último
git switch -c feature/listas   # tu rama
# ... programás ...
git add .
git commit -m "Agrega inserción ordenada en la lista"
git push -u origin feature/listas
~~~

Después abren un **Pull Request** y alguien del grupo lo revisa antes de mergear.

## 3. Reglas de oro

- **Nunca** trabajen todos directo en \`main\`.
- Commits chicos y con mensajes que digan *qué* cambió.
- Agreguen un \`.gitignore\` (ejecutables, \`.vscode/\`, \`*.o\`).

> Si hay conflicto, no entren en pánico: Git les marca las líneas con \`<<<<<<<\` y \`>>>>>>>\`. Elijan qué queda, guarden y hagan commit.

¿Dudas? Pregunten acá abajo.`,
    comments: [
      {
        by: 'vale_sistemas',
        h: 4,
        body: 'Agrego: `git log --oneline --graph` para ver el historial lindo y entender qué pasó.',
        replies: [{ by: 'lucia_dev', h: 1, body: 'Sí! Yo tengo un alias `git lg` para eso.' }],
      },
      {
        by: 'nico_frt',
        h: 10,
        body: 'Pregunta tonta: ¿qué diferencia hay entre `git switch` y `git checkout`?',
        replies: [
          {
            by: 'rodri_sis',
            h: 1,
            body: 'No es tonta! `checkout` hace muchas cosas (cambiar de rama, restaurar archivos…). `switch` es más nuevo y solo cambia de rama, así es más difícil equivocarse.',
            replies: [
              {
                by: 'nico_frt',
                h: 2,
                body: 'Ahh, buenísimo. Entonces para restaurar archivos sería `git restore`?',
                replies: [{ by: 'rodri_sis', h: 0.5, body: 'Exacto 👌' }],
              },
            ],
          },
        ],
      },
      { by: 'prof_garcia', h: 30, body: 'Excelente guía. La vamos a recomendar en la cátedra para los TPs de este cuatrimestre.' },
    ],
  },
  {
    key: 'python-tutor',
    community: 'programacion',
    by: 'vale_sistemas',
    type: 'LINK',
    title: 'Python Tutor: visualizá tu código paso a paso (también C y Java)',
    url: 'https://pythontutor.com',
    daysAgo: 7.3,
    quality: 0.8,
    tags: ['recursos'],
    body: 'Te muestra la memoria, las variables y los punteros en cada línea. Para entender **punteros en C** o **recursividad** es lo mejor que encontré.',
    comments: [
      { by: 'mica_ing', h: 3, body: 'Lo usé para entender listas enlazadas y por fin vi dónde perdía los nodos.' },
      { by: 'juanpi_mec', h: 12, body: 'Probé el segfault que pregunté el otro día y se ve clarito cómo se va del array. Genial.' },
    ],
  },
  {
    key: 'encuesta-editor',
    community: 'programacion',
    by: 'lucia_dev',
    type: 'POLL',
    title: '¿Con qué editor o IDE programan para la facu?',
    daysAgo: 3.2,
    quality: 0.7,
    tags: ['consulta'],
    poll: {
      options: ['VS Code', 'CLion / IntelliJ', 'Vim / Neovim', 'Code::Blocks', 'Otro'],
      closesInDays: 7,
      weights: [6, 2, 1.2, 1.5, 0.5],
    },
    body: 'Curiosidad: en la cátedra recomiendan Code::Blocks pero veo a casi todos con VS Code. ¿Ustedes qué usan y por qué?',
    comments: [
      {
        by: 'rodri_sis',
        h: 2,
        body: 'Neovim en el trabajo y en la facu. Una vez que te acostumbrás a los atajos no volvés.',
        replies: [{ by: 'tomi_ing', h: 3, body: '¿Y cómo salgo? 😂' }],
      },
      { by: 'mica_ing', h: 5, body: 'VS Code con la extensión de C/C++ y el debugger configurado. Para los TPs sobra.' },
      { by: 'lucia_dev', h: 20, body: 'Hasta ahora gana VS Code por goleada, como esperaba.' },
    ],
  },

  // ───────────────────────── Algoritmos ─────────────────────────
  {
    key: 'pila-cola',
    community: 'algoritmos',
    by: 'vale_sistemas',
    type: 'QUESTION',
    title: '¿Cuál es la diferencia real entre pila y cola? (más allá de LIFO/FIFO)',
    daysAgo: 11.2,
    quality: 0.8,
    tags: ['duda', 'parcial'],
    accepted: 'pila-prof',
    body: `Sé de memoria que la pila es LIFO y la cola es FIFO, pero en los ejercicios no me doy cuenta cuándo usar cada una.

¿Hay ejemplos concretos de problemas donde se note la diferencia?`,
    comments: [
      {
        key: 'pila-prof',
        by: 'prof_garcia',
        h: 3,
        body: `Pensalo por el **orden en que necesitás procesar** las cosas:

- **Pila**: cuando lo último que guardaste es lo primero que tenés que resolver. Ejemplos: deshacer (Ctrl+Z), verificar paréntesis balanceados, la propia recursividad (la *pila de llamadas*), recorrido en profundidad (DFS).
- **Cola**: cuando tenés que respetar el orden de llegada. Ejemplos: turnos, buffer de impresión, recorrido por niveles de un árbol (BFS).

Un ejemplo corto en Python para paréntesis balanceados:

~~~python
def balanceado(texto: str) -> bool:
    pares = {')': '(', ']': '[', '}': '{'}
    pila = []
    for c in texto:
        if c in '([{':
            pila.append(c)
        elif c in pares:
            if not pila or pila.pop() != pares[c]:
                return False
    return not pila
~~~

Si cambiás la pila por una cola, el algoritmo deja de funcionar: necesitás cerrar **el último** que abriste.`,
        replies: [
          {
            by: 'vale_sistemas',
            h: 2,
            body: 'Con el ejemplo de los paréntesis se entiende perfecto. ¿El BFS con cola entra en el parcial?',
            replies: [
              {
                by: 'prof_garcia',
                h: 4,
                body: 'Recorridos de árboles sí (preorden, inorden, postorden y por niveles). Grafos quedan para el segundo parcial.',
              },
            ],
          },
        ],
      },
      { by: 'mica_ing', h: 6, body: 'Me sirvió pensarlo como una pila de platos vs. la fila del comedor 😅' },
    ],
  },
  {
    key: 'parcial-aed',
    community: 'algoritmos',
    by: 'prof_garcia',
    type: 'TEXT',
    title: 'Parcial 1 de AED: temas, modalidad y fecha',
    daysAgo: 5.2,
    quality: 0.9,
    tags: ['parcial', 'evento'],
    body: `Hola a todos. Les comparto la información del **primer parcial** de Algoritmos y Estructuras de Datos.

**📅 Fecha:** sábado 14/11, 9:00 h — **Aulas 211 y 212**
**⏱ Duración:** 2 horas y media

## Temas

1. Recursividad (directa e indirecta)
2. Análisis de complejidad: notación O, casos mejor/peor
3. Pilas y colas (implementación con arreglos y con nodos)
4. Listas enlazadas simples y dobles
5. Árboles binarios: recorridos y árbol binario de búsqueda

## Modalidad

- Escrito, **a papel**. Se puede llevar una hoja A4 con anotaciones propias (de ambos lados).
- El código puede ser en **C o en pseudocódigo**, siempre que sea consistente.

> El martes 10/11 hacemos una **clase de consulta** extra en el aula 214. Traigan dudas concretas.

Mucha suerte. Cualquier consulta, por acá o en el horario de consulta.`,
    comments: [
      {
        by: 'lucia_dev',
        h: 2,
        body: '¿Los árboles AVL entran o solo ABB?',
        replies: [{ by: 'prof_garcia', h: 1, body: 'Solo ABB. AVL queda para el segundo parcial.' }],
      },
      {
        by: 'mica_ing',
        h: 6,
        body: '¿La hoja A4 puede ser impresa o tiene que ser manuscrita?',
        replies: [
          { by: 'prof_garcia', h: 3, body: 'Manuscrita. La idea es que el armarla también les sirva para estudiar.' },
          { by: 'rodri_sis', h: 5, body: 'Consejo de recursante: armen la hoja una semana antes, no la noche anterior.' },
        ],
      },
      { by: 'vale_sistemas', h: 22, body: 'Armamos grupo de estudio para el jueves en la biblioteca, 17 h. El que quiera sumarse, bienvenido @lucia_dev @mica_ing' },
    ],
  },
  {
    key: 'busqueda-binaria',
    community: 'algoritmos',
    by: 'lucia_dev',
    type: 'QUESTION',
    title: 'Búsqueda binaria recursiva: ¿O(log n) también en memoria?',
    daysAgo: 0.3,
    quality: 0.6,
    tags: ['duda', 'parcial'],
    body: `Entiendo que la búsqueda binaria es **O(log n)** en tiempo. Pero si la hago recursiva:

~~~c
int buscar(int v[], int ini, int fin, int x) {
    if (ini > fin) return -1;
    int medio = ini + (fin - ini) / 2;
    if (v[medio] == x) return medio;
    if (v[medio] < x) return buscar(v, medio + 1, fin, x);
    return buscar(v, ini, medio - 1, x);
}
~~~

¿La complejidad **espacial** también es O(log n) por la pila de llamadas? ¿O se considera O(1) como la versión iterativa?`,
    comments: [
      {
        by: 'rodri_sis',
        h: 2,
        body: 'Es O(log n) en espacio por la pila de llamadas, salvo que el compilador haga *tail call optimization* (y en C no está garantizado). La iterativa sí es O(1). Para el parcial yo justificaría con la profundidad máxima de la recursión.',
      },
    ],
  },

  // ───────────────────────── Base de Datos ─────────────────────────
  {
    key: 'left-join',
    community: 'base-de-datos',
    by: 'lucia_dev',
    type: 'QUESTION',
    title: '¿LEFT JOIN o NOT EXISTS para buscar clientes sin pedidos?',
    daysAgo: 14.2,
    quality: 0.8,
    tags: ['duda', 'consulta'],
    accepted: 'join-prof',
    body: `Tengo estas tablas (MySQL 8):

~~~sql
CREATE TABLE cliente (id INT PRIMARY KEY, nombre VARCHAR(100));
CREATE TABLE pedido  (id INT PRIMARY KEY, cliente_id INT, fecha DATE,
                      FOREIGN KEY (cliente_id) REFERENCES cliente(id));
~~~

Quiero listar los clientes que **nunca** hicieron un pedido. Encontré dos formas y ambas funcionan:

~~~sql
-- A
SELECT c.* FROM cliente c
LEFT JOIN pedido p ON p.cliente_id = c.id
WHERE p.id IS NULL;

-- B
SELECT c.* FROM cliente c
WHERE NOT EXISTS (SELECT 1 FROM pedido p WHERE p.cliente_id = c.id);
~~~

¿Cuál es "mejor"? ¿Cuál esperan en el parcial?`,
    comments: [
      {
        key: 'join-prof',
        by: 'prof_garcia',
        h: 4,
        body: `Las dos son correctas y en el parcial se aceptan ambas.

- **NOT EXISTS** expresa mejor la intención ("que no exista un pedido") y es la que recomiendo cuando razonan en álgebra/cálculo relacional.
- **LEFT JOIN … IS NULL** es igual de válida; cuidado con filtrar por una columna que **pueda ser NULL** en la tabla derecha (siempre usen la PK, como hiciste con \`p.id\`).

En rendimiento, los optimizadores modernos (MySQL 8, PostgreSQL) suelen generar el mismo plan (*anti-join*). Si quieren comprobarlo, prueben con \`EXPLAIN\`.

Lo que **no** recomiendo es \`NOT IN (SELECT cliente_id FROM pedido)\`: si alguna fila tiene \`cliente_id\` NULL, la consulta devuelve vacío y es un error muy difícil de detectar.`,
        replies: [
          { by: 'lucia_dev', h: 1, body: 'No tenía idea de lo del NOT IN con NULL. Gracias profe, súper claro.' },
          { by: 'rodri_sis', h: 6, body: 'Lo del NOT IN me pasó en el trabajo, en producción. Dos días buscando el bug 🥲' },
        ],
      },
    ],
  },
  {
    key: 'normalizacion',
    community: 'base-de-datos',
    by: 'prof_garcia',
    type: 'TEXT',
    title: 'Normalización hasta 3FN: ejemplo completo paso a paso',
    daysAgo: 22.3,
    quality: 0.9,
    tags: ['apuntes', 'parcial'],
    body: `Muchos me preguntaron por un ejemplo integrador. Partimos de esta tabla de **inscripciones**:

| legajo | alumno | carrera | cod_materia | materia | docente |
|---|---|---|---|---|---|
| 51234 | Ana | Sistemas | AED | Algoritmos | García |
| 51234 | Ana | Sistemas | BD | Base de Datos | García |
| 50987 | Juan | Civil | AM1 | Análisis I | Pérez |

Clave: **(legajo, cod_materia)**.

## 1FN
Ya está en 1FN: todos los atributos son atómicos.

## 2FN
Hay **dependencias parciales**: \`alumno\` y \`carrera\` dependen solo de \`legajo\`; \`materia\` y \`docente\` solo de \`cod_materia\`. Separamos:

- ALUMNO(**legajo**, alumno, carrera)
- MATERIA(**cod_materia**, materia, docente)
- INSCRIPCION(**legajo**, **cod_materia**)

## 3FN
Si cada materia tiene un único docente, no quedan dependencias transitivas. Pero si \`docente → departamento\`, habría que separar DOCENTE(**docente**, departamento).

> Regla mnemotécnica: cada atributo no clave depende de *la clave, toda la clave y nada más que la clave*.`,
    comments: [
      { by: 'vale_sistemas', h: 5, body: 'La regla mnemotécnica del final es oro. Gracias profe!' },
      {
        by: 'mica_ing',
        h: 26,
        body: 'Pregunta: ¿cuándo conviene **desnormalizar** a propósito?',
        replies: [
          {
            by: 'prof_garcia',
            h: 5,
            body: 'Buena pregunta para la última unidad. Resumido: cuando medís que una consulta muy frecuente es lenta por demasiados joins (reportes, contadores). Siempre como decisión consciente y documentada.',
            replies: [{ by: 'rodri_sis', h: 8, body: 'Típico: guardar el total de comentarios de un post en vez de contarlos cada vez 😉' }],
          },
        ],
      },
    ],
  },
  {
    key: 'der-biblioteca',
    community: 'base-de-datos',
    by: 'vale_sistemas',
    type: 'TEXT',
    title: 'TP de modelado: ¿alguien armó el DER de la biblioteca?',
    daysAgo: 2.6,
    quality: 0.6,
    tags: ['tp', 'consulta'],
    body: `Estamos con el TP 1 de modelado (el de la **biblioteca**) y tenemos una duda con el préstamo:

- ¿*Préstamo* es una **entidad** o una **relación** entre Socio y Ejemplar?
- Si es relación, ¿dónde va la fecha de devolución?

Nosotros lo pusimos como entidad débil, pero no estamos seguros.`,
    comments: [
      {
        by: 'lucia_dev',
        h: 3,
        body: 'Nosotros lo hicimos como **relación N:M con atributos** (fecha_prestamo, fecha_devolucion). Como un socio puede pedir el mismo ejemplar varias veces, la fecha de préstamo tiene que ser parte de la clave.',
        replies: [
          {
            by: 'vale_sistemas',
            h: 2,
            body: 'Tiene sentido. ¿Y la multa por atraso? ¿Atributo derivado?',
            replies: [{ by: 'lucia_dev', h: 1, body: 'Sí, derivado: se calcula con las fechas. Te escribo por privado y te muestro el nuestro.' }],
          },
        ],
      },
      { by: 'mica_ing', h: 8, body: 'La profe dijo en clase que ambas opciones son válidas si está bien justificado en el informe.' },
    ],
  },

  // ───────────────────────── Sistemas Operativos ─────────────────────────
  {
    key: 'fork',
    community: 'sistemas-operativos',
    by: 'vale_sistemas',
    type: 'QUESTION',
    title: 'fork(): ¿por qué este printf se imprime dos veces?',
    daysAgo: 9.4,
    quality: 0.75,
    tags: ['duda'],
    accepted: 'fork-lucia',
    body: `Tengo este código y no entiendo por qué "Hola" sale dos veces si el printf está **antes** del fork:

~~~c
#include <stdio.h>
#include <unistd.h>

int main(void) {
    printf("Hola ");
    fork();
    printf("mundo\\n");
    return 0;
}
~~~

Salida:

~~~
Hola mundo
Hola mundo
~~~`,
    comments: [
      {
        key: 'fork-lucia',
        by: 'lucia_dev',
        h: 1.4,
        body: `Es por el **buffer de stdout**. \`printf("Hola ")\` no escribe en pantalla inmediatamente: queda en un buffer en memoria del proceso (no hay \`\\n\` y la salida está en modo *line buffered*).

Cuando hacés \`fork()\`, el hijo es una **copia** del padre… incluido ese buffer con "Hola ". Después cada proceso agrega "mundo\\n" y vacía su buffer, por eso ves dos veces todo.

Probá con:

~~~c
printf("Hola ");
fflush(stdout);   // vacía el buffer antes del fork
fork();
~~~

y vas a ver "Hola mundo" y "mundo".`,
        replies: [
          { by: 'vale_sistemas', h: 0.8, body: 'Wow, no tenía ni idea de que el buffer se copiaba. Probé con fflush y es exactamente así. ¡Gracias!' },
          { by: 'rodri_sis', h: 4, body: 'Pregunta clásica de final, guárdenla.' },
        ],
      },
    ],
  },
  {
    key: 'dual-boot',
    community: 'sistemas-operativos',
    by: 'lucia_dev',
    type: 'TEXT',
    title: 'Instalar Linux en dual boot sin romper Windows (guía para la cursada)',
    daysAgo: 19.2,
    quality: 0.85,
    tags: ['recursos'],
    body: `Para los TPs de SO necesitamos Linux sí o sí. Si no quieren una máquina virtual, acá va la guía que seguí con **Ubuntu 24.04**:

1. **Backup.** Siempre. De todo.
2. En Windows: *Administración de discos* → **Reducir volumen** (dejen al menos 40 GB libres).
3. Desactiven el **inicio rápido** de Windows (Opciones de energía).
4. Creen el pendrive booteable con **Rufus** o **Ventoy**.
5. Booteen el pendrive y elijan **"Instalar junto a Windows"**.

Para comprobar que todo quedó bien:

~~~bash
lsb_release -a
gcc --version
sudo apt update && sudo apt install build-essential manpages-dev
~~~

> Si después de instalar arranca directo Windows, entren al BIOS/UEFI y pongan **ubuntu** primero en el orden de booteo.

Alternativa sin riesgos: **WSL2** en Windows 11 funciona bien para casi todos los TPs (menos los de módulos del kernel).`,
    comments: [
      { by: 'fede_electro', h: 5, body: 'Sumo Ventoy: ponés varias ISOs en el mismo pendrive. Muy cómodo.' },
      {
        by: 'nico_frt',
        h: 30,
        body: '¿WSL2 sirve para el TP de procesos con fork y señales?',
        replies: [{ by: 'lucia_dev', h: 2, body: 'Sí, eso anda perfecto en WSL2. Lo único que no podés es cargar módulos del kernel.' }],
      },
    ],
  },

  // ───────────────────────── Ingeniería en Sistemas ─────────────────────────
  {
    key: 'correlatividades',
    community: 'sistemas',
    by: 'moderadora',
    type: 'TEXT',
    title: 'Correlatividades del plan 2023: tabla resumida para no perderse',
    daysAgo: 17.3,
    quality: 0.9,
    tags: ['recursos', 'apuntes'],
    body: `Armé una tabla con las correlatividades de **primero y segundo año** de Sistemas (plan 2023). Confirmen siempre con la resolución oficial del Departamento.

| Para cursar… | Necesitás regularizada | Necesitás aprobada |
|---|---|---|
| Análisis Matemático II | Análisis Matemático I, Álgebra y Geometría | — |
| Física II | Física I, Análisis Matemático I | — |
| Paradigmas de Programación | Algoritmos y Estructuras de Datos, Matemática Discreta | — |
| Sistemas Operativos | Arquitectura de Computadoras | — |
| Base de Datos | Sintaxis y Semántica de los Lenguajes | Algoritmos y Estructuras de Datos |

**Importante:** para *rendir* el final necesitás la correlativa **aprobada**, no solo regularizada.`,
    comments: [
      {
        by: 'rodri_sis',
        h: 3,
        body: 'Esto debería estar fijado. Siempre hay alguien que se entera en la inscripción que no puede cursar algo.',
        replies: [{ by: 'moderadora', h: 2, body: 'Lo vamos a sumar a la wiki de la comunidad cuando esté lista 👍' }],
      },
      { by: 'mica_ing', h: 15, body: '¿Tenés la de tercer año también?' },
    ],
  },
  {
    key: 'pps',
    community: 'sistemas',
    by: 'mica_ing',
    type: 'QUESTION',
    title: '¿Vale la pena hacer la PPS en una empresa chica?',
    daysAgo: 6.7,
    quality: 0.6,
    tags: ['consulta'],
    body: `Me ofrecieron hacer la **Práctica Profesional Supervisada** en una software factory de 8 personas acá en Tucumán. También me postulé a una empresa grande pero todavía no me respondieron.

¿Experiencias? ¿Se aprende más en una chica o en una grande?`,
    comments: [
      {
        by: 'rodri_sis',
        h: 2,
        body: 'Yo hice la PPS en una de 10 personas y toqué de todo: backend, deploy, hablar con clientes. En una grande quizás te dan algo más acotado pero con más estructura. Las dos sirven; mirá que haya alguien que te pueda mentorear.',
        replies: [
          { by: 'mica_ing', h: 3, body: 'Eso me tranquiliza. El que sería mi tutor es senior y parece buena onda.' },
          {
            key: 'pps-santi',
            by: 'santi_k',
            h: 5,
            body: 'Si no sabés elegir entre dos laburos capaz no estás lista para la PPS jaja',
            replies: [
              {
                by: 'moderadora',
                h: 1,
                body: '@santi_k esto es un espacio para ayudar. Comentarios así no suman: te pido que leas las reglas de la comunidad.',
              },
            ],
          },
        ],
      },
      { by: 'lucia_dev', h: 9, body: 'Sumo a lo de Rodri: preguntá si tienen code review. Si revisan tu código, vas a aprender muchísimo.' },
    ],
  },
  {
    key: 'charla-pasantias',
    community: 'sistemas',
    by: 'lucia_dev',
    type: 'TEXT',
    title: 'Charla: cómo conseguir la primera pasantía en IT — jueves 19 h en el SUM',
    daysAgo: 1.5,
    quality: 0.8,
    tags: ['evento'],
    body: `Desde el grupo de estudiantes de Sistemas organizamos una charla abierta:

- **🗓 Jueves 5/11, 19:00 h**
- **📍 SUM de la facultad** (planta baja)
- **🎤 Invitados:** egresados que hoy trabajan en empresas de Tucumán y remoto

## Temas
1. Cómo armar un CV sin experiencia
2. Qué proyectos poner en GitHub
3. Entrevistas técnicas: qué esperar
4. Ronda de preguntas

Es gratis y no hace falta inscribirse. Si quieren que tratemos algún tema en particular, déjenlo en los comentarios 👇`,
    comments: [
      { by: 'nico_frt', h: 3, body: '¿Pueden ir de otras carreras? Me interesa aunque sea de Mecánica.' },
      {
        by: 'lucia_dev',
        h: 1,
        body: '¡Obvio! Está abierta a todos. @nico_frt traé a quien quieras.',
      },
      { by: 'vale_sistemas', h: 6, body: 'Propongo tema: cómo prepararse para entrevistas en inglés.' },
    ],
  },

  // ───────────────────────── Apuntes y Recursos ─────────────────────────
  {
    key: 'drive-apuntes',
    community: 'apuntes',
    by: 'sofi_mate',
    type: 'TEXT',
    title: 'Drive colaborativo de apuntes 2026 (ordenado por materia)',
    daysAgo: 27.2,
    quality: 0.95,
    tags: ['apuntes', 'recursos'],
    body: `Armamos una carpeta compartida con resúmenes **propios** de varias materias de primero y segundo año.

## Estructura

- 📁 \`1er año/\` — Análisis I, Álgebra, Física I, Química General, Sistemas y Organizaciones
- 📁 \`2do año/\` — Análisis II, Física II, AED, Sintaxis
- 📁 \`Parciales viejos/\` — solo los que la cátedra publicó oficialmente

## Cómo aportar

1. Nombrá el archivo así: \`MATERIA - Tema - Autor - Año.pdf\`
2. Solo material propio o de libre distribución.
3. Dejá un comentario acá avisando qué subiste.

El link está en la descripción de la comunidad **Apuntes y Recursos**. ¡Gracias a todos los que ya colaboraron! 📚`,
    comments: [
      { by: 'meli_quimica', h: 5, body: 'Subí mis resúmenes de Química General (estequiometría y gases).' },
      { by: 'agus_civil', h: 24, body: 'Agregué el resumen de Sistemas de Representación con las normas IRAM.' },
      {
        by: 'belu_frt',
        h: 60,
        body: 'Esto vale oro para los que recién empezamos. Gracias!!',
        replies: [{ by: 'sofi_mate', h: 2, body: 'Para eso está 💛 Cuando tengas apuntes propios, sumalos.' }],
      },
    ],
  },
  {
    key: 'spam-apuntes',
    community: 'apuntes',
    by: 'promo_apuntes',
    type: 'TEXT',
    title: 'VENDO RESÚMENES DE TODAS LAS MATERIAS 💸💸 aprobá seguro',
    daysAgo: 2.2,
    quality: 0.02,
    body: 'Tengo resúmenes y parciales resueltos de TODAS las materias de 1ro a 5to. Precios increíbles, pago por transferencia. Escribime al WhatsApp y te paso la lista!!! Aprobás seguro 💯💯',
    comments: [
      { by: 'meli_quimica', h: 1, body: 'La venta de apuntes está prohibida en esta comunidad. Reportado.' },
    ],
  },

  // ───────────────────────── Vida Universitaria ─────────────────────────
  {
    key: 'comer-barato',
    community: 'vida-universitaria',
    by: 'tomi_ing',
    type: 'TEXT',
    title: '¿Dónde se come bien y barato cerca de la facu?',
    daysAgo: 8.4,
    quality: 0.75,
    body: 'Entre clase y clase tengo una hora y el comedor siempre está lleno. ¿Qué lugares recomiendan a pocas cuadras? Presupuesto de estudiante, obvio 🥲',
    comments: [
      {
        by: 'agus_civil',
        h: 1,
        body: 'La rotisería de la esquina tiene menú del día con bebida a buen precio. Las milanesas son enormes.',
        replies: [
          { by: 'tomi_ing', h: 2, body: '¿La que está enfrente de la parada del colectivo?' },
          { by: 'agus_civil', h: 1, body: 'Esa misma. Andá antes de las 12:30 o no conseguís mesa.' },
        ],
      },
      { by: 'cami_frt', h: 4, body: 'El comedor universitario mejoró bastante este año. Si sacás el ticket temprano no hacés tanta fila.' },
      {
        by: 'belu_frt',
        h: 20,
        body: 'Las empanadas del carrito del parque son las mejores de la zona, no acepto discusión 🥟',
        replies: [{ by: 'juanpi_mec', h: 3, body: 'Confirmo. Las de carne cortada a cuchillo 👌' }],
      },
    ],
  },
  {
    key: 'asistencia',
    community: 'vida-universitaria',
    by: 'moderadora',
    type: 'TEXT',
    title: '¿El 75 % de asistencia es obligatorio en todas las materias? (hilo cerrado)',
    daysAgo: 24.2,
    locked: true,
    quality: 0.7,
    tags: ['consulta'],
    body: `Abro este hilo porque se repite mucho la pregunta.

Según el **reglamento de estudios vigente**, para **regularizar** una materia se requiere en general un **75 % de asistencia** a clases teóricas y prácticas, además de aprobar las evaluaciones. Cada cátedra puede tener condiciones particulares, que deben estar en su **planificación**.

Si trabajás, existe la posibilidad de pedir **certificado de alumno trabajador** en Alumnos.

> Cierro el hilo porque la discusión se fue de tema. Para casos particulares, consulten con la cátedra o con el centro de estudiantes.`,
    comments: [
      { by: 'juanpi_mec', h: 3, body: '¿Y si trabajo y no puedo llegar a las 8?' },
      { by: 'cami_frt', h: 4, body: 'En Eléctrica algunas cátedras toman lista solo en los prácticos.' },
      { by: 'moderadora', h: 30, body: 'Gracias a todos por los aportes. Cierro el hilo: la info oficial está en el post. 🔒' },
    ],
  },
  {
    key: 'encuesta-transporte',
    community: 'vida-universitaria',
    by: 'nico_frt',
    type: 'POLL',
    title: '¿Cómo llegan a la facu?',
    daysAgo: 4.6,
    quality: 0.65,
    poll: {
      options: ['Colectivo', 'Bici', 'Auto o moto', 'Caminando'],
      closesInDays: 10,
      weights: [6, 2, 2.5, 1.5],
    },
    body: 'El centro de estudiantes quiere pedir un bicicletero más grande y nos pidieron datos. ¡Voten!',
    comments: [
      { by: 'fede_electro', h: 2, body: 'En bici, pero el bicicletero actual está siempre lleno. Ojalá lo amplíen.' },
      { by: 'belu_frt', h: 6, body: 'Colectivo, y a la noche la frecuencia es malísima 😩' },
    ],
  },

  // ───────────────────────── Off-topic ─────────────────────────
  {
    key: 'series',
    community: 'off-topic',
    by: 'nico_frt',
    type: 'TEXT',
    title: 'Recomienden series para despejarse entre parciales',
    daysAgo: 0.8,
    quality: 0.6,
    body: 'Algo cortito, de capítulos de 20–30 minutos, para ver mientras ceno y no pensar en integrales. ¿Qué recomiendan?',
    comments: [
      { by: 'vale_sistemas', h: 1, body: '**Brooklyn Nine-Nine**. Capítulos cortos y te reís seguro.' },
      {
        by: 'rodri_sis',
        h: 2,
        body: 'Si te gusta la ciencia ficción: **Love, Death & Robots**, cada capítulo es una historia distinta.',
        replies: [{ by: 'nico_frt', h: 1, body: 'Esa la tenía anotada, arranco hoy!' }],
      },
      { by: 'sofi_mate', h: 4, body: '**The Bear** si querés sufrir un poquito (pero vale la pena).' },
    ],
  },
  {
    key: 'truco',
    community: 'off-topic',
    by: 'vale_sistemas',
    type: 'TEXT',
    title: 'Torneo de truco en el SUM este viernes 🃏',
    daysAgo: 6.4,
    quality: 0.75,
    tags: ['evento'],
    body: `¡Vuelve el torneo de truco del centro de estudiantes!

- **Viernes 18:30 h** en el SUM
- Parejas, inscripción gratuita en el momento
- Premio: **mate + termo** para la pareja ganadora 🧉

Traigan buena onda (y no se hagan los que no tienen el ancho de espadas).`,
    comments: [
      {
        by: 'tomi_ing',
        h: 2,
        body: '¿Alguien se suma de pareja? @fede_electro vos jugabas bien',
        replies: [
          {
            by: 'fede_electro',
            h: 1,
            body: 'Dale, pero yo canto el envido 😎',
            replies: [{ by: 'tomi_ing', h: 0.5, body: 'Trato hecho.' }],
          },
        ],
      },
      { by: 'belu_frt', h: 8, body: '¿Se puede ir a mirar aunque no juegue?' },
    ],
  },
];

/** Conversaciones privadas de ejemplo (horas atrás desde ahora). */
export const CONVERSATIONS: { a: string; b: string; messages: { by: string; body: string; hoursAgo: number }[]; readUpToHoursAgo?: Record<string, number> }[] = [
  {
    a: 'lucia_dev',
    b: 'vale_sistemas',
    messages: [
      { by: 'lucia_dev', body: 'Hola Vale! Te paso nuestro DER de la biblioteca como te dije en el foro.', hoursAgo: 58 },
      { by: 'lucia_dev', body: 'El préstamo lo modelamos como relación con atributos, con la fecha como parte de la clave.', hoursAgo: 57.9 },
      { by: 'vale_sistemas', body: 'Graciaaas! Lo vemos con el grupo esta noche.', hoursAgo: 55 },
      { by: 'vale_sistemas', body: 'Una duda: ¿la multa la calcularon en una vista o en la aplicación?', hoursAgo: 3 },
      { by: 'vale_sistemas', body: 'Y otra: ¿vas al grupo de estudio del jueves en la biblioteca?', hoursAgo: 2.5 },
    ],
    // Lucía no leyó los dos últimos → aparecen como no leídos.
    readUpToHoursAgo: { lucia_dev: 50, vale_sistemas: 2.5 },
  },
  {
    a: 'lucia_dev',
    b: 'prof_garcia',
    messages: [
      { by: 'lucia_dev', body: 'Buenas tardes, profe. ¿El final de AED de diciembre se puede rendir con el TP integrador entregado tarde?', hoursAgo: 120 },
      { by: 'prof_garcia', body: 'Hola Lucía. Sí, siempre que lo entregues aprobado antes de la mesa. Mandámelo por el aula virtual.', hoursAgo: 118 },
      { by: 'lucia_dev', body: 'Perfecto, muchas gracias!', hoursAgo: 117.5 },
    ],
  },
  {
    a: 'tomi_ing',
    b: 'sofi_mate',
    messages: [
      { by: 'tomi_ing', body: 'Sofi, ¿seguís dando clases de apoyo de Física? Me está costando dinámica.', hoursAgo: 80 },
      { by: 'sofi_mate', body: 'De Física no tanto, pero armamos un grupo de estudio los martes. Venite!', hoursAgo: 76 },
      { by: 'tomi_ing', body: 'Genial, ahí estaré. ¿Llevo algo?', hoursAgo: 75 },
      { by: 'sofi_mate', body: 'La guía de dinámica y ganas 😄', hoursAgo: 74 },
    ],
  },
  {
    a: 'nico_frt',
    b: 'moderadora',
    messages: [
      { by: 'nico_frt', body: 'Hola! ¿Puedo publicar un aviso de que busco compañero para el TP de Física?', hoursAgo: 30 },
      { by: 'moderadora', body: 'Hola Nico! Sí, publicalo en Física I con la etiqueta "tp". ¡Suerte!', hoursAgo: 28 },
    ],
  },
];

export const FOLLOWS: [string, string][] = [
  ['lucia_dev', 'prof_garcia'],
  ['lucia_dev', 'vale_sistemas'],
  ['lucia_dev', 'sofi_mate'],
  ['vale_sistemas', 'lucia_dev'],
  ['vale_sistemas', 'prof_garcia'],
  ['nico_frt', 'sofi_mate'],
  ['nico_frt', 'lucia_dev'],
  ['nico_frt', 'prof_garcia'],
  ['tomi_ing', 'sofi_mate'],
  ['tomi_ing', 'fede_electro'],
  ['sofi_mate', 'prof_garcia'],
  ['sofi_mate', 'tomi_ing'],
  ['mica_ing', 'lucia_dev'],
  ['mica_ing', 'prof_garcia'],
  ['rodri_sis', 'lucia_dev'],
  ['juanpi_mec', 'prof_garcia'],
  ['belu_frt', 'sofi_mate'],
  ['fede_electro', 'tomi_ing'],
  ['agus_civil', 'sofi_mate'],
  ['meli_quimica', 'sofi_mate'],
];

export const BOOKMARKS: [string, string][] = [
  ['lucia_dev', 'normalizacion'],
  ['lucia_dev', 'correlatividades'],
  ['lucia_dev', 'parcial-aed'],
  ['nico_frt', 'tips-primer-cuatri'],
  ['nico_frt', 'resumen-derivadas'],
  ['nico_frt', 'guia-git'],
  ['vale_sistemas', 'left-join'],
  ['vale_sistemas', 'parcial-aed'],
  ['tomi_ing', 'phet'],
  ['tomi_ing', 'plano-inclinado'],
  ['sofi_mate', 'drive-apuntes'],
  ['mica_ing', 'normalizacion'],
];

/** Comunidades por usuario (además de las que se suman por haber posteado/comentado). */
export const MEMBERSHIPS: Record<string, string[]> = {
  admin: ['ingreso', 'vida-universitaria'],
  moderadora: ['ingreso', 'sistemas', 'apuntes', 'vida-universitaria', 'off-topic', 'base-de-datos'],
  prof_garcia: ['analisis-matematico-1', 'algoritmos', 'base-de-datos', 'programacion'],
  lucia_dev: ['programacion', 'algoritmos', 'base-de-datos', 'sistemas-operativos', 'sistemas', 'apuntes', 'vida-universitaria'],
  tomi_ing: ['fisica-1', 'analisis-matematico-1', 'algebra-y-geometria', 'vida-universitaria', 'off-topic'],
  sofi_mate: ['analisis-matematico-1', 'algebra-y-geometria', 'fisica-1', 'apuntes', 'ingreso'],
  nico_frt: ['ingreso', 'analisis-matematico-1', 'algebra-y-geometria', 'fisica-1', 'off-topic', 'vida-universitaria'],
  vale_sistemas: ['programacion', 'algoritmos', 'base-de-datos', 'sistemas-operativos', 'sistemas', 'off-topic'],
  agus_civil: ['algebra-y-geometria', 'fisica-1', 'vida-universitaria'],
  meli_quimica: ['analisis-matematico-1', 'apuntes', 'fisica-1'],
  fede_electro: ['fisica-1', 'programacion', 'sistemas-operativos', 'off-topic'],
  cami_frt: ['fisica-1', 'vida-universitaria'],
  juanpi_mec: ['ingreso', 'programacion', 'vida-universitaria'],
  rodri_sis: ['programacion', 'algoritmos', 'base-de-datos', 'sistemas', 'off-topic'],
  mica_ing: ['algoritmos', 'base-de-datos', 'sistemas', 'programacion'],
  santi_k: ['sistemas', 'off-topic'],
  belu_frt: ['ingreso', 'analisis-matematico-1', 'vida-universitaria', 'apuntes'],
};
