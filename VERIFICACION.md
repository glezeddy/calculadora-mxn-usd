# Verificación de v1.1

- 8 pruebas unitarias: regresiones v1.0, pagos combinados, decimales, faltantes, billetes, límites, entradas inválidas y persistencia de tasa con datos corruptos/almacenamiento bloqueado.
- Prueba integral en Edge: pagos MXN, USD y combinado; billetes repetidos e independientes; tasa inválida; nueva cuenta; error de API; recarga sin conexión; tasa anterior requiere selección explícita; no se consulta la API offline.
- PWA: precarga y control reales; manifest e iconos; actualización con un segundo worker servido en memoria; aviso sin limpiar el cobro; aplicación explícita; eliminación de caché antigua sin tocar una ajena; API ausente de caché.
- Vistas emuladas de 360, 390, 768 y 1280 px sin desbordamiento horizontal, botones táctiles de al menos 44 px; captura móvil revisada visualmente.
- Consulta real desde localhost: Frankfurter respondió con tasa y fecha de referencia. No se incluye una tasa de respaldo inventada.
- Auditoría de instalación en contexto automatizado: único impedimento informado por Chromium fue «in-incognito», propio del contexto privado de las pruebas. No se realizó instalación en un dispositivo físico.

Las pruebas no equivalen a revisión en todos los teléfonos o navegadores. v1.1 no se ha publicado en Pages; la versión pública sigue en main. La vista local es un entorno de prueba independiente.
