# Publicación oficial v1.4 — Cambio inteligente

Origen probado: `glezeddy/calculadora-mxn-usd-pruebas`, rama `feature/version-1.4-cambio-inteligente`, commit `c6abff8ce0ee3d36dad065b91a9607b6d75cc4d8`.

Producción anterior: `5cecb17da1044e5aacbf72588754f9c973afa5ae`, v1.2. Respaldo remoto: etiqueta `v1.2-pre-v1.4`, además de `v1.2.0` y un bundle local verificado con el historial completo.

La integración conserva el historial del origen. Las únicas adaptaciones al código probado son el nombre oficial del manifiesto (sin «Pruebas»), identificación de entrega en el pie y versión de paquete/worker `1.4.0` y las referencias de versión de las pruebas. No cambia la lógica de cobro ni el diseño.

## Datos y PWA

v1.2 conserva únicamente la referencia de tasa con la clave `cuenta-clara:last-valid-rate:v1`. El módulo y la clave permanecen iguales en v1.4. No hay inventario ni borrador persistente v1.2 que convertir. **Terminar el cobro en curso antes de aceptar la actualización desde v1.2:** los campos de esa versión solo estaban en memoria y su recarga comienza una cuenta nueva. La actualización no borra almacenamiento local.

v1.4 crea caja y borrador bajo `cuenta-clara:cash:v1:` más la ruta. La caja de pruebas no se importa a producción. La tasa histórica, compartida por origen desde versiones anteriores, requiere selección explícita offline. No se inventan inventarios ni se marcan como verificados.

Manifiesto, recursos y registro SW usan rutas relativas. La caché incluye el ámbito completo; activar v1.4 elimina solo versiones anteriores del mismo ámbito. No elimina la caché ni los datos de la ruta de pruebas.

La prueba `release14.spec.js` reproduce el worker v1.2 desde el commit original y actualiza a la entrega candidata, comprueba conservación de datos, separación por ruta, eliminación de caché anterior, selección explícita de tasa y persistencia offline. Las pruebas existentes cubren efectivo, ajustes, deshacer y actualización con movimientos pendientes.

## Reversión si existe un problema real

Crear una rama desde el `main` vigente, restaurar su árbol desde `v1.2-pre-v1.4` mediante un nuevo commit y PR (sin reset ni force push). Antes de publicar el retorno, asignar un identificador nuevo a la caché del worker de recuperación, comprobar rutas y ejecutar las pruebas v1.2. No borrar localStorage: conservar los datos v1.4 para diagnóstico y recuperación; v1.2 no administra esa caja. Verificar actualización HTTPS y retirada del worker v1.4 en un perfil instalado. Conservar esta rama, las etiquetas y el repositorio de pruebas.

La instalación y actualización en Android/iPhone físicos requieren comprobación manual; la automatización de navegador no sustituye esa prueba.
