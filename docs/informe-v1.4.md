# Informe de implementación — Cuenta clara v1.4: Cambio inteligente

## Estado y alcance

Trabajo realizado únicamente en el repositorio de pruebas `glezeddy/calculadora-mxn-usd-pruebas`, rama `feature/version-1.4-cambio-inteligente`.

Estado inicial inspeccionado: árbol limpio, rama remota en `72a047e888b2fa0cc2261b16d6650a749a9b64d4`, con los commits previos de documentación, motor y siete pruebas; ascendencia de v1.3 `981b017643c1cd377a7cecd99b960fe1f0f1ea67`. Pages estaba configurado desde `feature/version-1.3`, raíz `/`.

No se modificó el repositorio oficial, no se alteró la rama v1.3 y no se publicó v1.4. El código queda preparado para integración posterior en pruebas, sin cambiar Pages ni crear una publicación oficial.

## Funciones implementadas

| Función | Resultado |
| --- | --- |
| Preparar cambio | Combinaciones exactas generales o limitadas al efectivo MXN verificado; hasta tres alternativas y total/piezas visibles |
| Denominaciones | Solo las piezas utilizadas se resaltan: fondo #087E88, borde #73F5ED, número grande blanco/negrita y cantidad debajo; las demás quedan oscuras |
| Ajuste automático | Propuesta de adicional dentro del máximo configurable, inicialmente $100 MXN; no altera el precio |
| Ajuste manual | Admite importes superiores al límite automático, con denominaciones y confirmación física |
| Aplicación/cancelación de adicional | Se aplica una vez después de confirmar recepción; cancelarlo requiere confirmar devolución física con las mismas denominaciones |
| Efectivo MXN/USD | Cantidades y verificación independientes, persistidas localmente durante la jornada |
| Recibido/entregado | Confirmaciones explícitas y sumas exactas; recibido provisional no se vuelve a contabilizar al finalizar |
| Finalizar | Un único registro atómico de entradas, salidas, cuenta pendiente y deshacer; nunca deja inventario negativo |
| Registro incompleto | Completar denominaciones o finalizar explícitamente sin inventario; solo las monedas afectadas quedan pendientes de verificar |
| Verificar efectivo | Conteo completo desde cero o corrección de cantidades existentes; confirmación física antes de sustituir |
| Nueva jornada | Exactamente Comenzar en cero o Conservar efectivo anterior; nunca verifica automáticamente |
| Nueva cuenta | Advertencia con Confirmar/finalizar, Descartar o Cancelar; no modifica parcialmente al cancelar |
| Deshacer | Solo el último movimiento, tras revertirlo físicamente; persiste al recargar y es reemplazado por otro movimiento confirmado |
| Recuperación | Una escritura fallida no avanza caja; suspende disponibilidad y exige reconciliación física de ambas monedas antes de reanudar |
| PWA/offline | Recursos precargados, cuenta y movimientos recuperables; actualización espera guardado y no se aplica si no puede guardarse |

Ejemplo ejecutado: compra $270, pago original $500, cambio $230; adicional $70 confirmado → cambio $300. Al finalizar con un billete de $200 y uno de $100, el adicional se registra una sola vez. Se comprobó también cancelar el adicional, recargar y deshacer el movimiento final.

## Integridad

Los cálculos originales de importes y conversión siguen en `money.js`, sin modificaciones. Los saldos usan centavos `BigInt`. El motor no redondea para inventar una combinación: si $30.05 no puede entregarse con sus denominaciones, lo informa.

La búsqueda es acotada y se ejecuta en un Worker: poda por máximo disponible y divisibilidad, presupuesto de 60,000 visitas y hasta 5,000 candidatos para adicional. Si alcanza el límite, lo informa; no confunde búsqueda incompleta con imposibilidad demostrada. Se devuelven hasta tres combinaciones, no todas las soluciones posibles.

Caja, operación pendiente y único respaldo de deshacer se confirman mediante un solo `localStorage.setItem`. Web Locks y revisión de estado evitan escrituras concurrentes desde otra pestaña. Una captura inmediata de campos en `sessionStorage` cubre la recarga antes de completar la cola de escritura. Las claves de efectivo incluyen la ruta, para no mezclar la caja del futuro entorno de pruebas con otra ruta.

Se prohíbe recontar efectivo o comenzar jornada mientras haya dinero de una cuenta por resolver, evitando incluirlo en un conteo y volverlo a sumar como entrada. Al confirmar recibido o adicional se bloquean la edición y la tasa aplicada. Una tasa automática usada por USD se identifica como fijada con su fecha original durante la cuenta, incluso offline; no se presenta como una consulta nueva.

No hay historial de ventas, datos de clientes, base de datos, backend ni envío del cobro a servicios externos. Solo se conserva la cuenta actual y el estado necesario para el último deshacer.

## Archivos

Nuevos: `cash-ledger.js`, `cash-ui.js`, `change-worker.js`, `tests/cash-ledger.test.mjs`, `tests/cash-ui.spec.js`, `tests/cash-pwa.spec.js`, `scripts/review-v14.mjs` y este informe.

Modificados: `change-engine.js`, `app.js`, `index.html`, `styles.css`, `keypad.js`, `pwa.js`, `sw.js`, `manifest.webmanifest`, `package.json`, `package-lock.json`, `scripts/server.js`, `README.md`, `docs/v1.4-cambio-inteligente.md` y las pruebas de regresión para considerar las nuevas confirmaciones/persistencia y los SHA históricos disponibles en este repositorio.

