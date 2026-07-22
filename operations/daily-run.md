# Runbook diario del pipeline operativo

Este documento define como debe funcionar el flujo operativo de UXIA para crear,
revisar, asignar y enviar tareas por empresa y subproyecto.

## Arranque local

```bash
npm run dev:local
```

Abre el panel en:

```txt
http://127.0.0.1:4173/
```

Ese comando levanta al mismo tiempo:

- Frontend: `http://127.0.0.1:4173/`
- API local: `http://127.0.0.1:8787/`

## Flujo esperado

1. Entra con correo y contrasena.
2. Selecciona la empresa.
3. Selecciona o crea el subproyecto.
4. Sube un insumo desde el subproyecto con `Subir insumo`.
5. La app analiza el archivo para ese subproyecto.
6. Si el archivo trae informacion util, crea tareas editables.
7. Si el archivo no trae informacion util, se descarta y no carga basura a la base.
8. Las tareas aparecen debajo del contexto del subproyecto como tarjetas desplegables.
9. Cada tarea se puede asignar, actualizar, enviar o borrar.
10. Cada tarea puede recibir sus propios adjuntos.

## Regla central de insumos

El usuario no crea carpetas manuales.

El usuario tampoco copia texto dentro de una caja grande de documentacion. Solo sube
archivos pequenos desde el subproyecto.

Archivos permitidos:

- `.md`
- `.txt`
- Imagenes de menos de 1 MB

El insumo no es una tarea. El insumo es solo una fuente temporal para interpretar lo
que se debe hacer. Despues del analisis, la app debe conservar tareas editables y
descartar la fuente si ya no aporta valor.

## Reglas de analisis

Cuando se sube un insumo:

- La app debe interpretar lo que se busca, no copiar literalmente todo el texto.
- Puede cruzar varias fuentes para complementar una tarea existente.
- Debe crear requerimientos claros y accionables.
- No debe crear una tarea por cada archivo.
- No debe guardar fuentes inutiles.
- No debe dejar una lista visible de "fuentes procesadas" como si fueran el resultado.
- Si el insumo no contiene informacion accionable, se elimina o se ignora.

## Documentos SIN tareas → mediciones de producto (modelo MDSSP)

No todo insumo produce tareas. Un documento puede ser **feedback o contexto para vigilar
el producto**: quejas de usuarios, resultados de pruebas de calidad/usabilidad/rendimiento,
conteo de bugs, satisfaccion del equipo, necesidades de personal, presupuesto ajustado,
dependencias/normas externas, urgencia o comparacion con la competencia.

Esa informacion NO es una tarea: es una **medicion de salud** que alimenta el mapa de
particulas de `/mdssp.html`. Cuando un insumo traiga este tipo de senales, ademas (o en vez)
de tareas, agrega al `tasks.json` un arreglo `productSignals` con una entrada por senal:

```json
"productSignals": [
  { "companyId": "bid", "client": "ClientPortal", "force": "bugs",
    "intensity": 0.6, "title": "8 bugs abiertos en el portal",
    "evidence": "Reporte QA 2026-07-16", "source": "qa-portal.md" }
]
```

- `force` es una clave del **catalogo de fuerzas** del MDSSP: `bugs`, `calidad`, `usabilidad`,
  `satisfaccion_equipo`, `presupuesto`, `tecnologia`, `dependencias`, `mercado`, `salud`
  (satisfaccion alta jala al centro), tambien `vencidas`/`tardanza`/`bloqueos` si aplica.
- `intensity` 0..1: que tan fuerte es la evidencia (pocos datos → valor bajo).
- `weight` (opcional) 0..1: cuanto le duele al producto; si se omite usa el peso por defecto.
- `client` = subproyecto (omitir para toda la empresa).
- El `daily-push.mjs` las sube a la tabla `product_signals`; el MDSSP las lee y mueve la
  particula del subproyecto. Cada entrada del catalogo ya define hacia que borde empuja.

Si el mismo tema se vuelve a medir, reusa el `id` para actualizar (upsert) en vez de duplicar.

## Si NO hay insumos pendientes, el run NO termina

Cuando no queda nada por procesar, el run diario igual DEBE hacer estas dos pasadas:

1. **Repriorizar todas las tareas activas** con los marcos de la sección siguiente
   (Pareto 80/20, Teoria de Restricciones, Covey, 12-Week-Year, GTD, OKR, Deep Work,
   Grove, Atomic Habits, Gap and Gain, Drucker/Lencioni): revisar que la `priority`
   siga siendo correcta (lo vencido/bloqueado sube, lo trivial baja), que cada tarea
   tenga `category` y siguiente accion clara, y reportar el FOCO del dia y el cuello
   de botella.
2. **Validar la cobertura de señales del MDSSP por empresa**: revisar si alguna
   empresa/subproyecto activo se quedo SIN señales de producto (`product_signals`) o
   con señales desactualizadas. Si falta cobertura, decirlo explicitamente y proponer
   que variables capturar (bugs, calidad, usabilidad, satisfaccion del equipo,
   presupuesto, tecnologia, dependencias, mercado). Las que no se puedan derivar de
   tareas se capturan a mano en /mdssp.html → Medicion.

### PESAR las fuerzas por AMPLITUD del proyecto (obligatorio — no leer los datos "en crudo")

La `intensity` de una señal NO es solo el tamaño literal del dato: es su **impacto según la
amplitud y el momento del proyecto**. Un "error pequeño" puede ser grave y uno "grande" puede ser
menor según el contexto. Antes de fijar intensidades, el MD DEBE:

1. **Leer el CONTEXTO del subproyecto** (`companies.project_descriptions` y `context_documents` de
   ese subproyecto) para entender la **amplitud**: etapa (descubrimiento / construcción / previo a
   lanzamiento / operación), fecha de lanzamiento, criticidad del flujo, alcance contratado.
2. **Amplificar por cercanía al lanzamiento y por criticidad del flujo**: una fricción o caída en el
   **flujo NÚCLEO** a **días del lanzamiento** es intensidad ALTA (0.7–0.9), aunque el dato crudo
   parezca chico (p. ej. "clics muertos" o "solo la mitad avanza en el embudo"). Un detalle cosmético
   fuera del camino crítico es intensidad BAJA aunque haya muchos.
