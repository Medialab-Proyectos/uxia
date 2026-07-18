---
title: "MDSSP: un modelo físico de partículas para el diagnóstico dinámico de la salud de proyectos socio-técnicos de producto digital"
author: "Christian Benavides Erazo — MediaLab Ingeniería"
date: "2026-07-17"
keywords: [modelo socio-técnico, sistema masa-resorte, Runge-Kutta, triángulo de Reuleaux, región factible, UX, salud de proyecto]
abstract: >
  Se presenta el Modelo Dinámico de Salud de Subproyectos (MDSSP), una formulación
  físico-matemática que representa cada subproyecto de producto digital como una
  partícula puntual sometida a un campo de fuerzas derivado de señales operativas y
  de experiencia de usuario. El espacio de operación factible se define como la
  intersección de tres discos —los tres límites del negocio: falla económica,
  rendimiento inaceptable y alta carga de trabajo— cuya frontera es un triángulo de
  Reuleaux. La dinámica es un sistema masa-resorte sobre-amortiguado integrado con
  Runge-Kutta de cuarto orden; el diagnóstico surge de la pertenencia del centro de
  masa de la partícula a los discos extremos y marginales. El modelo es un puerto
  fiel del motor físico `traer.physics` de la tesis de origen, extendido con un
  catálogo trazable de fuerzas y un mecanismo de salud que atenúa —sin rotar— la
  resultante de riesgo.
---

# 1. Introducción

La gestión simultánea de múltiples subproyectos de producto digital exige un
instrumento que condense señales heterogéneas —tareas vencidas, bloqueos,
satisfacción, bugs, presupuesto, dependencias externas— en un diagnóstico
**dinámico, visual y trazable** del estado de cada subproyecto. El MDSSP aborda
este problema trasladando el estado de un subproyecto a la **posición de una
partícula** dentro de una región de operación factible: mientras la partícula
permanezca en el interior, el subproyecto está en equilibrio; a medida que las
fuerzas de riesgo la desplazan hacia un borde, el subproyecto entra en riesgo y,
si cruza un límite extremo, en falla.

El modelo reproduce el motor físico de la tesis de origen (fork `traer.physics`,
integrador Runge-Kutta y documento *"5. Modelo del sistema físico"*) y lo adapta al
dominio de operaciones de una agencia de producto: se conserva la **masa unitaria
constante**, la **ley de Hooke con amortiguación**, la **fricción viscosa** que
suprime la oscilación, la **fuerza externa persistente** que empuja hacia los
límites, y la **región factible como intersección de discos** con inicialización en
su círculo máximo inscrito.

Aporte respecto al modelo físico base:

1. Un **catálogo de fuerzas** que mapea de forma trazable cada señal de negocio o de
   UX a (eje de riesgo, peso, intensidad).
2. Un mecanismo de **salud** que representa el producto sano como una fuerza que
   **reduce la magnitud** de la resultante de riesgo conservando su dirección, en
   lugar de introducir un vector propio que la haría rotar.
3. Un **pipeline de datos → señales** que estima intensidades en tiempos relativos
   y las atenúa por confianza (cantidad de evidencia).

# 2. Notación

| Símbolo | Significado |
|---|---|
| $i \in \mathcal{A}=\{\text{econ}, \text{rend}, \text{carga}\}$ | índice de los tres ejes/límites |
| $\mathbf{c}_i \in \mathbb{R}^2,\; R$ | centro y radio del disco extremo del eje $i$ |
| $\rho R$ | radio del disco **marginal** ($\rho=0{,}93$) |
| $\Omega=\bigcap_i \mathcal{B}(\mathbf{c}_i,R)$ | región de operación factible |
| $\mathbf{p}^\*,\; r^\*$ | centro y radio del círculo máximo inscrito en $\Omega$ (punto ideal) |
| $j$ | índice de subproyecto (partícula) |
| $\mathbf{x}_j,\mathbf{v}_j \in \mathbb{R}^2$ | posición y velocidad de la partícula $j$ |
| $m$ | masa de la partícula ($m=1$, constante) |
| $\hat{\mathbf{u}}_i$ | dirección unitaria del punto ideal hacia el borde del eje $i$ |
| $s$ | señal (fuerza elemental) sobre un subproyecto |
| $\iota(s)\in[0,1]$ | intensidad de la señal (según datos) |
| $w(s)\in[0,1]$ | peso de la señal (cuánto "le duele" al producto) |
| $G$ | ganancia de fuerza (`FORCE_GAIN`) |
| $\gamma$ | coeficiente de fricción viscosa |
| $k_c,\,d,\,L$ | rigidez, amortiguación y longitud de reposo del resorte al centro |

