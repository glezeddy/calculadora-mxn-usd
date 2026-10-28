# Cuenta clara · versión 1.1 (desarrollo)

Calculadora estática de cobros MXN/USD. Conserva precios dinámicos, total, pagos en una sola moneda, cambio y faltantes en pesos, tasa automática/manual y nueva cuenta. No registra ventas ni incluye inventario, usuarios, teclado integrado o resumen del cobro.

## Probar sin reemplazar la versión pública

Esta versión pertenece a `feature/version-1.1`. No fusionar con `main` sin autorización. GitHub Pages continúa sirviendo `main`.

```sh
git clone --branch feature/version-1.1 https://github.com/glezeddy/calculadora-mxn-usd.git
cd calculadora-mxn-usd
npm ci
npm run dev
```

Abre http://localhost:4174/calculadora-mxn-usd/ en ese equipo. Este origen es independiente de la aplicación pública y reproduce la ruta de GitHub Pages. El servidor escucha únicamente en el equipo local. Requiere Node.js 20 o posterior. No abrir con `file://`.

## Mejoras

- Pago combinado: campos independientes MXN y USD; dólares convertidos con la tasa activa. Un campo vacío equivale a cero en combinado, ambos vacíos no calculan. Las modalidades USD y combinado requieren tasa válida.
- Billetes: MXN 20/50/100/200/500/1000 y USD 1/5/10/20/50/100. Cada pulsación suma solo en su moneda. Puedes editar o limpiar cada importe. Entradas inválidas no se reemplazan silenciosamente.
- Última tasa automática válida guardada localmente con fecha de referencia y hora real de consulta. Nunca se activa desde almacenamiento sin elegir explícitamente «Referencia anterior». Se muestra como anterior incluso si es del mismo día. Las tasas manuales no se presentan como datos del mercado. No se almacena la operación.
- PWA: manifest e iconos propios, aplicación sin conexión después de la primera carga completa y caché versionada limitada a su ruta. El botón Instalar aparece si el navegador ofrece esa opción; también puedes usar el menú del navegador. En iOS, Compartir → Añadir a pantalla de inicio. La instalación depende del navegador y requiere HTTPS o localhost.

## Cálculos y cotizaciones

Importes en centavos `BigInt`; hasta 10 dígitos enteros y 2 decimales, punto o coma decimal, sin separadores de miles. Tasas racionales hasta 10 decimales. USD recibido se convierte redondeando al centavo MXN más próximo, mitades hacia arriba; después se suma el recibido MXN. El total a cobrar en USD se redondea hacia arriba al centavo. Cambiar modalidad limpia el recibido; Nueva cuenta conserva modalidad y configuración de tasa durante la sesión.

Fuente: https://frankfurter.dev/ — endpoint público `https://api.frankfurter.dev/v2/rate/USD/MXN`, sin claves, con CORS. Referencias diarias, no cotizaciones en tiempo real. Se validan par, valor positivo y fecha; respuestas automáticas mayores de siete días o futuras se rechazan. HTTP, JSON, red o timeout de 12 segundos invalidan la tasa automática. La tasa anterior solo se puede usar eligiéndola, con sus fechas visibles; puede ser antigua y no representa el mercado actual. Un fallo de almacenamiento se informa sin bloquear MXN ni la tasa manual.

Al desconectarse se invalida la tasa automática; no se consulta mientras el navegador informa falta de conexión. Al reconectarse se intenta actualizar. Una tasa anterior seleccionada queda fija durante ese uso, aunque se consulte otra nueva en segundo plano. No se cachea la API en el service worker.

## Actualizaciones de la PWA

`sw.js` precarga atómicamente el conjunto de archivos de interfaz. En cada entrega se debe cambiar `VERSION` si cambia cualquiera de esos archivos. Una nueva versión espera sin alterar un cobro; el aviso permite aplicarla y recargar explícitamente (limpia la operación). También se activa al cerrar todas las pestañas anteriores. Al activarse elimina solo las cachés antiguas de esta aplicación y ruta. Se revisan actualizaciones al abrir, volver a la pestaña y recuperar conexión. No se recarga automáticamente durante un cobro.

## Pruebas

```sh
npm test
npx playwright install chromium
npm run test:browser
```

En Windows las pruebas usan Edge si existe en su ruta habitual; en otros entornos usan Chromium de Playwright. El ejecutor crea su propio servidor temporal, reproduce `/calculadora-mxn-usd/` y no modifica Pages ni el service worker del repositorio. Resultados de capturas en `test-results/` (excluido de Git).

La prueba de actualización sirve temporalmente un worker `1.1.1-test` desde memoria y verifica espera, aplicación, limpieza de caché anterior y preservación de una caché ajena. No modifica archivos fuente. Las pruebas de API usan datos controlados; la consulta real se comprueba por separado.

## Publicación futura

Solo tras autorización: fusionar la rama a `main`. Pages ya está configurado desde la raíz de `main`; no cambiar esa configuración para probar esta rama. Las rutas del manifest, módulos e iconos son relativas y el scope del worker permanece dentro de `/calculadora-mxn-usd/`.