3. **Si NO existe contexto del subproyecto**, el MD NO debe asumir amplitud baja por defecto: lo
   REPORTA como "falta contexto para valorar la amplitud de <subproyecto>" y pide subir un
   documento de contexto (o la descripción del subproyecto) para calibrar bien. Mejor señalar la
   incertidumbre que subvalorar.
4. **Insumos que son REPORTES (PDF/imagen)**: leerlos completos y con cuidado; si solo se pudo
   extraer el TEXTO (sin render visual), advertir que puede haberse perdido severidad visual
   (gráficas, mapas de calor) y validar la lectura contra la amplitud antes de fijar la intensidad.

El resultado del run sin insumos es: tareas repriorizadas + un reporte de que señales
faltan por adaptar en cada empresa.

## Lista de BUENAS PRÁCTICAS DE CRECIMIENTO por proyecto (el MD la genera)

Además de tareas y señales, el MD actúa como **consultor senior / lead de producto digital** y
genera, **por subproyecto**, una lista corta de **buenas prácticas para crecer con ese cliente/proyecto**.
Se guarda en la tabla `growth_practices` (ver `supabase/migration-growth-practices.sql`) y la app la
muestra con un botón (con logo) al lado de los indicadores; **cada ítem se puede convertir en tarea**.

Cómo la arma el MD:
- **Basado en marcos reales de influencia, ventas, crecimiento e innovación** (Cialdini/influencia;
  Hormozi/oferta y valor; Godin/marketing del permiso; Sinek/propósito; Reis-Trout/posicionamiento;
  Blank-Ries/lean startup; Cain/comunicación; Carnegie/relaciones; Duhigg/hábitos; Kahneman/decisión).
  No citar por citar: **traducir** el marco en una práctica accionable para ESTE proyecto.
- **Prioriza lo más VIABLE y de mayor IMPACTO**: pocas prácticas (3–6), que generen **conexión, apoyo
  y alivien los DOLORES** ya detectados (señales MDSSP + insumos), no genéricas.
- **Escucha el CONTEXTO y la VOZ**: usa el contexto del subproyecto, la **voz/tono del CEO** (lo que
  tiene y lo que busca) y, si el subproyecto tiene un **LEAD** asignado, su voz y tono en los insumos.
- Cada práctica: `{ titulo, porque (el dolor/oportunidad), como (acción concreta), marco, impacto,
  esfuerzo }`. El admin puede convertirla en tarea (hereda tipo/puntos estimados).

**Lead por subproyecto (para escuchar su voz):** al leer insumos, identificar quién es el **lead** de
cada subproyecto (si se menciona) y registrarlo; su voz/tono alimenta tanto las tareas como esta lista.

## Priorizacion de tareas (SIEMPRE, despues de analizar)

Cada vez que se analizan tareas o documentos nuevos y ya estan depuradas/asignadas, el MD
DEBE priorizarlas. No se entregan tareas "planas": se ordenan por impacto y se marca el
foco de la semana. La priorizacion se apoya en marcos probados de eficiencia y ejecucion:

- **Pareto 80/20 (Richard Koch)** — identificar el ~20% de tareas que produce el ~80% del
  resultado. Esas son "vitales"; el resto es "trivial muchos".
- **The 12 Week Year (Moran & Lennington)** — horizonte de 12 semanas, no de 12 meses:
  cada tarea debe apuntar a una meta trimestral concreta y medible con avance semanal.
- **Theory of Constraints (Goldratt)** — encontrar el CUELLO DE BOTELLA que frena todo el
  sistema y priorizar lo que lo destraba antes que cualquier otra cosa.
- **First Things First / Eisenhower (Covey)** — clasificar Importante vs Urgente; proteger
  el cuadrante Importante-No-Urgente (prevencion, estrategia), no vivir apagando incendios.
- **GTD (David Allen)** — toda tarea con "next action" concreta, contexto y responsable;
  nada ambiguo. Si una tarea no tiene siguiente accion clara, se reformula.
- **OKR (John Doerr)** — cada tarea se alinea a un Objetivo y aporta a un Key Result medible.
- **Deep Work (Cal Newport)** — separar trabajo profundo (alto valor, requiere foco) de
  trabajo superficial; agendar el profundo en bloques y no fragmentarlo.
- **High Output Management (Andy Grove)** — priorizar por apalancamiento: tareas que
  multiplican la salida del equipo (habilitadores, plantillas, automatizacion) van primero.
- **Atomic Habits (James Clear)** — preferir avances pequenos y consistentes; partir tareas
  grandes en pasos de 1-2 dias que se puedan cerrar.
- **The Gap and the Gain (Dan Sullivan)** — medir contra el punto de partida (avance real),
  no contra el ideal; reconocer lo cumplido para sostener el ritmo.
- **Drucker / Lencioni** — gestion por resultados y claridad de responsables; una tarea sin
  dueno no se prioriza, se asigna.

### Como se aplica en cada run

1. Marca cada tarea con una **prioridad**: `alta` (vital 20% / destraba cuello de botella /
   Importante), `media`, `baja` (trivial, se puede diferir o agrupar).
2. Elige el **FOCO de la semana** (12-Week-Year): 1-3 tareas vitales cuyo avance mueve la
   meta del trimestre. Ponlas primero.
3. Destaca el **cuello de botella** actual (Goldratt) si existe: la tarea que, si no se
   resuelve, bloquea a las demas.
4. Verifica que cada tarea tenga **siguiente accion clara + responsable + fecha** (GTD/Drucker).
5. Agenda el **trabajo profundo** (Newport) en bloques y separa lo superficial.
6. Considera **proyectos internos de MediaLab**: recuperacion economica/financiera, gestion
   de recursos, espacios y mejoras operativas de la organizacion cuentan como proyectos y
   se priorizan con la misma vara (los proyectos son de MediaLab).

La priorizacion tambien retroalimenta el modelo MDSSP: tareas vitales sin avanzar o el
cuello de botella se reflejan como fuerzas mas fuertes hacia los bordes de riesgo.

### Tareas trámite (0,5) y apalancamiento — el esfuerzo NO es la prioridad

Regla base: **`designPoints` mide ESFUERZO; `priority` mide IMPACTO.** Son ejes independientes.
Una tarea de 0,5 puntos puede ser la MÁS prioritaria del día. Fundamento en los marcos:

