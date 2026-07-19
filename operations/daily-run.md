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

El resultado del run sin insumos es: tareas repriorizadas + un reporte de que señales
faltan por adaptar en cada empresa.

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

## Instrumentacion DesignOps (SIEMPRE, en cada run — automatico)

MediaLab se posiciona como **DesignOps**: el tablero de indicadores (solo del admin) y el
**reporte semanal DesignOps** (boton "Reporte DesignOps" en la vista de indicadores) se
alimentan de datos que el MD debe **capturar y validar en CADA corrida, sin preguntar**.
Ademas de crear/priorizar tareas y mapear señales MDSSP, en cada run el MD DEBE:

1. **Estimar los puntos de diseño** (`designPoints`) de cada tarea de diseño segun su
   complejidad funcional, con el modelo de la propuesta: **1 = simple** (una interaccion:
   login, error, splash), **2 = media** (formulario, listado, filtros), **4 = compleja**
   (dashboard, multi-step, validaciones encadenadas). Si una tarea no es de diseño (gestion,
   comercial, apoyo) se deja sin puntos. Alimenta velocidad (pts/sem) y utilizacion.
2. **Marcar Change Requests** (`changeRequest: true`) cuando el insumo indica que el cliente
   pidio un cambio DESPUES de aprobar el diseño (no es alcance original). Alimenta eficiencia.
3. **Registrar defectos de QA** (`qaDefects`, entero) cuando el insumo trae defectos UX/UI
   hallados en revision/QA de una tarea. Alimenta calidad.
4. **Registrar uso de IA y herramientas** cuando el insumo lo evidencia: `aiUsage` (0..100,
   % de IA usada en la tarea) y `tools` (arreglo, ej. `["Figma","Claude"]`). Da la visibilidad
   de "uso y consumo de IA + herramientas" que pide negocio. Si no hay señal clara, se deja vacio.
5. **Validar la cobertura**: reportar explicitamente cuantas tareas de diseño quedaron SIN
   puntos estimados, y que empresas no tienen datos suficientes para los indicadores del
   reporte (velocidad, utilizacion, defectos, consumo de IA). No inventar numeros.

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
  Actualizadas por el admin). La campana del empleado vive en el HEADER del shell (junto al tema)
  y sus alertas se marcan vistas al abrirlas; no reaparecen salvo que el conteo vuelva a subir.

**Ciclo de estados (6 estados):** `ready` (Pendiente) · `doing` (En proceso) · `review`
(En revisión — del EMPLEADO) · `verificacion` (Verificación — del CLIENTE, solo admin) ·
`blocked` (Bloqueada) · `done` (Finalizada).
- El empleado solo mueve la tarea a **`doing`** o **`review`** (él cree que está lista). NO finaliza
  ni pasa a verificación. En el selector de estado del admin, **`review` NO es clickeable** (es un
  estado que pone el empleado); el admin la mueve con Aprobar/Devolver.
- Que el empleado marque `review` **NO es un request review** (no hubo gestión de cambios). Aparece
  como una **nota antes del contenido de la tarjeta** ("El empleado la marcó lista…") con dos botones
  en línea: **Aprobar** (→ `verificacion`, la manda al cliente) y **Devolver** (→ `doing`).
- Sobre lo que está en `verificacion` (el cliente lo está revisando): nota equivalente con **Finalizar**
  (→ `done`, abre el modal de satisfacción) y **Devolver** (→ `doing`).
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
