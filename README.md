# Pizza-Express Bakcend

Esta es una **API/backend** para una pizzeria llamada **Pizza-Express**, hecha para simular la compra, tramite y visualización de pedidos de pizza, a través de una interfaz estética. 

---

### Funcionalidades para la API:

- **Autenticación completa**: registro, login y recuperación de contraseña mediante JWT.
- **Gestión de pedidos y compra de pizzas**: el usuario puede obtener todas las pizzas disponibles y elegir cuales comprar enviando su solicitud junto a sus datos de domicilio.
- **Protección de rutas** mediante **JWT**, asegurando que solo usuarios autorizados puedan acceder a ciertas operaciones.
- **CORS habilitado**, preparado para trabajar con frontend externo.
- **Envío de emails automáticos** para la recuperación de contraseña.
- **Middleware de seguridad** con `csurf` y `cookie-parser`.

---

### Requisitos

Para ejecutar este proyecto necesitas:

- **Node.js >= 18.x**
- **MySQL** (local o en la nube, en este caso Clever Cloud)
- Paquetes de Node.js incluidos en `package.json`:
  - `express`
  - `cors`
  - `dotenv`
  - `mysql2`
  - `jsonwebtoken`
  - `bcryptjs`
  - `cookie-parser`
  - `csurf`
  - `express-validator`
  - `nodemailer`
  - `nodemon`
  - `cross-env`
  - `@getbrevo/brevo`

---

### Instalación

1. **Clona el repositorio**  
   ```bash
   git clone https://github.com/DavidKal29/PIZZA-EXPRESS-BACKEND.git
   cd PIZZA-EXPRESS-BACKEND

2. **Instala las dependencias**  
   ```bash
    npm install

3. **Crea un .env en la raíz del proyecto y añade tus propios datos**
   ```bash
    HOST=
    USER=
    PASSWORD=
    DATABASE=
    JWT_SECRET=
    CORREO=
    APIKEY= (Asegurate de tener cuenta en Brevo y tener la apikey válida)
    PORT=
    FRONTEND_URL=

4. **Modo Desarrollo**
   ```bash
    npm run dev

5. **Modo Producción**
   ```bash
    npm start
 