- **GTD — regla de los 2 minutos (Allen):** si algo se hace en menos de 2 minutos, se hace YA;
  diferirlo cuesta más que ejecutarlo (el costo de administrarlo supera el de hacerlo).
- **Teoría de Restricciones (Goldratt):** una hora perdida en el cuello de botella es una hora
  perdida para TODO el sistema. Si un trámite de 5 minutos destraba a alguien, va primero que
  cualquier tarea grande.
- **High Output Management (Grove):** el apalancamiento es la salida del equipo dividida por tu
  tiempo. Agendar la reunión que desbloquea a 3 personas es el acto de mayor apalancamiento
  disponible: 5 minutos que liberan días-persona.
- **Pareto (Koch):** el 20% vital muchas veces está disfrazado de tarea pequeña (un acceso, una
  confirmación, un espacio creado). No confundir "pequeño" con "trivial".
- **Deep Work (Newport):** los trámites son trabajo superficial → se **agrupan en un bloque**
  (una sola tanda al día), NO se riegan entre bloques de trabajo profundo.
- **Atomic Habits (Clear):** cerrar trámites a diario sostiene el ritmo y evita que se acumulen.

**Cómo se prioriza un 0,5 (aplicar SIEMPRE):**

| Situación del trámite | `priority` | Cuándo |
|---|---|---|
| Desbloquea a otra persona o al cuello de botella | **alta** | mismo día |
| Habilita el inicio de una tarea vital (FOCO de la semana) | **alta** | mismo día |
| Es administrativo/cumplimiento (ver sección siguiente) | **alta / media** | según fecha legal |
| Trámite suelto, no bloquea a nadie | **baja** | se agrupa en el bloque de trámites |

Al reportar, los 0,5 se listan como **"Bloque de trámites (N tareas · X pts)"** para que se vea
que son minutos, no días, y no compitan visualmente con las tareas grandes.

### Salud administrativa de MediaLab — prioridad por RIESGO, no por esfuerzo

Además de los proyectos de cliente, MediaLab tiene obligaciones propias cuyo incumplimiento
tiene **costo no lineal**: multas, sanciones, demandas laborales, derechos de petición vencidos,
inconformidad del equipo. Estas tareas se clasifican con `category: "Administrativo"` y se
priorizan por **riesgo de incumplimiento**, no por lo que cuesten en tiempo.

Entran aquí: **DIAN** (declaraciones, retenciones, IVA, renta), **seguridad social y planillas**,
**nómina/primas/cesantías**, **peticiones y solicitudes de empleados** (permisos, certificados,
derechos de petición), **contador** (estado de la empresa, cierres), **cámara de comercio y
renovaciones**, **contratos y otrosíes por firmar**, **facturación y cuentas de cobro del mes**.

Reglas (obligatorias):

1. Una tarea `Administrativo` **nunca queda en `baja`**. Piso mínimo: `media`.
2. Sube a **`alta`** si: faltan **≤ 5 días hábiles** para la fecha legal/límite, o **ya venció**,
   o involucra a un **empleado esperando respuesta** (petición, certificado, pago).
3. Se trata como **cuello de botella del sistema** (Goldratt) cuando está vencida: bloquea la
   operación completa aunque no bloquee ninguna tarea de proyecto.
4. En Covey: el objetivo es mantenerlas en **Importante–No urgente** (cuadrante II, preventivo).
   Si una obligación administrativa llega a urgente de forma recurrente, el MD lo reporta como
   **falla de proceso**, no como tarea suelta.
5. Estas tareas también alimentan el MDSSP como señal en el eje **económica** (`dependencias`
   para obligaciones normativas) cuando están vencidas.

### Fecha de vencimiento automática (el MD la propone; el admin la ajusta)

Ninguna tarea se entrega sin `dueDate`. El MD la calcula a partir de **esfuerzo + prioridad +
categoría**, contando **días hábiles** (sin sábados, domingos ni festivos colombianos):

| Esfuerzo | Base | Razón |
|---|---|---|
| **0,5** trámite | **mismo día** (o siguiente hábil si ya pasó la jornada) | regla de los 2 minutos (GTD) |
| **1** simple | **+2 días hábiles** | cabe en una sesión corta |
| **2** media | **+5 días hábiles** | una semana laboral (Atomic Habits: cerrable) |
| **4** compleja | **+10 días hábiles** | dos semanas, coherente con el 12-Week-Year |

Ajustes sobre la base:

- `priority: alta` o **cuello de botella** → **la mitad** del plazo (mínimo: siguiente día hábil).
- `priority: baja` → se puede extender hasta el doble, nunca más allá del trimestre en curso.
- `category: "Administrativo"` con **fecha legal** (DIAN, planilla, nómina) → **manda la fecha
  legal**, nunca se propone una posterior. Si la fecha legal ya pasó → vence **hoy** y sube a `alta`.
- Tarea que **depende de otra** → su fecha nunca es anterior a la de su predecesora.

El admin puede redefinir la fecha desde la tarjeta; al hacerlo se conserva la anterior en
`prev_due_date` (ver sección de cambios de fecha). La fecha propuesta por el MD es un punto de
partida con criterio, no una imposición.

## Instrumentacion DesignOps (SIEMPRE, en cada run — automatico)

MediaLab se posiciona como **DesignOps**: el tablero de indicadores (solo del admin) y el
**reporte semanal DesignOps** (boton "Reporte DesignOps" en la vista de indicadores) se
alimentan de datos que el MD debe **capturar y validar en CADA corrida, sin preguntar**.
Ademas de crear/priorizar tareas y mapear señales MDSSP, en cada run el MD DEBE:

