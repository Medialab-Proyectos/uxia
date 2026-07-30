# UXIA — Centro de Operaciones (guía para trabajar el repo)

App React + Vite (multipágina) directa a Supabase, desplegada en Vercel. `index.html` = admin
(OperationsHub + Radar); `mdssp.html` = modelo MDSSP. Sin servidor propio salvo funciones
serverless en `api/*` (usan `service_role`, NUNCA en el navegador).

## Convenciones de código (evitan bugs ya vividos)

### Hooks de React: respetar cómo IMPORTA cada archivo (regla por archivo)
No todos los archivos importan React igual. **Antes de escribir un hook, mira la primera línea del
archivo:**

- Si importa los hooks **por nombre** (`import { useState, useRef, useEffect, useMemo, useCallback } from "react"`)
  → usa el hook **directo** (`useRef(null)`, `useCallback(...)`). **NUNCA** escribas `React.useRef`,
  `React.useState`, etc.: en esos archivos `React` **no está definido** y explota en runtime con
  `ReferenceError: React is not defined` (rompe toda la vista, no lo atrapa el build).
  Archivos así hoy: **`src/OperationsHub.jsx`**, **`src/RadarUXIA.jsx`**.
  → Si necesitas un hook nuevo, **agrégalo al import por nombre** de esa primera línea.
- Si el archivo hace `import React from "react"` (p. ej. `src/EmployeePortal.jsx`, `src/main.jsx`)
  → ahí sí puedes usar `React.useState`, etc.

`vite build` compila igual con `React.useRef` mal puesto: **el error solo aparece en el navegador.**
Verifica en `OperationsHub.jsx`/`RadarUXIA.jsx` que no haya ningún `React.` antes de subir.

### Iconos (lucide-react)
Se importan por nombre en la primera zona de imports. Si usas un icono nuevo, **agrégalo al import**
o lanza `ReferenceError` en runtime (igual que arriba, el build no lo detecta).

## Notas operativas
- Tras cada deploy, el admin debe **recargar una vez** (autosave por diff + refresco suave leen el
  bundle nuevo; si no recarga, un autosave viejo puede pisar cambios).
- Verifica compilación con `npx vite build` antes de subir. Commits/push solo cuando el usuario lo pida.
