# Abarrotes La Universal

Tienda en línea para la tiendita + panel de administración.

- **Tienda** (`/`): una sola página con el catálogo completo por categoría y precios, búsqueda instantánea y ofertas. Los pedidos se hacen **platicando con un asistente de IA**: el cliente escribe su lista como quiera, el asistente la entiende, le muestra una cotización con el total y el cliente la confirma con un botón. También puede agregar productos con los botones del catálogo. Página de seguimiento del pedido para el cliente.
- **Panel** (`/admin`): inicio con ventas del día, pedidos en línea (se actualizan solos), venta de mostrador (funciona con lector de código de barras), productos con foto, categorías, inventario (entradas, mermas, conteos e historial), reporte de ventas con descarga en CSV y ajustes de la web (textos, aviso, horarios, contacto, costos de envío y pausar pedidos).

Hecho con Next.js 16, Prisma 7 y SQLite, con Tailwind CSS.

## Correrlo en tu computadora (VS Code)

### Lo que necesitas instalado

- [Node.js](https://nodejs.org/) 20.9 o más nuevo (recomendado: la versión LTS). Para revisarlo: `node -v`.
- [Visual Studio Code](https://code.visualstudio.com/).
- Git, solo si vas a clonar el proyecto desde un repositorio.

### La primera vez

1. **Abre la carpeta del proyecto** en VS Code: *Archivo → Abrir carpeta…* y elige `la_universal`. Si VS Code te sugiere instalar las extensiones recomendadas (ESLint, Tailwind CSS y Prisma), acepta.
2. **Abre una terminal**: *Terminal → Nueva terminal* (o `` Ctrl+` ``).
3. **Crea tu archivo `.env`** a partir del ejemplo (si ya tienes uno, sáltate este paso):

   ```bash
   copy .env.example .env
   ```

   En Mac o Linux es `cp .env.example .env`. Luego abre `.env` y cambia `SESSION_SECRET` por un texto largo al azar; puedes generar uno con:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

4. **Instala y prepara la base de datos.** Puedes hacerlo con la tarea *Terminal → Ejecutar tarea… → Preparar proyecto (primera vez)*, o a mano:

   ```bash
   npm install
   ```

   ```bash
   npm run db:migrate
   ```

   ```bash
   npm run db:seed
   ```

   `db:migrate` crea la base de datos SQLite en `prisma/dev.db` y `db:seed` carga categorías, productos de ejemplo, los ajustes y el usuario administrador.

### Cada vez que quieras trabajar

```bash
npm run dev
```

O presiona **F5** y elige *Iniciar La Universal*. Cuando la terminal diga `Ready`, abre:

- Tienda: http://localhost:3000
- Panel: http://localhost:3000/admin. El usuario y la contraseña son `ADMIN_EMAIL` y `ADMIN_PASSWORD` de tu `.env` (por defecto `admin@launiversal.mx` / `cambiame123`). **Cambia la contraseña** desde *Ajustes de la web*.

Para detener el servidor: `Ctrl+C` en la terminal (o el botón ⏹ si lo iniciaste con F5). Los cambios que hagas en el código se ven solos en el navegador, sin reiniciar.

### Depurar

En la vista *Ejecutar y depurar* (`Ctrl+Shift+D`) hay tres opciones: *Iniciar La Universal*, *Depurar servidor* (para poner puntos de interrupción en server actions, el bot, etc.) y *Depurar todo*, que además abre Edge conectado al depurador.

### Si algo falla

- **"npm.ps1 no se puede cargar porque la ejecución de scripts está deshabilitada"** (PowerShell en Windows): en la terminal de VS Code elige el perfil *Command Prompt* con la flecha junto al **+**, o ejecuta una vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` en PowerShell.
- **"Port 3000 is in use"**: ya hay otro servidor corriendo. Ciérralo, o abre la dirección que Next te indique (por ejemplo http://localhost:3001).
- **Error de `better-sqlite3` o "Could not locate the bindings file"**: ejecuta `npm rebuild better-sqlite3`.
- **Error de Prisma del tipo "Cannot find module '@/generated/prisma'"** o campos que no existen después de cambiar el esquema: ejecuta `npx prisma generate` y reinicia `npm run dev`.
- **Quieres empezar de cero**: `npm run db:reset` borra la base de datos y vuelve a cargar los datos de ejemplo (también disponible como tarea *Reiniciar base de datos*).

### Otros comandos

| Comando | Qué hace |
| --- | --- |
| `npm run db:studio` | Abre Prisma Studio para ver o editar la base de datos |
| `npm run db:reset` | Borra la base de datos y la vuelve a crear con los datos de ejemplo |
| `npm run build && npm start` | Versión de producción |

## Cómo está organizado

```
prisma/schema.prisma        Modelo de datos (dinero en centavos)
prisma/seed.ts              Datos iniciales
src/app/[lang]/             Páginas de la tienda ("es" sin prefijo en la URL, "en" bajo /en)
src/components/store/       Catálogo, tarjetas de producto y chat de pedidos
src/actions/chat.ts         Acciones del chat web (mensajes, agregar, confirmar, cancelar)
src/lib/chat/               Pedido en curso, cotización y confirmación (compartido web/WhatsApp)
src/lib/whatsapp/bot.ts     Asistente con Claude (el mismo para la página y WhatsApp)
src/app/admin/login/        Login del panel
src/app/admin/(panel)/      Páginas del panel
src/actions/                Server actions (checkout y acciones del panel)
src/lib/store-data.ts       Consultas de la tienda en caché ("use cache" + etiquetas)
src/lib/inventory.ts        Único lugar donde cambia el stock (y deja registro)
src/lib/auth.ts             Sesión del panel (cookie firmada con jose)
src/lib/i18n/               Idiomas: diccionarios de textos, rutas por idioma
src/lib/translate.ts        Traducción al inglés con Claude
src/proxy.ts                Idioma de la tienda (español / inglés) y protección del panel
```

## Cómo pide el cliente (chat de la página)

1. Toca **Quiero hacer un pedido** (o agrega productos con **＋ Agregar** en el catálogo) y se abre el chat.
2. Escribe su lista como quiera: "2 cocas de 600, un kilo de huevo y pan". El asistente busca cada producto en el catálogo real, pregunta lo que no quede claro y hace un resumen.
3. Le pide nombre, teléfono, si recoge o es a domicilio (y la dirección) y cómo va a pagar.
4. Muestra la **cotización** en una tarjeta: productos, precios, envío y total. La calcula el sistema con tus precios reales: la IA no puede inventar precios ni equivocarse en la suma.
5. El cliente toca **Confirmar** (el pedido llega al panel como cualquier otro), **Cambiar algo** (lo escribe y sale una cotización nueva) o **Cancelar**.

Detalles:

- El pedido en curso se guarda en el navegador del cliente: si cierra la página, al volver lo encuentra igual.
- Si paga con transferencia, al confirmar ve tus datos bancarios con botones para copiarlos.
- Las conversaciones de la página aparecen en **Panel → Conversaciones** (marcadas como *Página web*), junto a las de WhatsApp. Puedes contestar tú y el cliente ve tu respuesta en el chat.
- Para que nadie gaste tu saldo de IA, hay límites: 40 mensajes por hora por chat y 8 chats nuevos por hora por conexión.
- Las direcciones viejas `/productos`, `/carrito` y `/checkout` llevan al catálogo o abren el chat.

## Promociones

En **Panel → Promociones** creas, editas, pausas o eliminas descuentos. Se aplican solos en la cotización del chat, en WhatsApp y en el pedido, y quedan guardados en cada pedido con su desglose.

Cada promoción tiene:

- **Descuento:** porcentaje (p. ej. 15%) o monto fijo (p. ej. $20).
- **Condiciones (opcionales):** forma de pago (efectivo, tarjeta, transferencia), días de la semana, una sola categoría (p. ej. 10% en Frutas y verduras los martes), solo para recoger o para envío, y compra mínima.

Si hay varias que aplican, se suman (nunca más que el subtotal). Si el cliente paga de una forma que no tiene descuento, la cotización le avisa cuánto ahorraría pagando de la otra. Las promociones activas aparecen en la portada y el asistente las conoce. El nombre en inglés se traduce solo si lo dejas vacío.

## Tienda en inglés

Para clientes extranjeros, todas las páginas de la tienda tienen un botón **🌐 English / Español** arriba, junto al carrito.

- **Direcciones:** el español sigue en las direcciones de siempre (`/`, `/productos`…) y el inglés vive en `/en` (`/en/productos`, `/en/carrito`…), así que puedes compartir enlaces en cada idioma.
- **El idioma se recuerda:** quien eligió inglés sigue en inglés aunque abra un enlace en español. Un visitante nuevo con el navegador en inglés entra directo en inglés.
- **Qué se traduce:** los botones y mensajes de la tienda están traducidos en el código ([src/lib/i18n/dictionaries.ts](src/lib/i18n/dictionaries.ts)). Los nombres y descripciones de productos, las categorías y los textos de la portada se escriben en el panel; si los dejas vacíos, **Claude los traduce automáticamente** al guardar. En *Ajustes de la web → Tienda en inglés* hay un botón para traducir de una vez todo lo que falte. Lo que escribas a mano en inglés nunca se reemplaza.
- **Búsqueda:** funciona en los dos idiomas ("milk" encuentra la leche).
- **Pedidos:** se guarda en qué idioma pidió el cliente. Su página de seguimiento y sus avisos de WhatsApp salen en ese idioma, y en el panel el pedido aparece marcado como *Cliente en inglés*. El bot de WhatsApp también contesta en inglés si le escriben en inglés.
- El panel de administración se queda en español.

## Pedidos por WhatsApp

El bot usa **Claude** para platicar con el cliente y la **API oficial de WhatsApp (Meta)** para recibir y mandar mensajes.

**Cómo atiende el bot:**

- Al cliente lo identifica su número de WhatsApp. La primera vez le pregunta cómo le gusta que le llamen y lo guarda.
- En cada pedido pregunta si lo recoge o lo quiere a domicilio. Solo pide dirección si es a domicilio: le ofrece las que ha usado antes, pero siempre pregunta a cuál enviar, porque puede pedir para otra persona (y en ese caso pregunta quién recibe).
- Busca en el catálogo real, arma el carrito, muestra el resumen con el total y solo crea el pedido cuando el cliente confirma. El pedido aparece en el panel como cualquier otro, con la etiqueta 💬 WhatsApp.
- Si el cliente pide hablar con una persona o algo se sale de lo normal, pasa el chat a la tienda. Desde **Panel → WhatsApp** puedes contestar tú y pausar o reactivar el bot por chat.
- **Avisos automáticos:** el cliente recibe un mensaje cuando su pedido se confirma, está listo, va en camino, se entrega o se cancela (también los pedidos de la web). La tienda recibe un mensaje con cada pedido nuevo.

**Probar sin conectar nada:** en *Panel → WhatsApp → 🧪 Probar bot* escribes como si fueras un cliente; cada prueba es un cliente nuevo. Solo necesitas `ANTHROPIC_API_KEY` en `.env`. Si tu clave no pertenece a un workspace de Anthropic, agrega también `ANTHROPIC_WORKSPACE_ID` (Console → Settings → Workspaces, empieza con `wrkspc_`) o crea una clave dentro de un workspace.

**Conectar con WhatsApp de verdad:**

1. Crea una app en [Meta for Developers](https://developers.facebook.com/) con el producto **WhatsApp** y un número de teléfono dedicado (no puede estar usándose en la app de WhatsApp normal).
2. En `.env` llena `WHATSAPP_TOKEN` (token permanente de un usuario del sistema), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` (Configuración de la app → Básica) y `SITE_URL` con tu dominio público. `WHATSAPP_VERIFY_TOKEN` ya trae uno generado.
3. En WhatsApp → Configuración → Webhook, pon la URL `https://TU-DOMINIO/api/whatsapp`, el mismo token de verificación, y suscríbete al campo **messages**. Para probar desde tu computadora sin publicar, puedes usar un túnel como `cloudflared tunnel --url http://localhost:3000`.
4. Crea y espera la aprobación de dos plantillas (categoría *Utilidad*, idioma español de México). Hacen falta porque WhatsApp solo deja mandar texto libre en las 24 horas siguientes al último mensaje del cliente:
   - `WHATSAPP_TEMPLATE_ORDER_UPDATE`, por ejemplo: *Hola {{1}}, tu pedido {{2}} cambió de estado: {{3}}. ¡Gracias por tu compra!*
   - `WHATSAPP_TEMPLATE_NEW_ORDER`, por ejemplo: *Pedido nuevo {{1}} de {{2}} por {{3}}. Revísalo en el panel.*

   Para clientes que pidieron en inglés, agrega a la plantilla de avisos (`WHATSAPP_TEMPLATE_ORDER_UPDATE`) una versión en inglés (*English (US)*) con el mismo nombre, por ejemplo: *Hi {{1}}, your order {{2}} is now: {{3}}. Thanks for shopping with us!*
5. En *Ajustes de la web → WhatsApp* escribe el número que recibe los avisos de pedidos nuevos y, si quieres, indicaciones extra para el bot (promociones, productos que no vendes…).

El bot usa el modelo `claude-opus-5-5` con esfuerzo bajo (respuestas rápidas). Se puede cambiar con `ANTHROPIC_MODEL` y `ANTHROPIC_EFFORT`. Si el modelo declina una solicitud por sus filtros de seguridad, la API reintenta sola con un modelo de respaldo (`fallbacks: "default"`).

Notas:

- La tienda se sirve desde caché y se actualiza al momento cuando cambias algo en el panel.
- El stock se descuenta al recibir un pedido y regresa si lo cancelas. En mostrador se permite vender aunque el sistema marque 0, porque la mercancía está físicamente ahí.
- Las fotos que subes se guardan en `storage/uploads/`. Si publicas en un servicio sin disco persistente (como Vercel), habrá que moverlas a un almacenamiento externo y cambiar SQLite por PostgreSQL.