1. **Estimar los puntos de esfuerzo** (`designPoints`) de **TODA** tarea vigente (regla del CEO:
   ninguna activa queda sin estimación), con la escala **0,5 = trámite** · **1 = simple** ·
   **2 = media** · **4 = compleja**:
   - **0,5 = trámite (≤ 5–10 min, sin entregable).** Agendar/crear una reunión, entrar a una
     reunión corta, abrir un espacio de trabajo, definir horarios, mandar un mensaje o un link,
     confirmar una decisión, pedir un acceso. **El esfuerzo es mínimo, pero la prioridad NO:**
     ver "Tareas trámite (0,5) y apalancamiento" más abajo. Ojo: *hacer* la reunión es 0,5;
     lo que SALE de la reunión (p. ej. **establecer el roadmap**) es una tarea aparte de 2 o 4.
   - Tareas de **diseño** (UX/UI, gráfico, research): por complejidad funcional — 1 una interacción
     (login, error), 2 formulario/listado/filtros, 4 dashboard/multi-step/validaciones encadenadas.
     Alimenta la velocidad de diseño (pts/sem) y utilización.
   - Tareas de **gestión/apoyo/comercial**: por esfuerzo — 1 un mensaje/reunión/gestión corta,
     2 un reporte/revisión/coordinación con entregable, 4 un entregable grande (p. ej. preparar un curso).
   - Tareas de **desarrollo/producto**: por esfuerzo técnico — 1 cambio pequeño/config, 2 ajuste acotado,
     4 feature grande (auditoría de logs, generación de documentos, panel completo).
   La velocidad DesignOps sigue mirando solo las de diseño; el resto puntúa para tener el esfuerzo total.
2. **Marcar Change Requests** (`changeRequest: true`) cuando el insumo indica que el cliente
   pidio un cambio DESPUES de aprobar el diseño (no es alcance original). Alimenta eficiencia.
3. **Registrar defectos de QA** (`qaDefects`, entero) cuando el insumo trae defectos UX/UI
   hallados en revision/QA de una tarea. Alimenta calidad.
4. **Registrar uso de IA y herramientas** cuando el insumo lo evidencia: `aiUsage` (0..100,
   % de IA usada en la tarea) y `tools` (arreglo, ej. `["Figma","Claude"]`). Da la visibilidad
   de "uso y consumo de IA + herramientas" que pide negocio. Si no hay señal clara, se deja vacio.
4-bis. **Mantener fresca la SATISFACCIÓN EMPRESARIAL** que consume el **portal MediaLab**. El panel
   CEO del portal de empleados de MediaLab (proyecto *MediLab/Version 1*) muestra el indicador
   **"Satisfacción empresarial"** y lo lee **EN VIVO desde este Centro de Operaciones** (vista
   `indice_proyectos`, con su `OPERACIONES_SERVICE_KEY`). **No es solo el rating** (lo que dicen los
   clientes): es un índice GENERAL de **cómo van los proyectos** (0–100) que combina:
   - **satisfacción declarada** (rating 1–5) · peso 0.40 — solo si hay calificaciones,
   - **cumplimiento / predictibilidad** (entregas a tiempo) · peso 0.35 — solo si hay entregas con fecha,
   - **salud de flujo** (sin vencidas ni bloqueos) · peso 0.25 — siempre presente.
   Si un componente no tiene datos, su peso se redistribuye. La vista se recalcula **sola**; no hay
   que sincronizar nada. Lo que el MD mantiene al día es el **DATO FUENTE** de cada componente:
   - registrar el `rating` (1–5) cuando un insumo trae feedback del cliente sobre un entregable;
   - mantener `due_date`/`completed_at` correctos (alimentan cumplimiento) y sin vencidas/bloqueos
     acumulados (alimentan flujo).
   **Validar** en cada run que el índice tiene base real y reportar cuántas tareas calificadas +
   entregas con fecha lo alimentan (lo que falte, "por instrumentar", NO inventar).
   Requiere `migration-indice-proyectos.sql`.
5. **Validar la cobertura**: al terminar, reportar que **NINGUNA tarea activa quedó sin puntos**
   (cero sin estimar) y qué empresas no tienen datos suficientes para los demás indicadores del
   reporte (utilización, defectos, consumo de IA). No inventar numeros.
6. **Actualizar peso y tipo de TODAS las tareas vigentes**: en cada corrida, revisar el
   `designPoints` (peso 1/2/4 por esfuerzo, en TODAS las tareas activas) y la `category` (tipo), y
   corregir las que estén mal estimadas o mal clasificadas. El admin puede ajustar los puntos a mano
   desde la tarjeta (selector 1·2·4); esos cambios son metadata y no avisan al empleado.
7. **Tags de IA en la tarjeta (obligatorio) + REPORTE**: cada tarea debe dejar VISIBLE en la app quién
   la tocó, y el MD debe además reportarlo por empresa/subproyecto:
   - **Píldora "IA" (generada por IA, pendiente de revisar):** toda tarea que crea el MD lleva `source`
     = "Run diario …" / "Insumo global …" (nunca "Manual"). La tarjeta muestra la píldora **"IA"** (teal)
     mientras el admin **no la haya revisado** (sin `adminTouchedAt`). En cuanto el admin la toca (cambia
     estado/persona/fecha…) o pulsa **Guardar tarea**, se sella `adminTouchedAt` y la píldora desaparece
     (ya fue revisada). Las tareas hechas a mano (`source: "Manual"`) nunca muestran la píldora. Si la
     tarea ya lleva "IA actualizó", tampoco se muestra "IA" (no se duplica).
   - **Tag "IA actualizó" (`mdTouchedAt`):** cuando el MD **complementa** una tarea que YA existía, setea
     `mdTouchedAt` = ahora; la tarjeta muestra el tag **"IA actualizó"** + banner para que el admin lo
     revise. **Al pulsar "Guardar tarea" el tag se limpia** (`mdTouchedAt` = vacío): guardar = el admin
     ya revisó lo que complementó la IA. En "Todas las tareas" hay un filtro **"Tocadas por IA"**.

### Antes de complementar una tarea existente: VALIDAR el estado (obligatorio)

Cuando el MD va a complementar una tarea que ya existe, **primero valida en qué punto del ciclo está**:

- **Si la tarea YA fue enviada al cliente** (`verificacion`) **o está en revisión** (`review`), NO se
  puede cambiar el alcance por debajo: lo que está en manos del cliente debe quedar como está.
  - Si el contexto nuevo es **el mismo trabajo** (más detalle, evidencia, una decisión) → se enriquece
    la `description` y se sella `mdTouchedAt`, sin tocar el estado.
  - Si el contexto nuevo es **otro alcance / otra tarea** → **NO** se mete en esa tarea: se abre un
    **Request Review** (entrada en `change_requests`, `by:'cliente'` o `'ceo'` según el origen) que
    describe el cambio, con lo que la tarea vuelve a **`doing`**; o se crea una **tarea nueva** si es un
    pendiente genuinamente distinto. Así queda el rastro de por qué se movió algo ya entregado.
