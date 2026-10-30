# Investigación de validación v1.4

Fecha: 29 de octubre de 2026. Rama aislada: `fix/v1.4-validacion-publicacion`.

No se publica esta rama en Pages ni se fusiona con `main`.

## Base y alcance

Origen probado: `c6abff8ce0ee3d36dad065b91a9607b6d75cc4d8` de la rama `feature/version-1.4-cambio-inteligente` del repositorio de pruebas. La preparación oficial previa quedó registrada en `b6b2c6d`, dentro de esta misma rama de corrección, sin modificar producción. Esa preparación solo cambia identificaciones de entrega, manifiesto y versión de caché/paquete, adapta las referencias de pruebas y añade documentación y la prueba de migración v1.2.

Esta investigación cambia únicamente `tests/cash-ui.spec.js`, `tests/release14.spec.js` y este informe. No modifica `app.js`, `cash-ui.js`, `cash-ledger.js`, `rate-store.js`, cálculos ni políticas de guardado.

## 1. Recuperación tras escritura fallida

La primera reproducción aislada pasó, aunque había fallado bajo la batería concurrente. La prueba hacía `click()` seguido de una lectura inmediata de `textContent()`. El manejador espera `CashStore.dispatch()`, cuya cola espera Web Locks y luego intenta `localStorage.setItem`. Playwright espera el clic, no la promesa completa del manejador.

Se reprodujo determinísticamente el fallo reteniendo la concesión del Web Lock: con el clic ya resuelto el mensaje seguía vacío y el botón estaba deshabilitado. Al liberar el bloqueo, la escritura simulada falló y apareció el mensaje esperado. No hubo actualización parcial del registro persistente. Esta reproducción demuestra la sincronización incorrecta; no se atribuyó el fallo a temporización sin comprobarlo.

La prueba corregida conserva la escritura fallida y el bloqueo controlado. Comprueba el estado completo antes y durante la espera, libera el bloqueo y espera la condición observable de error, sin pausas arbitrarias. Después verifica:

- Registro persistente idéntico al anterior al fallo, sin adicional ni inventario sumado.
- Marca de recuperación con tipo `extra` en sessionStorage.
- Recarga con administración suspendida y recuperación disponible.
- Recuento físico explícito; no se puede confirmar sin marcar la comprobación física.
- Registro de las cantidades recontadas una sola vez, sin repetir el adicional ni crear un deshacer ficticio.
- Segunda recarga con estado exactamente igual, sin marca de recuperación ni cuenta pendiente.

La expectativa del mensaje no cambió: se corrigió cuándo se comprueba y se añadieron verificaciones del estado, no solo del texto.

## 2. Hora de la tasa guardada

La reproducción inicial falló consistentemente. La actualización del worker recarga la página; `app.js` consulta automáticamente si hay conexión. Una respuesta válida crea un nuevo registro `{value,date,fetchedAt,source}` y reemplaza la *última referencia válida*. Esto ya sucedía en v1.2. `date` procede de la API; `fetchedAt` corresponde a la consulta que acaba de responder. No son la misma fecha ni representan un historial de cotizaciones.

La prueba anterior permitía responder a esa nueva consulta y luego exigía que el registro completo siguiera siendo idéntico al anterior. Era una comparación de migración mezclada con una actualización real de datos. No se corrigió cambiando o ignorando la hora para hacerla coincidir.

Ahora se controla la respuesta con una promesa:

1. Cargar v1.2 desde su commit real y guardar su referencia original, con fecha y hora.
2. Actualizar a v1.4 y mantener pendiente la respuesta de la nueva API. Comparar el registro anterior byte por byte: se conserva.
3. Seleccionar explícitamente esa referencia y simular un pago combinado: cambio $30 con tasa 18.
4. Liberar una cotización distinta (19), con otra fecha de referencia. Verificar que la última referencia incorpora su propia fecha y una hora de consulta posterior, mientras la seleccionada en la página mantiene valor, fecha, hora y cambio originales.
5. Recargar sin conexión: sin recepción física confirmada, la selección recupera la última referencia disponible (19), marcada como anterior, y calcula $40. No se presenta como cotización actual ni se intenta consultar offline.

La prueba de tasa fijada, también reforzada, comprueba que un cobro con dinero confirmado conserva el registro original completo, incluida su hora, después de recargar offline y reconectar. Una actualización no sustituye la tasa de ese movimiento pendiente.

No se añade un historial. El registro de última referencia se puede reemplazar por una consulta válida nueva; la tasa seleccionada en la página y la fijada en un movimiento mantienen su identidad según las reglas descritas.

## Migración e inventario

v1.2 solo persistía la última tasa válida. Su módulo y clave son idénticos a los de v1.4: no hay inventario v1.2 que migrar ni se inventa un fondo de caja. Se comprueba que la nueva caja inicia en cero y sin verificar. Se conservan otras claves locales y las de la ruta de pruebas.

Las pruebas PWA existentes vuelven a comprobar actualización desde v1.3, caja y adicional pendientes al cambiar worker, inventarios por moneda, cuenta recuperada, eliminación de cachés antiguas del mismo ámbito y funcionamiento offline. Se comparan caja y movimientos antes/después; no basta con que aparezca la interfaz.

## Validación final

- `npm test`: **35/35 aprobadas**.
- `npm run test:browser`: **12/12 aprobadas** en Edge automatizado.
- Reproducción específica antes de ajustar: migración fallida; escritura intermitente y reproducida además con Web Lock retenido.
- Reejecución específica después del ajuste: **2/2 aprobadas**, seguida de la batería completa anterior.
- Sin pausas arbitrarias, eliminación de escenarios, saltos de pruebas ni relajación de los cálculos o expectativas de recuperación.
- Incluye MXN, USD, combinado, decimales, insuficiencia, ajuste, inventario, conteo, deshacer, nueva jornada, persistencia, error de escritura, PWA y vistas móviles/escritorio emuladas.

## Protección y pendientes

`main` oficial permanece en `5cecb17da1044e5aacbf72588754f9c973afa5ae` (v1.2). Etiquetas `v1.2.0` y `v1.2-pre-v1.4` conservadas en ese SHA; bundle local intacto. v1.3 permanece en `981b017643c1cd377a7cecd99b960fe1f0f1ea67`. El repositorio de pruebas y las fuentes de Pages no se modifican.

Pendiente: revisión y autorización posterior para publicar. La instalación/actualización en celulares físicos no se ejecutó. Al actualizar desde v1.2, terminar el cobro antes de aceptar la recarga: esa versión solo tenía los campos de la cuenta en memoria. No se borran automáticamente los datos locales.
