# Cuenta clara · v1.3 en desarrollo

Calculadora de cobros MXN/USD y pago combinado, sin registro de ventas. Esta rama desarrolla exclusivamente la identidad Dark Fintech equilibrado y las interacciones aprobadas. Producción continúa en v1.2; no fusionar a `main` ni crear `v1.3.0` sin autorización.

## Probar

```sh
git clone --branch feature/version-1.3 https://github.com/glezeddy/calculadora-mxn-usd.git
cd calculadora-mxn-usd
git fetch origin --tags
npm ci
npm run dev
```

Abre http://localhost:4174/calculadora-mxn-usd/. Requiere Node.js 20 o posterior. El servidor estático local escucha únicamente en el equipo. No usar `file://`.

URL de revisión: https://glezeddy.github.io/calculadora-mxn-usd-pruebas/

## Qué cambia

- Paleta oficial mediante variables CSS; superficies oscuras, total con degradado azul discreto, cambio menta, faltante coral y estado neutral explícito.
- Selección de moneda con marca de verificación además del color; billetes con respuesta solo mientras se pulsan; iconos SVG locales ligeros, sin biblioteca ni fuentes remotas.
- Teclado integrado junto al campo activo. Se abre al enfocar un importe, con acceso explícito mediante botón; Listo o Escape lo cierran sin borrar. Mantiene su función probada `editAmount`, selección, decimales, retroceso y limpieza. Se mantiene la entrada física.
- Para evitar doble teclado se utiliza `inputmode=none` durante el teclado integrado. La acción Usar teclado del dispositivo cierra el panel y permite `inputmode=decimal`. Su comportamiento físico depende del navegador y debe verificarse en el celular.
- Paneles Detalles de la cotización y Resumen del cobro contraídos inicialmente, con botones, `aria-expanded` y `aria-controls`. Tasa, referencia, modalidad y errores permanecen visibles. Contraer el resumen no oculta el resultado de la sección 02.
- Cabecera PWA compacta, foco visible, objetivos táctiles, movimiento reducido y etiqueta clara de versión en pruebas.

## Qué se conserva

Importes `BigInt` en centavos, validación, pagos MXN/USD/combinado, todas las denominaciones, reglas de redondeo y cambio exclusivamente en MXN. `money.js`, `rates.js`, `rate-store.js`, `summary.js` y `pwa.js` se conservan sin cambios respecto a `v1.2.0`.

El resumen y su copia contienen exclusivamente la operación actual. No se guarda ni se envía la operación. Si falla el portapapeles se ofrece el texto seleccionable. La última tasa automática válida conserva sus fechas reales y requiere selección explícita para usarla como referencia anterior. La API Frankfurter no se almacena en caché del service worker.

## Archivos

- `index.html`, `styles.css`: estructura y tokens visuales.
- `app.js`: operación original y enlace con la presentación.
- `ui.js`, `icons.js`: estados visuales, desplegables e iconos locales.
- `keypad.js`: misma edición monetaria; nueva apertura/cierre y teclado alternativo.
- `money.js`, `summary.js`, `rates.js`, `rate-store.js`: lógica conservada.
- `manifest.webmanifest`, `sw.js`, `pwa.js`: PWA; caché `1.3.0-dev.1`, scope relativo.

## Pruebas

```sh
npm test
npx playwright install chromium
npm run test:browser
```

En Windows se usa Edge si está en su ruta habitual; en los demás entornos, Chromium de Playwright. Las pruebas históricas usan las etiquetas `v1.1.0` y `v1.2.0`, por eso se requiere `git fetch origin --tags` (o descargarlas desde el repositorio oficial si se prueba una copia del repositorio de pruebas).

12 pruebas unitarias y 3 integrales: regresiones, invariancia de los módulos financieros, contraste de textos, teclados, copia real/fallback, pagos, desplegables y actualización de PWA desde v1.1/v1.2. Capturas locales en `test-results/` (excluidas de Git). Los cambios de versiones del worker usados para probar se sirven desde memoria, sin modificar los archivos.

## Publicación exclusiva en pruebas y restauración

El repositorio `calculadora-mxn-usd-pruebas` usa Pages desde la raíz de su rama `feature/version-1.3`. El respaldo `v1.2-pre-v1.3-pruebas` apunta al commit previo `e298858c79fd056f59696da4aea7c5989111d4c1`; se conserva también `feature/version-1.2` y el respaldo `v1.1-pruebas`.

Para restaurar v1.2 en pruebas, configurar Pages DEL REPOSITORIO DE PRUEBAS desde `feature/version-1.2` y solicitar un build. Verificar el SHA y comparar los recursos publicados, la cotización y la PWA. Una sesión abierta seguirá usando su worker hasta que acepte la actualización o cierre todas las ventanas controladas. Comprobar que se instale el worker v1.2 y se retire únicamente la caché de v1.3 de esa ruta. No borrar todos los datos de `glezeddy.github.io`, porque ambas aplicaciones comparten origen.

Producción mantiene Pages desde `main`. No cambiar esa configuración para revisar esta versión. No se ha creado una etiqueta oficial v1.3.0 ni un PR a main.
