# Verificación de v1.1

- 8 pruebas unitarias: regresiones v1.0, pagos combinados, decimales, faltantes, billetes, límites, entradas inválidas y persistencia de tasa con datos corruptos/almacenamiento bloqueado.
- Prueba integral en Edge: pagos MXN, USD y combinado; billetes repetidos e independientes; tasa inválida; nueva cuenta; error de API; recarga sin conexión; tasa anterior requiere selección explícita; no se consulta la API offline.
- PWA: precarga y control reales; manifest e iconos; actualización con un segundo worker servido en memoria; aviso sin limpiar el cobro; aplicación explícita; eliminación de caché antigua sin tocar una ajena; API ausente de caché.
- Vistas emuladas de 360, 390, 768 y 1280 px sin desbordamiento horizontal, botones táctiles de al menos 44 px; captura móvil revisada visualmente.
- Consulta real desde localhost: Frankfurter respondió con tasa y fecha de referencia. No se incluye una tasa de respaldo inventada.
- Auditoría de instalación en contexto automatizado: único impedimento informado por Chromium fue «in-incognito», propio del contexto privado de las pruebas. No se realizó instalación en un dispositivo físico.

Las pruebas no equivalen a revisión en todos los teléfonos o navegadores. v1.1 no se ha publicado en Pages; la versión pública sigue en main. La vista local es un entorno de prueba independiente.

## Verificación v1.2

- 10 pruebas unitarias aprobadas: las 8 anteriores y pruebas de edición decimal/selección/borrado/límites y resumen exacto, inválido, insuficiente y por moneda.
- 2 pruebas integrales aprobadas en Edge: regresión v1.1 completa y teclado táctil/físico, cambio entre campos, eliminación de campo activo, billetes, pago combinado, faltante de un centavo, resumen y lectura real del portapapeles.
- Copia offline real y alternativa seleccionable tras denegación simulada del portapapeles.
- Actualización del worker desde v1.1 a v1.2 y de v1.2 a una versión de prueba; sin modificar archivos de producción. Se conserva una caché ajena.
- Vistas emuladas 360/390/768/1280 px sin desbordamiento; botones de al menos 44 px. Captura móvil revisada visualmente.
- La instalación y revisión táctil en un dispositivo físico quedan pendientes de prueba personal.

## Verificación v1.3 en desarrollo

Estado base confirmado remotamente: main y v1.2.0 en 5cecb17da1044e5aacbf72588754f9c973afa5ae, PR #2 fusionado. Sin cambios locales al crear feature/version-1.3.

- 12 pruebas unitarias y 3 integrales aprobadas en Edge. Se mantienen las regresiones anteriores; solo se adaptan la apertura del resumen y el identificador del caché a la nueva presentación.
- Prueba de invariancia: money.js, rates.js, rate-store.js, summary.js, pwa.js y editAmount coinciden con v1.2.0.
- Contraste calculado mínimo de 4.5:1 para las combinaciones de texto comprobadas de la paleta oficial.
- Apertura por campo o botón, Listo/Escape, conservación de valor, dos decimales, retroceso, limpieza, cambio MXN/USD y alternativa nativa (atributos y foco). Entrada física y billetes conservados.
- Detalles y resumen inicialmente contraídos; botones con aria-controls/expanded; apertura por Enter/Espacio; resultado independiente visible. Fecha de referencia y errores críticos visibles sin abrir detalles.
- Migración desde v1.2: espera de actualización conserva el cobro, aceptación activa los recursos nuevos y elimina la caché previa de esa ruta. Se mantienen regresiones desde v1.1 y actualización a un worker de prueba servido en memoria.
- Recarga y operación offline con teclado, resumen y copia; reconexión; errores API visibles; referencia anterior explícita. Sin dependencias externas imprescindibles para interfaz.
- Vistas emuladas 320/360/390/768/1280 px, sin desbordamiento; panel integrado en flujo, sin superposición sobre campo/resultado; foco visible y movimiento reducido. Capturas móvil/escritorio revisadas.

Pendiente físico: comprobar supresión del teclado nativo, apertura voluntaria del teclado del dispositivo, comodidad con áreas seguras, instalación y actualización en Android/iOS. La emulación no sustituye esas pruebas.