Se trabaja en $\mathbb{R}^2$ (el motor conserva la coordenada $z$ pero permanece
nula). Se usa $\lVert\cdot\rVert$ para la norma euclídea.

# 3. Geometría del espacio de operación

## 3.1 Los tres límites como discos (triángulo de Reuleaux)

El sistema tiene **exactamente tres límites de negocio**, fieles a la figura de la
tesis: falla económica, rendimiento inaceptable y alta carga de trabajo. Cada
límite $i$ tiene un **ángulo de rótulo** $\theta_i$:

$$
\theta_{\text{econ}}=-\tfrac{\pi}{2},\qquad
\theta_{\text{rend}}=0,\qquad
\theta_{\text{carga}}=+\tfrac{\pi}{2}.
$$

El disco extremo del eje $i$ se centra en el lado **opuesto** a su rótulo
($\theta_i+\pi$), a distancia $D$ del origen y con radio $R$:

$$
\mathbf{c}_i=\bigl(D\cos(\theta_i+\pi),\; D\sin(\theta_i+\pi)\bigr),
\qquad D=3{,}2,\quad R=6{,}5 .
$$

La región de operación factible es la intersección de los tres discos,

$$
\Omega=\bigcap_{i\in\mathcal{A}}\mathcal{B}(\mathbf{c}_i,R),
$$

cuya frontera, al ser tres arcos de igual radio que se cortan, forma un
**triángulo de Reuleaux** (polígono curvo de ancho constante). Los tres discos son
**fijos**: no dependen de los datos. Lo único que se mueve es la partícula del
subproyecto.

Cada eje define además un **disco marginal** concéntrico de radio reducido,

$$
R_{\text{marg}}=\rho R,\qquad \rho=0{,}93,
$$

que actúa como banda de advertencia (amarilla) inmediatamente interior al borde
rojo.

## 3.2 Punto ideal: círculo máximo inscrito

El **punto ideal de operación** $\mathbf{p}^\*$ es el centro del círculo de mayor
radio contenido en $\Omega$. Definiendo la función de holgura

$$
f(\mathbf{p})=\min_{i\in\mathcal{A}}\bigl(R-\lVert \mathbf{p}-\mathbf{c}_i\rVert\bigr),
$$

que es **cóncava** por ser el mínimo de funciones cóncavas, el punto ideal y el
radio factible son

$$
\mathbf{p}^\*=\arg\max_{\mathbf{p}}f(\mathbf{p}),
\qquad
r^\*=f(\mathbf{p}^\*)=\max_{\mathbf{p}}f(\mathbf{p}).
$$

En la implementación, $\mathbf{p}^\*$ se obtiene por **búsqueda de patrón**
(*pattern search*) partiendo del centroide de los $\mathbf{c}_i$, con paso inicial
$\max_i R/2$ que se bisecta cada vez que ninguna de las ocho direcciones
$\{(\pm1,0),(0,\pm1),(\pm\tfrac{\sqrt2}{2},\pm\tfrac{\sqrt2}{2})\}$ mejora $f$. Esto
equivale al cálculo del centro del polígono factible por programación lineal usado
en la tesis. Si $r^\*\le0{,}45$ la región se considera **inviable** y no se
inicializa el sistema.

## 3.3 Direcciones de empuje

Para cada eje se define la dirección unitaria desde el punto ideal hacia el borde
(hacia el rótulo):

$$
\hat{\mathbf{u}}_i=-\,\frac{\mathbf{c}_i-\mathbf{p}^\*}{\lVert \mathbf{c}_i-\mathbf{p}^\*\rVert}.
$$

Como los discos se centran en el lado opuesto al rótulo, $-(\mathbf{c}_i-\mathbf{p}^\*)$
apunta al borde etiquetado. Estas direcciones son **constantes** (no dependen de la
posición de la partícula), propiedad clave para que la resultante de fuerzas **no
gire** (§5.3).

# 4. Dinámica de la partícula

## 4.1 Estado y ecuación de movimiento

Cada subproyecto $j$ es una partícula de estado $(\mathbf{x}_j,\mathbf{v}_j)$ y masa
$m=1$. Un **ancla fija** $\mathbf{a}=\mathbf{p}^\*$ representa el punto ideal. La
ecuación de movimiento es un sistema masa-resorte amortiguado con fuerza externa:

$$
m\,\ddot{\mathbf{x}}_j
=\underbrace{\mathbf{F}^{\text{res}}_j(\mathbf{x}_j,\mathbf{v}_j)}_{\text{resorte al centro}}
\;-\;\underbrace{\gamma\,\dot{\mathbf{x}}_j}_{\text{fricción}}
\;+\;\underbrace{\mathbf{E}_j}_{\text{fuerza externa persistente}} .
\tag{1}
$$

## 4.2 Resorte al centro (ley de Hooke con amortiguación axial)

El resorte que une la partícula $j$ con el ancla tiene rigidez $k_c$, amortiguación
$d$ y longitud de reposo $L$. Sea $\mathbf{r}=\mathbf{x}_j-\mathbf{a}$,
$\ell=\lVert\mathbf{r}\rVert$ y $\hat{\mathbf{r}}=\mathbf{r}/\ell$. La fuerza del
resorte sobre la partícula es

$$
\mathbf{F}^{\text{res}}_j=\Bigl[\underbrace{-k_c(\ell-L)}_{\text{Hooke}}
\;\underbrace{-\,d\,(\hat{\mathbf{r}}\cdot(\mathbf{v}_j-\mathbf{v}_\mathbf{a}))}_{\text{amortiguación axial}}\Bigr]\hat{\mathbf{r}},
\tag{2}
$$

con $\mathbf{v}_\mathbf{a}=\mathbf{0}$ por ser el ancla fija. El resorte **solo
aporta la fricción de retorno**: tira de la partícula hacia el punto ideal y
disipa energía a lo largo del eje, evitando salidas rápidas y fluctuaciones
prolongadas. La rigidez es constante ($k_c=1$), consistente con el rango modelado
$k\in[k_{\min},k_{\max}]=[0{,}6,\,1{,}5]$ de la tesis.

## 4.3 Fricción viscosa

Además de la amortiguación axial del resorte, cada partícula sufre una fricción
viscosa isótropa $-\gamma\mathbf{v}_j$ con $\gamma=1{,}4$. Este término
(ec. 2 de la tesis) es el que **suprime la oscilación armónica**: el sistema es
**sobre-amortiguado**, de modo que la partícula no rebota ni resortea, sino que
**deriva lentamente** en la dirección de la fuerza externa y se asienta.

## 4.4 Fuerza externa persistente y catálogo de fuerzas

La fuerza $\mathbf{E}_j$ (término $E$ de la tesis, *"adicionarfuerza"* en el fork)
es la **resultante** de las señales que afectan al subproyecto. Cada señal $s$ se
clasifica mediante el **catálogo de fuerzas** en:

- un **eje** $\text{axis}(s)\in\mathcal{A}\cup\{\text{centro}\}$,
- un **peso** $w(s)\in[0,1]$ (daño relativo al producto),
- una **intensidad** $\iota(s)\in[0,1]$ (fuerza de la evidencia según datos).

La **ganancia de fuerza** se calibra para que una señal saturada
($\iota\,w=1$) desplace la partícula justo hasta el borde rojo:

$$
G=k_c\,r^\*\,(1{,}02).
\tag{3}
$$

Una **respiración** mínima y lenta mantiene el sistema "vivo" sin parecer un
resorte:

$$
b_j(t)=1+0{,}04\,\sin\!\bigl(\omega t+\varphi_j\bigr),
\qquad \omega=\frac{2\pi}{14},
$$

con desfase $\varphi_j$ por partícula. La magnitud de cada señal es

$$
m(s,t)=\iota(s)\,w(s)\,G\,b_j(t).
\tag{4}
$$

La **resultante de riesgo** suma las señales cuyo eje no es el centro:

$$
\mathbf{E}^{\text{riesgo}}_j(t)=\sum_{\substack{s\,:\,\text{axis}(s)\neq\text{centro}}}
m(s,t)\,\hat{\mathbf{u}}_{\text{axis}(s)} .
\tag{5}
$$

El **Cuadro 1** resume el eje de destino y el peso por defecto de cada fuerza del
catálogo.

**Cuadro 1. Catálogo de fuerzas (eje de empuje y peso por defecto).**

