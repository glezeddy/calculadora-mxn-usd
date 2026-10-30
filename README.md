# Cuenta clara · v1.4 — Cambio inteligente (sin publicar)

Continuación de la arquitectura HTML/CSS/JavaScript y diseño Dark Fintech de v1.3. Calcula cobros MXN/USD/combinado y cambio exclusivamente en MXN. Agrega inventario local de efectivo por denominación; no incluye catálogo, clientes ni historial de ventas.

Trabajo autorizado exclusivamente en `feature/version-1.4-cambio-inteligente` del repositorio **de pruebas**. No modificar el repositorio oficial ni la rama v1.3, ni configurar Pages para publicar esta rama todavía.

## Revisar localmente

```sh
git clone --branch feature/version-1.4-cambio-inteligente https://github.com/glezeddy/calculadora-mxn-usd-pruebas.git
cd calculadora-mxn-usd-pruebas
npm ci
npm test
npm run test:browser
npm run dev
```

El servidor solo escucha en el equipo local. Abre la dirección HTTP que indique (ruta `/calculadora-mxn-usd/`). Si el puerto 4174 está ocupado, en PowerShell:

```powershell
$env:PORT = '4176'
npm run dev
```

Requiere Node.js 20 o posterior. Las pruebas usan Edge en su ruta habitual de Windows o Chromium de Playwright; en otros equipos puede ser necesario `npx playwright install chromium`. No abrir `index.html` con `file://`.

Las pruebas históricas obtienen los archivos anteriores mediante sus SHA, presentes en la ascendencia de esta rama; no requieren modificar o conectar el repositorio oficial ni crear etiquetas locales.

## Flujo de uso

1. En Administrar y verificar mi efectivo, contar físicamente MXN y USD por separado y confirmar. Hacerlo antes de introducir el pago de una compra.
2. Capturar precios/pago como en v1.3. Preparar cambio permite elegir modo general o disponibilidad verificada y seleccionar alternativas exactas. Solo las tarjetas usadas se resaltan en turquesa.
3. Si no hay cambio exacto, revisar la sugerencia de adicional (máximo automático inicial $100, configurable) o introducir un adicional manual superior. Confirmar su dinero físico y denominaciones para aplicarlo.
4. Registrar recibido conserva las denominaciones como pendientes. Al finalizar, confirmar el recibido y el cambio físico: se actualizan las dos monedas en un solo registro. El adicional se incluye una única vez.
5. Si no se pueden completar las denominaciones, elegir Finalizar sin actualizar inventario. La moneda afectada queda pendiente de verificar; nunca se inventan piezas ni se redondea el cambio.
6. Cancelar el adicional requiere su devolución física con las mismas denominaciones. Nueva cuenta advierte si hay dinero pendiente y ofrece confirmar, descartar o cancelar.
7. Deshacer último movimiento requiere revertirlo físicamente. Un nuevo movimiento sustituye el único respaldo de deshacer. Conteos/correcciones y nueva jornada lo invalidan.
8. Nueva jornada ofrece exactamente Comenzar en cero o Conservar efectivo anterior. Ninguna opción verifica el efectivo automáticamente.

## PWA, integridad y datos

Los recursos nuevos están incluidos en el service worker `1.4.0-dev.1`. Una cuenta v1.4 y sus movimientos pendientes se recuperan al recargar o actualizar; la actualización se detiene ante problemas de guardado. La administración no depende de internet.

Se conserva un único estado de caja, la cuenta actual y un único movimiento reversible. No se acumulan ventas ni datos personales. Las operaciones no salen del navegador; la consulta de cotización solo solicita el par USD/MXN a Frankfurter.

La disponibilidad solo se utiliza con moneda verificada y sin avisos de almacenamiento. Un fallo de escritura suspende sugerencias y ofrece reconciliación mediante conteo físico completo. Un estado corrupto nunca se convierte silenciosamente en cero. Usar una sola pestaña activa; otra pestaña que cambie la caja provoca una advertencia, no una sobrescritura.

Los límites de búsqueda, cantidades y recuperación están documentados en [la especificación v1.4](docs/v1.4-cambio-inteligente.md). La disponibilidad física siempre depende del conteo y las confirmaciones del usuario; probar primero con efectivo simulado.

## Pruebas y documentación

- `npm test`: incluye pruebas `.test.js` y `.test.mjs`, incluido el motor inicial de v1.4.
- `npm run test:browser`: regresiones v1.3, flujos de efectivo, ajustes, persistencia, recuperación, offline y actualización real del worker en servidor local temporal.
- `node scripts/review-v14.mjs`: genera capturas de revisión en `test-results/` (excluido de Git).
- [Especificación y decisiones](docs/v1.4-cambio-inteligente.md).
- [Informe final y revisión](docs/informe-v1.4.md).

No se ha publicado v1.4 en ninguna URL. La aplicación pública de pruebas continúa en la rama v1.3. La publicación para revisión móvil por HTTPS requiere autorización posterior; localhost en este equipo no es una URL para el celular.