- Si la tarea está en `ready`/`doing`/`blocked`, se complementa normal (enriquecer + `mdTouchedAt`).

### Cambios de fecha de entrega: con MOTIVO y se conserva la anterior (obligatorio)

Cambiar el **vencimiento** de una tarea NO es libre: un cambio de fecha viene de un **request review**
o de algo **externo** a la tarea, así que **hay que decir por qué**.
- **Poner la PRIMERA fecha** (la tarea no tenía) se hace directo, sin popup.
- **Cambiar una fecha ya guardada** abre un **popup que pide el MOTIVO**; hasta que no se escribe y se
  pulsa "Aceptar cambio de fecha", el cambio NO se aplica.
- **El motivo se pide UNA VEZ POR CICLO DE GUARDADO.** Si te equivocaste al elegir la fecha, puedes
  volver a corregirla las veces que necesites **sin que se pida otra vez**, mientras la tarjeta siga
  SIN guardar. Al pulsar **"Guardar tarea"** se cierra el ciclo: un cambio de fecha posterior vuelve a
  exigir motivo. La `prev_due_date` guarda siempre la **última fecha guardada**, nunca un valor
  intermedio de la corrección.
- Al aceptar se guarda la **fecha previa** en `prev_due_date` y el **motivo** en `due_change_reason`;
  la tarjeta muestra *"Fecha movida · antes vencía el dd/mm/aaaa · motivo: …"*. Es el soporte para
  justificar el corrimiento ante el cliente y alimenta el indicador de "compromisos movidos".
- El empleado no puede alterar estas columnas (las protege el trigger). Requiere
  `supabase/migration-prev-due-date.sql` (incluye `prev_due_date` + `due_change_reason`; ya está en `setup.sql`).

### Finalizar una tarea SIEMPRE abre el popup de satisfacción

Pasar una tarea a **Finalizada** (desde la tarjeta o desde la **vista de prioridad**) abre el popup de
satisfacción tras entrega (experiencia 1–5, feedback, % de IA, herramientas) antes de cerrarla. Ese
`rating` es el que alimenta la satisfacción empresarial (ver 4-bis). No se finaliza en silencio.
   - **Peso/tipo:** los cambios de `designPoints`/`category` son metadata y **NO** llevan `mdTouchedAt`
     (no saturan al empleado); se reportan en el resumen, no como novedad.
   - **Reporte final**, por empresa/subproyecto: tareas **creadas** (con tipo y peso), tareas
     **complementadas** (mdTouchedAt), **cambios de peso/tipo**, e insumos que **no** se pudieron
     convertir (corruptos/vacíos, sin inventar). Trazabilidad total: con leer el reporte se sabe qué
     hizo la IA y por qué.

**Vencidas y Request Review SÍ son indicadores DesignOps (no solo un tag en la tarjeta).** El
reporte y el tablero los convierten en gestión:
- **Predictibilidad:** entregas en fecha ÷ comprometidas · desviación de fechas · **compromisos
  movidos** (`prev_due_date`: cuántas veces se corrió el vencimiento, con la fecha anterior como
  soporte ante el cliente) · **vencidas sin cerrar** (con las más urgentes listadas y una
  recomendación de priorización).
- **Eficiencia / retrabajo:** **tasa de retrabajo** (% de tareas con al menos un request review,
  meta ≤20%) · **abiertos ÷ totales** · **origen del retrabajo (cliente ÷ interno)** — si el cliente
  pide más cambios que la revisión interna, el alcance se está cerrando mal; si son internos, falta
  autorrevisión. Cada uno con su recomendación accionable.
Por eso el MD debe mantener limpios `due_date`/`prev_due_date` y `change_requests`: son la materia
prima de esos indicadores.

**Honestidad (obligatoria):** el MD solo pone datos que puede sustentar en el insumo o en una
estimacion de complejidad razonable. Lo que no se puede derivar se deja vacio y se reporta como
"por instrumentar" — NUNCA se rellena con cifras inventadas. Las metricas que ya salen solas de
los datos (predictibilidad de fecha, cycle time, throughput, WIP, satisfaccion) no se tocan.

Estos campos se escriben en el `tasks.json` del run (`designPoints`, `qaDefects`,
`changeRequest`) y el `daily-push.mjs` los sube. El empleado NO puede alterarlos (los protege
el trigger de la base); solo el admin o el MD.

## Novedades y ciclo de revisión / Change Requests (normas del producto)

Estas reglas rigen cómo fluye una tarea entre el empleado y el administrador. El MD debe
respetarlas al crear/actualizar tareas y NO romper el ciclo.

**Tipos de "novedad" para el empleado** (todas son subconjunto de las ACTIVAS):
- **Nueva**: recién asignada, nunca abierta (`assignee_seen_at` null).
- **Cambio solicitado (Change Request)**: hay un CR abierto en `change_requests`. Es la más
  urgente; el empleado debe ajustar y reenviar a revisión.
- **Actualizada**: el admin editó la tarea (`admin_touched_at` > `assignee_seen_at`) sin CR abierto.
- Las ediciones o cambios de estado del PROPIO empleado NO son novedad para él.
- En el portal, "Novedades" NO es un chip hermano de "Activas": al elegir **Activas** aparece
  DEBAJO un sub-filtro por tipo de novedad (Todas · Con novedad · Nuevas · Cambios solicitados ·
  Actualizadas por el admin), con su CONTEO entre paréntesis. La campana del empleado vive en el
  HEADER del shell (junto al tema) y sus alertas se marcan vistas al abrirlas.
- **Alertas por IDENTIDAD, no por conteo** (campana del admin y del empleado): una alerta se
  recuerda vista por la FIRMA de las tareas que la componen (sus ids), no por el número. Así
  reaparece si entra o cambia una tarea aunque el total coincida (p. ej. el empleado aprueba/resuelve
  un request review y la tarea vuelve a revisión). Al pulsar una alerta, navega a su filtro y se marca
  vista. El portal del empleado además **recarga al volver a la pestaña** para no quedar con datos viejos.

