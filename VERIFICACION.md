# Verificación de la primera versión

Comprobada el 28 de octubre de 2026.

- `npm test`: 5 pruebas aprobadas, sin fallas. Incluyen sumas exactas, faltantes, redondeo, importes grandes, tasas inválidas y errores de API.
- Navegador Microsoft Edge, automatizado con Playwright: flujo de agregar/eliminar precios, cambio MXN, pago USD, faltantes, tasa cero, precios negativos, nueva cuenta y conservación de tasa manual.
- Falla de red simulada: se invalida la tasa automática y no aparece cambio en USD; una tasa manual válida permite continuar.
- Vistas de 360, 390, 768 y 1280 px: sin desbordamiento horizontal; botón de agregar con tamaño táctil mínimo de 44 px. Revisión visual de la captura móvil de 360 px.
- Consulta real a Frankfurter desde el navegador: respuesta correcta con CORS. No se requiere clave.
- Sin errores JavaScript durante los flujos comprobados.

Las pruebas de interfaz usaron cotizaciones de prueba controladas; estas no están incluidas como respaldo en la aplicación. La consulta real se comprobó por separado. Las vistas móviles se probaron en navegador con tamaños de pantalla emulados, no en un teléfono físico. No se ha realizado publicación en GitHub Pages.
