# Ramo amarillo

Una experiencia web móvil: 50 tulipanes amarillos y 25 lirios amarillos florecen en un único ramo tridimensional, envuelto en papel marfil. Conserva los textos y la secuencia del regalo original.

**Ver en vivo:** https://jackimi03.github.io/un-ramo-para-ti/

## Abrir localmente

```bash
python3 -m http.server 8000
```

Visita `http://localhost:8000`.

## Publicación

El proyecto es estático y se publica desde la raíz de `main` en GitHub Pages. No necesita compilación ni servicios externos. Three.js r180 se sirve desde `vendor/`, con su licencia MIT.

## Interacción

Tras el florecimiento de unos 12 segundos, arrastra horizontalmente para girar los 360°, verticalmente para inclinar, y usa dos dedos o la rueda para acercarte. También funcionan las flechas, +/− y Home con el lienzo enfocado. El movimiento se detiene al descansar y se pausa al ocultar la pestaña. Con movimiento reducido, el ramo completo se presenta sin la secuencia larga ni inercia.

## Estructura

- `index.html`, `styles.css`, `script.js`: página original e integración del ramo.
- `bouquet3d.js`: geometrías, floración, iluminación y controles. 75 posiciones deterministas; seis pétalos por flor, estambres de los lirios y 150 hojas. Pétalos y estambres instanciados; tallos agrupados.
- `canvas3d.js`: alternativa de renderizado geométrico si WebGL no está disponible. Conserva el volumen, floración y controles, con iluminación simplificada.
- `qa.html`: tamaños de viewport y prueba sintética de dos punteros; no forma parte del regalo.

El SVG original permanece como recurso de respaldo dentro del HTML; se oculta cuando se inicia la escena 3D. No se usa como textura ni se transforma para simular profundidad.