**Ciclo de estados (6 estados):** `ready` (Pendiente) · `doing` (En proceso) · `review`
(En revisión — del EMPLEADO) · `verificacion` (Verificación — del CLIENTE, solo admin) ·
`blocked` (Bloqueada) · `done` (Finalizada).
- El empleado solo mueve la tarea a **`doing`** o **`review`** (él cree que está lista). NO finaliza
  ni pasa a verificación. En el selector de estado del admin, **`review` NO es clickeable** (es un
  estado que pone el empleado); el admin la mueve con Aprobar/Devolver.
- Que el empleado marque `review` **NO es un request review** (no hubo gestión de cambios). Aparece
  como una **nota antes del contenido de la tarjeta** ("El empleado la marcó lista…") con dos botones
  en línea: **Aprobar** (→ `verificacion`, la manda al cliente) y **Devolver**.
- **Devolver = abrir un request review**: no manda a `doing` en silencio, sino que abre el popup para
  registrar el MOTIVO del cambio (queda en el historial) y recién ahí vuelve a `doing`. Así toda
  devolución queda explicada. Vale tanto para la nota de `review` (origen CEO) como para la de
  `verificacion` (origen Cliente = el cliente pidió ajustes).
- Sobre lo que está en `verificacion` (el cliente lo está revisando): nota equivalente con **Finalizar**
  (→ `done`, abre el modal de satisfacción) y **Devolver** (abre el request review, → `doing`).
- **Request review / pedir un cambio** = se crea con el **botón "Request review" al lado de Puntos**
  (abre un popup con origen CEO/Cliente + descripción). Al pedirlo, agrega un CR a `change_requests`,
  la tarea vuelve a **`doing`** (estado anterior, NO verificación) y se sella `admin_touched_at`.
- **El acordeón "Historial de request review" (debajo de Puntos) es SOLO seguimiento** (lista de los
  CR con su estado y el comentario con que el empleado los resolvió). Los CR NUEVOS no se crean ahí,
  sino desde el botón del popup. Colapsado por defecto; un puntico avisa si hay CR abiertos.
- La "revisión" del empleado (`review`) ≠ la "verificación" del cliente (`verificacion`): el empleado
  avisa que cree que está lista; el admin valida internamente y recién ahí la manda al cliente.
- **No hay botón "Marcar revisada".** El tag "Actualizada por el empleado" (`employee_touched_at`) se
  limpia solo cuando el admin ACCIONA sobre la tarea (cambia estado, categoría/tipo o pide un cambio).

**Change Requests (`change_requests` jsonb):** lista `[{ id, at, by:'ceo'|'cliente', text,
resolved, resolved_at, resolved_comment }]`. El origen distingue **CEO** (revisión interna) vs
**Cliente** (trasladado por el CEO). Alimenta el indicador de eficiencia del tablero DesignOps (cuenta
CR ABIERTOS). El empleado SÍ puede **resolver** un CR abierto desde su portal (lo marca resuelto, la
tarea pasa a `review`, y su comentario va en `resolved_comment` DENTRO del CR, NO en los comentarios
generales de la tarea); el trigger de la base ya no revierte esa columna. Un CR abierto hace que la
tarea sea "Cambio solicitado" para el empleado (prioridad sobre "Nueva"/"Actualizada", excluyentes).
El MD normalmente NO crea CRs (los abre el admin al revisar); solo si un insumo describe
explícitamente un cambio pedido por el cliente sobre un entregable ya aprobado, puede registrarlo.

## Interfaz del Centro de Operaciones (normas de UI refinadas)

Reglas de presentación acordadas con el CEO (para que la app no se sature y sea consistente):

- **Arranque de sesión:** cada login abre SIEMPRE el **Centro de Operaciones**; el Radar es una
  opción secundaria del menú, nunca la primera vista. Se fuerza en login y logout.
- **Filtros de "Todas las tareas":** **Empresa** y **Responsable** son **desplegables** (pueden ser
  muchos, no caben en carrusel); **Proyecto** es un **carrusel** (etiqueta arriba, chips debajo).
  Responsable filtra por persona. Estado y tipo de tarea también van como carrusel.
- **Comentarios de la tarea:** al abrir la tarea se ven **los 3 últimos** (recientes arriba) dentro de
  un área con **scroll** para los anteriores; cada comentario se **acota a 2 líneas**. Los comentarios
  deben ser **cortos**. Los comentarios de un request review NO van aquí (van en el CR).
- **Puntos + Request review:** la caja de Puntos muestra los `designPoints` y, a su lado, el botón
  **Request review** (que en responsive ocupa todo el ancho si baja de línea). Debajo, el acordeón de
  **historial** (solo seguimiento).
- **Sin ruido redundante:** en el portal del empleado, cada tarea muestra el color de prioridad SOLO
  en el badge de score (no hay punto de color extra a la derecha). No se muestran puntos por tarea al
  empleado.
- **Modo oscuro:** las tarjetas y sus fondos deben respetar el tema oscuro (fondos por clase, no por
  `style` inline, para que el remapeo de `index.html` los alcance).
- **Guardado POR TAREA:** cada tarjeta se guarda con su botón **"Guardar tarea"** (guardado explícito
  con confirmación "Guardada ✓"), no con autosave silencioso. Guardar una tarea no revierte cambios de
  otra.
- **Reporte e indicadores:** el **tablero de indicadores** es **solo del admin**. Hay **un solo** botón
  de reporte, **"Reporte DesignOps"**, adaptado al periodo (no un "Imprimir" aparte). El panel de
  indicadores en pantalla debe ser completo; el reporte descargable en PDF lo complementa.

## Como debe verse una tarea

Las tareas viven debajo de `Contexto del subproyecto`.

El bloque `Tareas del subproyecto` debe ser un acordeon. Cerrado muestra el resumen
del subproyecto; abierto muestra todas las tareas. Cada tarea tambien puede abrirse
hacia abajo como acordeon.

El acordeon del subproyecto debe mostrar:

- Total de tareas.
- Tareas sin asignar.
- Tareas vencidas.

La tarjeta debe tener solo lo necesario:

- Titulo de la tarea.
- Descripcion clara de la tarea.
- Persona asignada.
- Estado.
- Fecha de vencimiento.
- Adjuntos de esa tarea.
- Acciones por iconos.

