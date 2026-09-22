# Revisión del ramo 3D

Se aplicaron Impeccable, Emil design engineering/animate/review-animations, mobile-native y design-taste-frontend ya instaladas. Se preservaron la página, los cuatro textos y el inicio/repetición existentes; el cambio se concentra en el ramo.

| Antes | Ahora | Motivo |
|---|---|---|
| Flores SVG frontales | 50 tulipanes + 25 lirios con geometría volumétrica | Permitir observar un único ramo por todos sus lados |
| Apertura de piezas planas | Interpolación entre pétalos cerrados y abiertos en 3D | Conservar el nacimiento y distinguir copas de tulipán de lirios de seis pétalos |
| Sin exploración de cámara | Giro horizontal sin límite, inclinación y zoom | Exploración libre al terminar, con inercia que se detiene |
| Ramo pequeño | Copa densa, hojas superpuestas, papel y lazo tridimensionales | Protagonismo floral sin modificar los mensajes |

## Comprobaciones

- En navegador: inicio por el botón original; estado final con 75/75 flores abiertas; 50 tulipanes y 25 lirios derivados del manifiesto real.
- Arrastre hasta la cara posterior: otras flores y envoltorio visibles, no una fachada plana. Inclinación vertical comprobada. En la versión final, yaw 10.6805 rad (>360°) y pitch 2.1000 rad.
- Vistas responsive de 390×844 y 320×568, con mensaje y repetición legibles.
- Pinch de dos punteros sintéticos: zoom de 1 a 0.667. No equivale a probar hardware táctil físico.
- Repetición completa en navegador: 75 → 0 → 75 flores, con cámara restablecida a yaw 0.1500, pitch 1.2900 y zoom 1.000.
- `node scene.test.mjs`: cantidades exactas, al menos 15 flores por cuadrante horizontal, modo de movimiento reducido, giro por teclado y reinicio de cámara/floración.
- Sin dependencias de red para las flores: Three.js se sirve junto al proyecto. Recursos principales aproximadamente 197 kB comprimidos con gzip; no es una medición de transferencia de un teléfono.

## Alcance y limitaciones

El Chrome remoto tiene WebGL deshabilitado. La revisión visual y de interacción se ejecutó con la alternativa Canvas que proyecta las mismas mallas tridimensionales, con iluminación simplificada. No se ha medido FPS en teléfonos físicos ni validado visualmente la ruta GPU/WebGL en este entorno. No se debe presentar esta revisión como una prueba física de iOS/Android o de los shaders en GPU.

La ruta WebGL reutiliza geometrías/materiales e instancias, limita la densidad de píxeles y deja de renderizar cuando el ramo descansa. La alternativa Canvas prioriza compatibilidad, con menor fidelidad de sombras y rendimiento dependiente del dispositivo.

**Veredicto:** cambio tridimensional sustancial; revisión funcional aprobada para la ruta compatible probada. La validación GPU y en hardware móvil permanece pendiente.