Los siete casos originales de `tests/change-engine.test.mjs` se conservaron y ahora están incluidos en `npm test`; antes el script solo recogía archivos `.test.js`.

## Pruebas realmente ejecutadas

- **35 pruebas unitarias: aprobadas.** Incluyen las siete iniciales del motor, cálculo/conversión anteriores, alternativas, inventarios pequeños contrastados con fuerza bruta, importes grandes, límites, negativos, ajuste automático y manual, confirmaciones, cancelación, movimiento mixto, nueva jornada, cierre incompleto, deshacer, doble registro, recarga, error de escritura y conflicto entre pestañas.
- **11 pruebas de navegador: aprobadas en Microsoft Edge automatizado.** Regresiones v1.3 y escenarios de efectivo completos, $230 + $70, USD y combinado, ajustes manuales superiores, confirmaciones faltantes, recarga inmediata de captura, cancelaciones, conteo/corrección, nuevo día/cuenta, finalización incompleta, deshacer persistente, almacenamiento corrupto, tasa fijada y recuperación tras fallo de escritura.
- **PWA:** migración desde v1.3, actualización a un segundo worker de prueba servido desde memoria, conservación del adicional y la caja, recarga offline, módulos precargados, reconexión y bloqueo de actualización cuando la captura no puede guardarse. Los archivos del worker del repositorio no se sustituyen por los del test.
- **Sintaxis:** todos los archivos JavaScript/MJS del proyecto fuera de `node_modules` comprobados con `node --check`, sin errores al cierre.
- **Presentación:** capturas de cambio y diálogo móvil/escritorio revisadas; regresiones emuladas 320/390/768/1280 px sin desbordamiento. Las comprobaciones previas de teclado, paneles, copia y movimiento reducido siguen incluidas.
- `git diff --check`: sin incidencias al cierre.

Se corrigieron los errores detectados durante el desarrollo y se ejecutó de nuevo la batería completa. Estos resultados corresponden a las ejecuciones finales satisfactorias, no a una afirmación de que nunca hubo fallos intermedios.

## Commits de implementación

- `6015d85e466b2a92e5ea763a4d0d8254abb7df6a` — motor acotado y caja transaccional persistente.
- `35843293718a18da0bac5736b9c59ea3edd68cb8` — integración de efectivo, confirmaciones físicas y recuperación PWA.
- Commit posterior de documentación: consultar el último commit de esta misma rama y el informe de entrega. No se reescribió la historia anterior.

## Cómo revisar

1. Clonar o actualizar exclusivamente la rama `feature/version-1.4-cambio-inteligente` del repositorio de pruebas.
2. Ejecutar `npm ci`, `npm test` y `npm run test:browser`.
3. Ejecutar `npm run dev`. En PowerShell, si necesitas otro puerto: `$env:PORT='4176'; npm run dev`.
4. Abrir `http://localhost:4176/calculadora-mxn-usd/` si elegiste ese puerto (o el puerto que indique el servidor). Es una dirección de este equipo, no pública.
5. Probar primero con efectivo simulado: verificar MXN $200×1 y $100×1, compra $270, recibido $500; preparar cambio según inventario y probar el adicional de $70, su cancelación y la finalización. Recontar desde cero antes de probar una nueva situación física.
6. `node scripts/review-v14.mjs` genera capturas reproducibles en `test-results/` (no se publican ni versionan).

## Límites y pendientes

- Hasta 1,000,000 piezas por denominación y 500 precios por borrador persistente; las búsquedas tienen presupuesto explícito. Los cálculos generales no inventan denominaciones ni existencia física.
- Usar una pestaña activa para esta caja. Si otra pestaña la cambia, se suspende la administración y se pide recargar. No hay sincronización entre dispositivos.
- La administración requiere almacenamiento disponible y Web Locks. Si faltan, no se simulan confirmaciones exitosas; los cálculos básicos siguen funcionando.
- Un estado principal corrupto no se sobrescribe automáticamente. Hay que revisar el almacenamiento y volver a contar físicamente; no se ofrece una recuperación ficticia de información perdida.
- Ante un fallo de guardado después de mover dinero, mantener la pestaña abierta, no repetir entregas y realizar la reconciliación física indicada. La protección de captura/recuperación de la pestaña no sustituye un respaldo permanente si el navegador borra los datos o se fuerza su cierre durante el fallo.
- Cancelar un adicional sin actualización de inventario requiere devolver las mismas denominaciones. Si el efectivo físico cambió de otra forma, debe resolverse y recontarse; no se ajustan cantidades por suposición.
- Pendiente: uso táctil e instalación real en Android/iPhone, comodidad de diálogos y recuentos, comportamiento del teclado nativo y verificación física con efectivo simulado. No se ejecutaron pruebas físicas ni se afirma que el dispositivo real haya sido validado.

## Recomendación de integración

**Lista para pasar a pruebas móviles controladas con efectivo simulado, después de autorizar un despliegue de pruebas por HTTPS. No recomendada todavía para operar efectivo real sin esa revisión.**

La integración está preparada mediante los recursos de caché y rutas relativas; NO se cambió la fuente de GitHub Pages, NO se fusionó con v1.3 y NO se publicó la versión oficial. La URL actual de pruebas debe continuar sirviendo v1.3. La verificación de publicación HTTPS v1.4 queda pendiente por instrucción expresa del usuario.