La tarjeta cerrada debe permitir entender la tarea sin abrirla:

- Titulo.
- Fecha de publicacion, solo lectura.
- Fecha de vencimiento.
- Estado.
- Persona asignada.
- Medio de reporte: WhatsApp, Google Chat, correo o sin medio.

No debe mostrar:

- Solicitud original.
- Historia de usuario.
- Criterios de aceptacion.
- Evidencia y detalle.
- Texto completo del insumo.
- Lista de fuentes procesadas como bloque principal.

## Adjuntos por tarea

Los adjuntos pertenecen a una tarea especifica.

La lista de adjuntos debe estar dentro de la tarea. Si no hay archivos, queda vacia.

Cada adjunto debe poder eliminarse desde la misma lista.

Cada adjunto debe poder descargarse desde la misma lista.

Los adjuntos no son el insumo original que creo la tarea. Son documentos adicionales
que el usuario va subiendo para complementar esa tarea.

## Acciones de la tarea

Las acciones deben ser compactas y usar iconos de `lucide-react`.

Acciones esperadas:

- Adjuntar archivo a la tarea.
- Descargar adjuntos de la tarea.
- Eliminar tarea.
- Abrir o actualizar plataforma externa, por ejemplo Trello.
- Notificar por WhatsApp si la persona asignada es externa y tiene telefono.
- Notificar por Google Chat si la persona asignada es MediaLab y tiene link de chat.
- Cambiar estado.
- Cambiar vencimiento con selector de fecha.
- Cambiar persona asignada.

Los controles de asignacion, estado y vencimiento deben ser pequenos y no
salirse de la tarjeta en responsive.

## Estados

Estados operativos esperados (6):

- Pendiente (`ready`).
- En proceso (`doing`).
- En revisión (`review`) — el empleado cree que está lista.
- Verificación (`verificacion`) — el admin la mandó al cliente para que verifique (solo admin).
- Bloqueada (`blocked`) cuando falte acceso, decision o informacion.
- Finalizada (`done`).

El estado debe poder cambiarse desde la tarjeta de la tarea. `verificacion` solo la asigna el admin
(al aprobar la revisión del empleado); el empleado nunca la pone.

## Retrasos

Una tarea esta vencida cuando la fecha de vencimiento ya paso y la tarea no esta
finalizada.

Si una tarea esta vencida, la tarjeta debe mostrar una alerta visible. La persona
responsable o manager debe poder reportar el retraso, notificar a las partes y pedir
ampliar la fecha.

El mensaje de retraso debe incluir:

- Nombre de la tarea.
- Subproyecto.
- Fecha vencida.
- Solicitud de revisar bloqueo y ampliar la fecha.
- Link de Trello, Jira, Notion u otra plataforma si existe.

## Personas y empresas

No todas las personas pertenecen a todas las empresas.

Al crear una persona desde una empresa, esa persona queda asociada a la empresa
activa. Al asignar una tarea, el desplegable debe mostrar solo las personas
permitidas para esa empresa.

**Login por empresa (empleados externos):** cada empleado externo pertenece a UNA empresa
(`people.company_id`) y accede por el **link de esa empresa** (`…/?c=<token>`), que brandea el
login y el header con el logo de la empresa y le muestra SOLO las tareas de esa empresa. Al crear
su acceso se le da usuario + contraseña y su empresa. Los empleados de **MediaLab** entran por el
**link principal**. La seguridad real la dan Supabase Auth + RLS (el empleado solo ve SUS tareas);
el token del link es branding/anti-enumeración. Requiere `migration-login-empresa.sql`.

**Líderes de subproyecto:** un subproyecto puede tener líderes (empleados MediaLab, se asignan en
el admin → panel de la empresa → "Líderes de subproyecto"). Desde su portal el líder puede **crear
tareas** y **subir insumos** a su subproyecto, y **editar/borrar SOLO las tareas que él crea**
(`tasks.created_by`). El MD trata esas tareas e insumos como cualquier otra entrada del subproyecto.
Lo permiten las políticas RLS + `app_is_lead()`. Requiere `migration-subproject-leads.sql`.

Datos minimos de una persona:

- Nombre.
- Correo.
- WhatsApp con indicativo, si aplica.
- Tipo: `Empleado MediaLab` o `Externo`.
- Link de Google Chat, si es MediaLab y aplica.

## Envio y notificacion

Cuando la tarea ya esta revisada, se puede enviar desde la tarjeta.

Reglas:

- Si el subproyecto tiene plataforma conectada o link, el icono abre esa plataforma
  para actualizar seguimiento.
- Si la persona asignada es externa y tiene WhatsApp, se puede abrir WhatsApp con el
  mensaje de la tarea.
- Si la persona asignada es MediaLab y tiene Google Chat, se puede abrir su chat.
- Si no hay conexion o link configurado, la tarea queda lista pero no se envia
  automaticamente.

## Supabase

En local la app puede conectarse a Supabase usando las variables de entorno. El flujo
debe guardar empresas, subproyectos, personas, tareas, estados, fechas, descripcion,
adjuntos y links.

La base no debe llenarse con insumos inutiles. El resultado importante son las tareas
editables.

Si se necesita asociar personas por empresa, corre tambien:

```txt
supabase/patch-people-company-ids.sql
```

## Responsive

La aplicacion debe funcionar bien en pantallas pequenas.

Reglas de interfaz:

- Los botones de accion deben ser iconos compactos.
- Los selects y fechas no deben salirse de la tarjeta.
- La tarea debe leerse completa sin romper el layout.
- Las tarjetas deben poder abrirse y cerrarse comodamente en movil.
- No debe haber paneles gigantes debajo de cada empresa que confundan el flujo.

## Formato recomendado para insumos `.md` o `.txt`

```md
# Proyecto: Nombre del subproyecto

Cambiar el logo de la pagina principal.
Verificar a donde llega la informacion de los formularios.
Confirmar si falta acceso al tablero de Trello.
```

La app debe convertir ese texto en tareas claras, no copiarlo completo como
"solicitud original".

---

## Run diario CON Claude Code (el "MD" que corre el CEO aquí)