| Fuerza | Eje | Peso $w$ |
|---|---|---|
| Tareas vencidas | carga | 0,70 |
| Entregas tardías | económica | 0,80 |
| Tiempo elevado por entrega | carga | 0,55 |
| Bloqueos activos | rendimiento | 0,85 |
| Tareas no cumplidas (del total) | económica | 0,75 |
| Calidad insuficiente (satisfacción) | rendimiento | 1,00 |
| Feedback/usabilidad | rendimiento | 0,60 |
| Bugs abiertos | rendimiento | 0,90 |
| Baja satisfacción del equipo | carga | 0,65 |
| Presupuesto/recursos limitados | económica | 0,70 |
| Tecnología insuficiente | rendimiento | 0,60 |
| Dependencias externas/normas | económica | 0,55 |
| Referente de mercado/competencia | económica | 0,50 |
| **Producto saludable** | **centro** | 0,70 |

## 4.5 Salud: atenuación de la resultante sin rotación

Las señales de **salud** (producto bien calificado) no introducen un vector propio
—hacerlo giraría la resultante—, sino que se acumulan en un **escalar**

$$
H_j(t)=\sum_{\substack{s\,:\,\text{axis}(s)=\text{centro}}} m(s,t),
$$

que **reduce la magnitud** de la resultante de riesgo conservando su dirección:

$$
\mathbf{E}_j(t)=
\begin{cases}
\dfrac{\mathbf{E}^{\text{riesgo}}_j}{\lVert\mathbf{E}^{\text{riesgo}}_j\rVert}\,
\max\!\bigl(0,\ \lVert\mathbf{E}^{\text{riesgo}}_j\rVert-H_j\bigr),
& \lVert\mathbf{E}^{\text{riesgo}}_j\rVert>0 \ \wedge\ H_j>0,\\[2ex]
\mathbf{E}^{\text{riesgo}}_j, & \text{en otro caso.}
\end{cases}
\tag{6}
$$

Si la salud supera al riesgo, $\mathbf{E}_j=\mathbf{0}$ y la partícula regresa al
punto ideal por acción del resorte. En ausencia de señales, $\mathbf{E}_j=\mathbf{0}$
y la partícula permanece en el centro.

## 4.6 Ausencia de rotación de la resultante

Como cada $\hat{\mathbf{u}}_i$ es **constante** y las fuerzas del mismo eje se suman
sobre esa misma dirección, la resultante (5)–(6) tiene dirección fija en el tiempo
(salvo la modulación escalar $b_j(t)$ y $H_j(t)$). En consecuencia, la partícula
**no describe órbitas ni gira**: se traslada a lo largo de una dirección estable y
"muere despacio". Esta es la corrección esencial frente a una formulación ingenua
en la que la salud sería un cuarto vector dependiente de la posición.

# 5. Integración numérica (Runge-Kutta 4)

El sistema de primer orden equivalente es

$$
\dot{\mathbf{x}}_j=\mathbf{v}_j,\qquad
\dot{\mathbf{v}}_j=\frac{1}{m}\,\mathbf{F}_j(\mathbf{x},\mathbf{v}),
$$

con $\mathbf{F}_j$ la suma de (2), la fricción y (6). Se integra con **Runge-Kutta
de cuarto orden** y paso fijo $h=\Delta t=0{,}1$. Denotando el estado
$\mathbf{y}=(\mathbf{x},\mathbf{v})$ y $\Phi(\mathbf{y})=(\mathbf{v},\mathbf{F}/m)$,

$$
\begin{aligned}
\mathbf{k}_1&=\Phi(\mathbf{y}_n),\\
\mathbf{k}_2&=\Phi\!\bigl(\mathbf{y}_n+\tfrac{h}{2}\mathbf{k}_1\bigr),\\
\mathbf{k}_3&=\Phi\!\bigl(\mathbf{y}_n+\tfrac{h}{2}\mathbf{k}_2\bigr),\\
\mathbf{k}_4&=\Phi\!\bigl(\mathbf{y}_n+h\,\mathbf{k}_3\bigr),\\
\mathbf{y}_{n+1}&=\mathbf{y}_n+\tfrac{h}{6}\bigl(\mathbf{k}_1+2\mathbf{k}_2+2\mathbf{k}_3+\mathbf{k}_4\bigr).
\end{aligned}
\tag{7}
$$

La fuerza se reevalúa en las cuatro etapas (las partículas fijas se excluyen de la
actualización). Un paso pequeño produce la deriva lenta y suave buscada. Se aplica
un tope de seguridad alto sobre $\lVert\mathbf{v}\rVert$ para evitar divergencias
numéricas, sin alterar el régimen normal.

# 6. Criterio de diagnóstico

Tras un tiempo de calentamiento $T_0$ (`WARMUP_FRAMES`$=90$ pasos), se evalúa la
**pertenencia del centro de masa** $\mathbf{x}_j$ de cada subproyecto a los discos.
Para cada eje $i$:

