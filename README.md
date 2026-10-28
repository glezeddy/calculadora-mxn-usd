# Cuenta clara · Calculadora MXN / USD

Aplicación estática en español para sumar precios y calcular cambio en pesos. No registra ventas ni envía importes a terceros. Solo consulta el par USD/MXN a Frankfurter al abrir y al pulsar actualizar. La configuración se conserva al iniciar una nueva cuenta, durante la sesión; recargar la página la restablece.

## Archivos

- `index.html`: interfaz accesible.
- `styles.css`: diseño adaptable, sin fuentes ni recursos externos.
- `app.js`: manejo de la cuenta y estados de la interfaz.
- `money.js`: cálculos con BigInt, centavos y tasas racionales.
- `rates.js`: consulta, tiempo límite y validación de cotizaciones.
- `tests/`: pruebas con el ejecutor nativo de Node.js.

## Uso local

Sirve esta carpeta con un servidor estático (por ejemplo, Live Server de VS Code). Abre la URL HTTP que indique. No abras `index.html` con `file://`, porque los módulos de JavaScript necesitan HTTP. No se necesita backend ni compilación.

Pruebas de cálculo y API con Node.js 20 o posterior:

```sh
npm test
```

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube **el contenido de esta carpeta** a la raíz del repositorio: `index.html`, `styles.css`, `app.js`, `money.js`, `rates.js`, `.nojekyll` y el README. Puedes incluir las pruebas y `package.json`.
3. En el repositorio abre **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Selecciona la rama `main`, carpeta `/(root)` y pulsa **Save**.
6. Cuando termine la publicación, abre el enlace que muestre GitHub Pages.

Las rutas son relativas y funcionan en subdirectorios como `https://usuario.github.io/repositorio/`. No subas claves, no hay ninguna que configurar. No se ha publicado automáticamente ningún repositorio.

## Reglas de cálculo

- Importes: máximo 10 dígitos enteros y 2 decimales; se acepta punto o coma decimal, sin separadores de miles. Campos vacíos de precio no suman; todos vacíos impiden calcular cambio. Negativos y texto bloquean el cálculo.
- Dinero en centavos con `BigInt`: suma y resta exactas. Las tasas se representan como fracciones decimales con hasta 10 decimales.
- Recibido USD × tasa: redondeo al centavo MXN más próximo, mitades hacia arriba. El cambio se resta en centavos MXN.
- Total a cobrar USD: redondeo hacia arriba al centavo para cubrir el total MXN. Puede generar unos centavos de cambio en MXN.
- Cambiar moneda vacía el dinero recibido para evitar reinterpretarlo. Nueva cuenta vacía precios y recibido; conserva moneda, tasa y modo de cotización.

## Tipo de cambio y errores

Fuente: [Frankfurter, documentación oficial](https://frankfurter.dev/), endpoint `https://api.frankfurter.dev/v2/rate/USD/MXN`. Servicio público sin clave, con CORS. Son referencias diarias, no cotizaciones en tiempo real; pueden corresponder al último día hábil. No se inventa ni se incluye ninguna tasa inicial de respaldo.

Se muestran la última consulta (hora local del dispositivo), la última consulta exitosa y la fecha de referencia entregada por la API. La tasa manual se identifica siempre como manual y sin referencia de mercado. No se guarda una tasa automática en almacenamiento local.

Cada actualización invalida la tasa automática anterior. Ante error HTTP, JSON inválido, red, espera superior a 12 segundos, par incorrecto, tasa no positiva o fecha inválida/mayor de siete días de antigüedad, se bloquean los cálculos en USD hasta obtener una nueva tasa o seleccionar una manual válida. El cobro en MXN sigue disponible. La disponibilidad del servicio externo puede variar.

## Comprobación manual

1. Suma 125.50 + 74.49; recibido 200 MXN: cambio 0.01 MXN.
2. Tasa manual 17.50; compra 350 MXN: equivalente 20.00 USD; recibido 25 USD: cambio 87.50 MXN. Recibido 10 USD: faltan 175.00 MXN.
3. Prueba campos vacíos, negativos, texto y tasa cero: nunca debe aparecer un cambio calculado con entradas inválidas.
4. Desconecta la red y actualiza en modo automático: no debe mantenerse una tasa automática válida. Selecciona manual para continuar.
5. Pulsa Nueva cuenta: se limpian importes, se conserva la configuración de tasa.
6. Comprueba en pantalla de 360 px y escritorio: sin desplazamiento horizontal, campos y botones utilizables.
