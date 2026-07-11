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

Estados operativos esperados:

- Enviada o pendiente.
- En proceso.
- Finalizada.
- Bloqueada cuando falte acceso, decision o informacion.

El estado debe poder cambiarse desde la tarjeta de la tarea.

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
   e identificar tareas claras por empresa/subproyecto. Escribir
   `operations/_run/tasks.json`:
   ```json
   {
     "tasks": [
       { "title": "…", "companyId": "…", "client": "…", "description": "…",
         "status": "ready", "dueDate": "2026-07-15", "attachments": [] }
     ],
     "processedInsumoIds": ["<id de cada insumo convertido>"],
     "keepFileInsumoIds": ["<ids cuyo archivo queda como adjunto de la tarea>"]
   }
   ```
   La tarea queda **clara y bien escrita** (título accionable, descripción,
   responsable sugerido, vencimiento).

3. **Subir tareas y limpiar insumos:**
   ```bash
   npm run daily:push
   ```
   Inserta las tareas en Supabase y retira los insumos procesados (borra el archivo
   salvo los de `keepFileInsumoIds`, que quedaron como adjunto de una tarea).

Así el CEO sube insumos desde el celular durante el día y, en casa/remoto, le dice a
Claude Code que corra el MD: las tareas quedan creadas, las imágenes procesadas se
borran, y solo queda información textual accionable.