$$
\begin{aligned}
\text{Desequilibrio (falla en } i)&:\quad \lVert \mathbf{x}_j-\mathbf{c}_i\rVert > R,\\
\text{Riesgo (marginal en } i)&:\quad \rho R < \lVert \mathbf{x}_j-\mathbf{c}_i\rVert \le R,\\
\text{Equilibrio}&:\quad \lVert \mathbf{x}_j-\mathbf{c}_i\rVert \le \rho R\ \ \forall i.
\tag{8}
\end{aligned}
$$

Si algún subproyecto **cruza un disco extremo**, la simulación **se detiene** y se
reporta el eje violado (comportamiento heredado del Java: se pierde el equilibrio y
el sistema se detiene). Si solo cruza un disco marginal, se marca **riesgo**. En
otro caso, **equilibrio**.

Como métrica continua de cercanía al ideal se define la **proximidad**:

$$
\operatorname{prox}_j=\min\!\Bigl(100,\ \Bigl\lceil 100\cdot
\frac{\lVert \mathbf{x}_j-\mathbf{p}^\*\rVert}{r^\*}\Bigr\rceil\Bigr)\ \in[0,100],
$$

donde $0$ es el punto ideal y $100$ la frontera factible.

# 7. Pipeline de datos → señales

Las intensidades $\iota(s)$ se estiman en **tiempos relativos** y se atenúan por
**confianza** según la cantidad de evidencia. Para un subproyecto con $N$ tareas
observadas, $A$ activas y factor de confianza

$$
\kappa=\min\!\Bigl(1,\ \frac{N}{8}\Bigr),
$$

las señales automáticas se calculan como (con $\operatorname{clip}=\operatorname{clamp}_{[0,1]}$):