El análisis de los insumos (sobre todo **imágenes**: chats, capturas, posts) NO lo
hace la app. Lo hace **Claude Code local**, que tiene visión para leer las imágenes.
La app solo **recolecta** los insumos en Supabase (`insumos_pendientes` + Storage).

Requisitos en `.env.local`: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
(más el bucket público `operations-documents` y la tabla `insumos_pendientes`
de `supabase/schema-insumos-pendientes.sql`).

**Cuando el CEO diga "corre el MD del día", Claude Code hace:**

1. **Bajar insumos pendientes:**
   ```bash
   npm run daily:fetch
   ```
   Descarga las imágenes a `operations/_run/` y escribe `operations/_run/insumos.json`.

2. **Analizar (Claude):** leer cada imagen (`operations/_run/*`) y cada `rawText`,
   e identificar (a) **tareas** claras por empresa/subproyecto y (b) **mediciones de
   producto** (feedback/contexto sin tarea, ver sección de fuerzas MDSSP). Además
   **priorizar** cada tarea (ver sección de priorización: Pareto, cuello de botella,
   urgencia). Escribir `operations/_run/tasks.json`:
   ```json
   {
     "tasks": [
       { "title": "…", "companyId": "…", "client": "…", "description": "…",
         "status": "ready", "priority": "alta|media|baja", "dueDate": "2026-07-16",
         "role": "…", "attachments": [] }
     ],
     "productSignals": [
       { "companyId": "…", "client": "…", "force": "bugs|calidad|usabilidad|satisfaccion_equipo|presupuesto|tecnologia|dependencias|mercado|salud|vencidas|tardanza|bloqueos",
         "intensity": 0.6, "title": "…", "evidence": "…", "source": "<archivo>" }
     ],
     "processedInsumoIds": ["<id de cada insumo convertido>"],
     "keepFileInsumoIds": ["<ids cuyo archivo queda como adjunto de la tarea>"]
   }
   ```
   Reglas de análisis (aplicar SIEMPRE):
   - Título accionable, descripción clara, responsable sugerido (`role`/owner), vencimiento.
   - Cruzar varias fuentes; **no** una tarea por archivo; **dedup** contra tareas existentes.
   - **Complementar tareas existentes**: si un insumo enriquece una tarea que YA existe
     (más contexto, aclara el alcance, aporta datos de finalización), en vez de crear una
     nueva, incluye en `tasks.json` esa tarea con su **`id` real** + los campos actualizados
     (descripción ampliada, etc.) y marca **`mdTouchedAt`** con la fecha/hora actual. El
     `daily-push` hace upsert por id. En la app, el admin verá el tag **"Tocada por el MD"**
     y debe revisarla/accionar. NO cambies el responsable ni el estado del empleado al
     complementar.
   - Cada tarea con `priority` (alta = vital 20% / cuello de botella / urgente).
   - **`designPoints` en TODA tarea**, escala `0.5` · `1` · `2` · `4` (ver DesignOps). Recordar:
     esfuerzo ≠ prioridad. Un trámite de `0.5` que desbloquea a alguien lleva `priority: alta`.
   - **`dueDate` SIEMPRE calculada** con la tabla de "Fecha de vencimiento automática"
     (0,5 → hoy · 1 → +2 hábiles · 2 → +5 hábiles · 4 → +10 hábiles; alta = la mitad;
     `Administrativo` con fecha legal = manda la fecha legal). Contar días HÁBILES en Colombia.
   - **Obligaciones propias de MediaLab** (DIAN, planillas, nómina/primas/cesantías, peticiones
     de empleados, contador, renovaciones) → `category: "Administrativo"`, nunca `priority: baja`,
     y `alta` si faltan ≤5 días hábiles, ya venció, o hay un empleado esperando respuesta.
   - **Tipo de tarea por CONTEXTO** (`category`): a partir de lo que pide el insumo, clasifica
     la tarea en una categoría del alcance (ej. Diseño UX/UI, Desarrollo, Gestión de proyecto,
     QA, Infraestructura, Comercial…). Ponla en `category` y coherente con `role`.
   - **NO asignar responsable** (`assigneeId`): las tareas se dejan SIEMPRE sin responsable.
     Que estén sin asignar es la forma en que el CEO sabe qué le falta revisar/asignar (lo
     hace en la plataforma con el filtro "Sin responsable"). Se puede mencionar en la
     descripción a quién sugiere el contexto, pero NO se pone en `assigneeId`.
   - Si un insumo trae señales de salud del producto (bugs, quejas, satisfacción, calidad,
     tecnología, presupuesto, dependencias, mercado), agregar `productSignals` (mueven el MDSSP).
   - Insumo sin nada accionable ni medible → solo `processedInsumoIds` (se retira, sin basura).

3. **Subir tareas y limpiar insumos:**
   ```bash
   npm run daily:push
   ```
   Inserta las tareas en Supabase y retira los insumos procesados (borra el archivo
   salvo los de `keepFileInsumoIds`, que quedaron como adjunto de una tarea).

Así el CEO sube insumos desde el celular durante el día y, en casa/remoto, le dice a
Claude Code que corra el MD: las tareas quedan creadas, las imágenes procesadas se
borran, y solo queda información textual accionable.

## Notificaciones (PWA)

La app se instala como aplicación (PWA) en Android/iOS/Windows/Mac desde el navegador
("Instalar app" / "Añadir a inicio"). El botón de campana ⤳ (BellRing) en el header pide
permiso y suscribe el dispositivo al push.

**Resumen diario:** el cron `api/notify-cron` corre 1 vez al día (13:00 UTC) y envía a cada quien un
**resumen de pendientes**: el empleado recibe sus vencidas / por vencer / nuevas / actualizadas por
el MD / con cambios solicitados; el CEO recibe cuántas esperan su revisión y cuántas están vencidas.
Solo notifica si hay algo pendiente.

**Instantáneas por evento** (`api/notify-event` + `src/notify.js`):
- Empleado pasa una tarea a **revisión** → avisa al CEO al instante.
- Empleado **resuelve un cambio solicitado** → avisa al CEO.
- CEO **pide cambios** (CR abierto) → avisa al responsable.
- **Corrida del MD** (`scripts/daily-push.mjs`) → un push-resumen por responsable con sus tareas
  nuevas/complementadas.

Requiere VAPID en el entorno y la tabla `push_subscriptions` (`migration-push.sql`).