$$
\begin{aligned}
\text{vencidas}&:\ \iota=\kappa\,\operatorname{clip}\!\bigl(\tfrac{\#\text{venc}}{A}\bigr), &
\text{bloqueos}&:\ \iota=\kappa\,\operatorname{clip}\!\bigl(\tfrac{\#\text{bloq}}{A}\bigr),\\[1ex]
\text{incumplimiento}&:\ \iota=\kappa\,\operatorname{clip}\!\bigl(2(\tfrac{A}{N}-\tfrac12)\bigr)\ [\text{si }\tfrac{A}{N}>\tfrac12], &
\text{tardanza}&:\ \iota=\kappa\,\operatorname{clip}\!\bigl(\tfrac{\#\text{tarde}}{\#\text{conFecha}}\bigr),\\[1ex]
\text{tiempo}&:\ \iota=\kappa\,\operatorname{clip}\!\bigl(\tfrac{\bar h-24}{56}\bigr)\ [\text{si }\bar h>24], &
\end{aligned}
$$

y a partir de la satisfacción media $\bar a\in[1,5]$ de las entregas calificadas:

$$
\begin{cases}
\text{calidad (rend.)}:\ \iota=\kappa\,\operatorname{clip}\!\bigl(\tfrac{3-\bar a}{2}\bigr), & \bar a<3,\\[1ex]
\text{usabilidad (rend.)}:\ \iota=\kappa\,\operatorname{clip}\!\bigl(\tfrac{4-\bar a}{1{,}5}\bigr), & 3\le\bar a<4,\\[1ex]
\text{salud (centro)}:\ \iota=\operatorname{clip}\!\bigl(\tfrac{\#\text{rated}}{4}\bigr)\,\operatorname{clip}(\bar a-4), & \bar a\ge4.
\end{cases}
$$

Para señales capturadas manualmente con severidad $S$, probabilidad $P$,
detectabilidad $D$ y confianza $C$ (escala $1$–$5$), la intensidad se deriva de un
**índice de riesgo** tipo AMEF ponderado:

$$
\text{risk}=\Bigl\lceil\frac{0{,}38\,S+0{,}30\,P+0{,}18\,(6-D)+0{,}14\,C}{5}\cdot 100\Bigr\rceil,
\qquad \iota=\frac{\text{risk}}{100}.
\tag{9}
$$

El índice de riesgo se clasifica además en cuatro bandas operativas: **observación**
($\text{risk}\ge0$), **acción** ($\ge45$), **alarma** ($\ge70$) y **fracaso**
($\ge86$).

## 7.1 Agregación de dimensiones socio-técnicas

El modelo contempla seis dimensiones socio-técnicas de origen (factor humano, tarea
y flujo, software/tecnología, interacción UX, organización y contexto externo), que
se **agregan sobre los tres ejes** del sistema mediante el mapeo

$$
\text{humano},\text{tarea}\mapsto\text{carga};\quad
\text{tecnología},\text{interacción}\mapsto\text{rendimiento};\quad
\text{organización},\text{contexto}\mapsto\text{económica}.
$$

Así, cualquier señal socio-técnica termina expresada como una fuerza sobre uno de
los tres límites del negocio.

# 8. Parámetros del modelo

**Cuadro 2. Constantes del modelo y su rol.**

| Parámetro | Símbolo | Valor | Rol |
|---|---|---|---|
| Masa de partícula | $m$ | 1 | constante en todas las partículas |
| Rigidez al centro | $k_c$ | 1,0 | resorte de retorno al punto ideal |
| Rango de rigidez modelado | $[k_{\min},k_{\max}]$ | [0,6, 1,5] | rango de la tesis |
| Fricción viscosa | $\gamma$ | 1,4 | sobre-amortiguado (sin oscilación) |
| Amortiguación de resorte | $d$ | 1,0 | disipación axial |
| Radio de disco extremo | $R$ | 6,5 | borde de falla |
| Distancia de centros | $D$ | 3,2 | ubicación de los tres discos |
| Razón marginal | $\rho$ | 0,93 | banda de advertencia |
| Ganancia de fuerza | $G$ | $k_c r^\*(1{,}02)$ | calibra $\iota w=1$ al borde |
| Paso de integración | $h$ | 0,1 | RK4, deriva lenta |
| Calentamiento | $T_0$ | 90 pasos | antes de evaluar equilibrio |
| Período de respiración | $2\pi/\omega$ | 14 s | modulación de "vida" |

# 9. Propiedades del modelo

1. **Estabilidad.** Por ser sobre-amortiguado ($\gamma,d>0$) con resorte de retorno,
   toda trayectoria converge a un punto fijo $\mathbf{x}_j^\infty$ que satisface
   $k_c(\mathbf{x}_j^\infty-\mathbf{a})=\mathbf{E}_j$ (equilibrio de fuerzas), sin
   oscilación sostenida.
2. **Calibración interpretable.** Por (3), una única señal con $\iota w=1$ lleva la
   partícula exactamente al borde rojo; combinaciones parciales la sitúan
   proporcionalmente entre el ideal y la falla.
3. **Trazabilidad.** Cada desplazamiento se descompone en las señales que lo
   generan (eje, peso, intensidad, evidencia), lo que permite explicar el
   diagnóstico y no solo mostrarlo.
4. **Monotonía de la salud.** La salud nunca invierte la dirección del riesgo: solo
   reduce su magnitud (6), evitando artefactos rotacionales.

# 10. Limitaciones y trabajo futuro

- La estimación de $\mathbf{p}^\*$ por búsqueda de patrón es aproximada; una solución
  exacta (programación lineal / geometría del Reuleaux) mejoraría la reproducibilidad.
- Los pesos $w(s)$ son parámetros expertos; su **calibración empírica** contra
  desenlaces reales de subproyecto (falla/éxito) es trabajo pendiente.
- El modelo es determinista; incorporar **incertidumbre** en $\iota$ (intervalos o
  distribuciones) permitiría diagnósticos probabilísticos.
- Falta un estudio de **validez de constructo**: correlación entre proximidad al
  borde y métricas independientes de salud de proyecto.

# 11. Conclusión

El MDSSP traduce señales operativas y de experiencia de usuario en la dinámica de
una partícula dentro de una región factible acotada por tres límites de negocio.
La formulación —masa-resorte sobre-amortiguada, resultante de fuerzas de dirección
fija, salud como atenuador escalar e integración RK4— produce un diagnóstico
**dinámico, estable, calibrado y trazable**: la posición de cada subproyecto
respecto al triángulo de Reuleaux y a sus bandas marginales determina de forma
inequívoca su estado de equilibrio, riesgo o falla.

# Referencias

1. Documento de tesis *"5. Modelo del sistema físico"*, MediaLab / repositorio
   `G:\TesisDC`.
2. Fork `traer.physics` (integrador Runge-Kutta, partículas y resortes),
   `G:\TesisDC\Netbeans\JavaFXApplication3\src\traer\physics`.
3. Implementación de referencia del MDSSP: `src/mdssp.jsx` (motor de fuerzas,
   catálogo y criterio de equilibrio).
