//Iniciamos la app de express
const express = require('express')
const app = express()

const {body,validationResult, cookie} = require('express-validator')

const dotenv = require('dotenv').config()

//Herramientas para login/register/api
const pool = require('./db.js')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const nodemailer = require('nodemailer')

//Configuramos nodemailer para enviar correos
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.CORREO,
    pass: process.env.PASSWORD_DEL_CORREO
  }
});


//Importamos el Brevo para enviar emails en produccion
const {brevo,apiInstance} = require('./brevo.js')

//Herramientas para el auth
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const JWT_SECRET=process.env.JWT_SECRET

const csruf = require('csurf')

//Middlewares
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(cookieParser())
app.use(cors({
    origin: process.env.FRONTEND_URL, 
    credentials: true
}))

//Ruta de prueba
app.get('/',(req,res)=>{
    try{
        res.send('Backend funcionando correctamente en producción 🚀')
    }catch(error){
        res.status(500).json({message:"Error en la ruta /"})
    }
})

const CSRFProtection = csruf({
    cookie:{
        httpOnly:true,
        secure:true,
        sameSite:'none'
    }
})


app.get('/csrf-token',CSRFProtection,(req,res)=>{
    res.json({csrfToken:req.csrfToken()})
})

//Ruta de login
app.post('/login',CSRFProtection,async(req,res)=>{
    let conn;
    try{
        let {email,password} = req.body
        conn = await pool.getConnection()
        const [user_exists] = await conn.query('SELECT * FROM usuarios WHERE email = ?',[email])

        if (user_exists.length>0) {
            const equalPassword = await bcrypt.compare(password,user_exists[0].password)

            if (equalPassword) {
                const id = user_exists[0].id
                const username = user_exists[0].username
                const email = user_exists[0].email
                const user = {id:id,email:email,username:username}
                
                const token = jwt.sign(user,JWT_SECRET,{expiresIn:'1h'})

                res.cookie('token',token,{
                    httpOnly: true,
                    secure:true,
                    maxAge: 3600 * 1000,
                    sameSite:'none'
                })


                res.json({"user":user_exists[0]})
            }else{

                res.json({"message":"Contraseña incorrecta"})
            }
        }else{
            res.json({"message":"Usuario no existe"})
        }
    }catch(error){
        console.log(error);
        
        res.status(500).json({message:"Error en login"})
    }finally{
        if (conn) {
            conn.release()
        }
    }
})


//Validador de los inputs del register
const validadorRegister = [
        body('email')
        .trim()
        .notEmpty().withMessage('Email no puede estar vacío')
        .isEmail().withMessage('Debes poner un email válido')
        .normalizeEmail()
        .customSanitizer(val=>(val || '').replace(/\s+/g,''))
        .escape(),

        body('username')
        .trim()
        .notEmpty().withMessage('Username no puede estar vacío')
        .customSanitizer(val=>(val || '').replace(/\s+/g,''))
        .isLength({min:5,max:15}).withMessage('Username debe contener entre 5 y 15 carácteres')
        .matches(/^[a-zA-Z0-9_.]+$/).withMessage('Solo se permiten letras, números, guion bajo y punto')
        .matches(/[a-zA-Z]/).withMessage('Mínimo una letra en Username')
        .escape(),

        body('password')
        .trim()
        .notEmpty().withMessage('Password no puede estar vacío')
        .matches(/\d/).withMessage('Mínimo un dígito')
        .isLength({min:8,max:30}).withMessage('Password debe contener entre 8 y 30 carácteres')
        .matches(/[A-Z]/).withMessage('Mínimo una mayúscula en Password')
        .matches(/[#$€&%]/).withMessage('Mínimo un carácter especial en Password')
        .customSanitizer(val=>(val || '').replace(/\s+/g,''))
        .escape()
        
]


//Ruta de registro
app.post('/register',validadorRegister,CSRFProtection,async(req,res)=>{
    let conn;
    try{
        const errors = validationResult(req)
        

        if (!errors.isEmpty()) {
            
            return res.json({error:errors.array()[0]})
        }

        let {email,username,password} = req.body
        conn = await pool.getConnection()
        const encriptedPassword = await bcrypt.hash(password,10)
        const [user_exists] = await conn.query('SELECT * FROM usuarios WHERE email = ? or username = ?',[email,username])
        
        if (user_exists.length>0) {
            conn.release()
            return res.json({"message":"El usuario ya existe"})
        }else{
            await conn.query('INSERT INTO usuarios (email, username, password) VALUES (?,?,?)',[email,username,encriptedPassword])
            const [user_exists] = await conn.query('SELECT * FROM usuarios WHERE email = ?',[email])
            const user = {id:user_exists[0].id,email:user_exists[0].email,username:user_exists[0].username}
            const token = jwt.sign(user,JWT_SECRET,{expiresIn:'1h'})

            res.cookie('token',token,{
                httpOnly: true,
                secure:true,
                maxAge: 3600 * 1000,
                sameSite:'none'
            })

            return res.json({"user":user})
        }
    }catch(error){
        return res.status(500).json({message:"Error en register"})
    }finally{
        if (conn) {
            conn.release()
        }
    }
})

//Función para chequear si hay login
const checkLogin = (req,res)=>{
    const token = req.cookies.token
    if (!token) {
        return {loggedIn:false}
    }else{
        try {
            const user_decoded = jwt.verify(token,JWT_SECRET)
            return {loggedIn:true,user:user_decoded}
        } catch (error) {
            return {loggedIn:false}   
        }
    }
}

//Ruta para verificar login
app.get('/me',(req,res)=>{
    try{
        const result = checkLogin(req,res)
        res.json(result)
    }catch(error){
        res.status(500).json({message:"Error en /me"})
    }
})

//Ruta logout
app.get('/logout',(req,res)=>{
    try{
        const result = checkLogin(req,res)
        if (result.loggedIn) {
            res.clearCookie('token',{
                httpOnly:true,
                secure:true,
                sameSite:'none'
            })
        }
        res.json({"message":"Logout"})
    }catch(error){
        res.status(500).json({message:"Error en logout"})
    }
})

//Ruta para obtener todas las pizzas
app.get('/pizzas',async(req,res)=>{
    let conn;
    try{
        conn = await pool.getConnection()
        const consulta = `SELECT p.id,p.nombre,p.precio,p.imagen,GROUP_CONCAT(i.nombre SEPARATOR ',') as ingredientes 
            FROM pizzas p 
            INNER JOIN pizza_ingredientes as pi 
            ON p.id = pi.id_pizza 
            INNER JOIN ingredientes as i 
            ON pi.id_ingrediente = i.id 
            GROUP BY p.id, p.nombre, p.precio, p.imagen;
        `
        const [results] = await conn.query(consulta)
        res.json(results.length>0 ? results : [])
    }catch(error){
        res.status(500).json({message:"Error en /pizzas"})
    }finally{
        if (conn) {
            conn.release()
        }
    }
})

//Función para generar número de pedido
const generar_numero_pedido = (id_user)=>{
    let numero = ''
    const abecedario = [
        "A","B","C","D","E","F","G","H","I","J","K","L",
        "M","N","Ñ","O","P","Q","R","S","T","U","V","W",
        "X","Y","Z"
    ];
    for (let i = 0; i < 3; i++) {
        let num = Math.floor(Math.random()*9)
        numero = numero + num
        let letra = abecedario[Math.floor((Math.random()*abecedario.length)-1)]
        numero = numero + letra
        numero = numero + id_user
        numero = numero + Math.floor(Math.random()*5+Number(id_user))
    }
    return numero
}



const validadorEnvio = [
  body("nombreDestinatario")
    .trim()
    .notEmpty().withMessage("El nombre del destinatario no puede estar vacío")
    .isLength({ min: 3, max: 50 }).withMessage("El nombre debe tener entre 3 y 50 caracteres")
    .matches(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/).withMessage("El nombre solo puede contener letras y espacios")
    .customSanitizer(val => (val || "").replace(/\s+/g, " ").trim())
    .escape(),

  body("domicilio")
    .trim()
    .notEmpty().withMessage("El domicilio no puede estar vacío")
    .isLength({ min: 5, max: 100 }).withMessage("El domicilio debe tener entre 5 y 100 caracteres")
    .matches(/^[a-zA-Z0-9À-ÿ\u00f1\u00d1\s.,-]+$/).withMessage("El domicilio solo puede contener letras, números y símbolos básicos como coma o punto")
    .customSanitizer(val => (val || "").replace(/\s+/g, " ").trim())
    .escape(),

  body("localidad")
    .trim()
    .notEmpty().withMessage("La localidad no puede estar vacía")
    .isLength({ min: 2, max: 50 }).withMessage("La localidad debe tener entre 2 y 50 caracteres")
    .matches(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/).withMessage("La localidad solo puede contener letras y espacios")
    .customSanitizer(val => (val || "").replace(/\s+/g, " ").trim())
    .escape(),

  body("codigoPostal")
    .trim()
    .notEmpty().withMessage("El código postal no puede estar vacío")
    .isLength({ min: 4, max: 10 }).withMessage("El código postal debe tener entre 4 y 10 caracteres")
    .matches(/^[0-9]{4,10}$/).withMessage("El código postal solo puede contener números")
    .escape(),

  body("puerta")
    .notEmpty().withMessage("La puerta debe ponerse, sino lanzaremos el pedido a cualquier puerta")
    .trim()
    .isLength({ max: 10 }).withMessage("La puerta no puede tener más de 10 caracteres")
    .matches(/^[a-zA-Z0-9\-\/]*$/).withMessage("La puerta solo puede contener letras, números, guion o barra")
    .customSanitizer(val => (val || "").trim())
    .escape()
]


//Ruta para finalizar compra
app.post('/finalizarCompra',validadorEnvio,CSRFProtection,async(req,res)=>{
    let conn;
    try{
        const errors = validationResult(req)
        
        if (!errors.isEmpty()) {
            
            return res.json({error:errors.array()[0]})
        }

        const {nombreDestinatario,domicilio,localidad,codigoPostal,puerta,cart} = req.body
        conn = await pool.getConnection()
        const result = checkLogin(req,res)

        if (result.loggedIn) {
            const user_id = result.user.id
            if (cart.length>0) {
                let precio_total = 0
                for (let i = 0; i < cart.length; i++) {
                    let [precio] = await conn.query('SELECT precio FROM pizzas WHERE nombre = ?',[cart[i].nombre])
                    precio = parseFloat(precio[0].precio)
                    precio_total += precio * cart[i].cantidad
                }
                precio_total = precio_total.toFixed(2)
                const numero_pedido = generar_numero_pedido(user_id)
                const consulta = 'INSERT INTO pedidos (numero_pedido,precio_total,id_usuario,nombre_destinatario,domicilio,localidad,puerta,codigo_postal) VALUES(?,?,?,?,?,?,?,?)'
                const values = [numero_pedido,precio_total,user_id,nombreDestinatario,domicilio,localidad,puerta,codigoPostal]
                await conn.query(consulta,values)

                let [id_pedido] = await conn.query('SELECT id FROM pedidos ORDER BY id DESC LIMIT 1')
                id_pedido = id_pedido[0].id

                for (let i = 0; i < cart.length; i++) {
                    let [data] = await conn.query('SELECT id,precio FROM pizzas WHERE nombre = ?',[cart[i].nombre])
                    let id_pizza = data[0].id
                    let precio = parseFloat(data[0].precio)
                    precio = (precio * cart[i].cantidad).toFixed(2)
                    await conn.query('INSERT INTO detalles_pedido (id_pedido,id_pizza,cantidad,precio) VALUES(?,?,?,?)',[id_pedido,id_pizza,cart[i].cantidad,precio])
                }
            }
            res.json({"message":"Pedido realizado"})
        }else{
            res.json({"message":"Usted no está logueado"})
        }
    }catch(error){
        res.status(500).json({message:"Error al finalizar la compra"})
    }finally{
        if (conn) {
            conn.release()
        }
    }
})

//Ruta para obtener pedidos del usuario
app.get('/obtenerPedidos',async(req,res)=>{
    let conn;
    try{
        const result = checkLogin(req,res)
        if (result.loggedIn) {
            const user_id = result.user.id
            conn = await pool.getConnection()
            const pedidos = []
            const [data] = await conn.query('SELECT * FROM pedidos WHERE id_usuario = ? ORDER BY id DESC',[user_id])
            for (let i = 0; i < data.length; i++) {
                const consulta = `SELECT dp.cantidad, dp.precio, p.id, p.imagen, p.nombre, p.precio as precio_unitario
                FROM detalles_pedido dp
                INNER JOIN pizzas p
                ON dp.id_pizza = p.id
                WHERE dp.id_pedido = ?
                `
                const [detalles_pedido] = await conn.query(consulta,[data[i].id])
                pedidos.push({pedido:data[i], detalles_pedido:detalles_pedido})
            }
            res.json({"message":pedidos})
        }else{
            res.json({"message":"Usted no está logueado"})
        }
    }catch(error){
        res.status(500).json({message:"Error en obtenerPedidos"})
    }finally{
        if (conn) {
            conn.release()
        }
    }
})

//Validador del email de recuperación de contraseña
const validadorRecuperarPassword = [
        body('email')
        .trim()
        .notEmpty().withMessage('Email no puede estar vacío')
        .isEmail().withMessage('Debes poner un email válido')
        .normalizeEmail()
        .customSanitizer(val=>(val || '').replace(/\s+/g,''))
        .escape()
]

// Ruta para enviar correo de recuperación
app.post('/recuperarPassword',validadorRecuperarPassword,CSRFProtection, async (req, res) => {
    let conn
    try {
        const errors = validationResult(req)
        
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: errors.array()[0].msg })
        }

        conn = await pool.getConnection()
        const { email } = req.body
        const [user_exists] = await conn.query('SELECT * FROM usuarios WHERE email = ?', [email])

        if (user_exists.length > 0) {
            const token = jwt.sign({ email: email }, JWT_SECRET)

            await conn.query('UPDATE usuarios SET token = ? WHERE email = ?', [token, email])

            const sendSmtpEmail = {
                sender: { name: "Pizza-Express", email: process.env.CORREO },
                to: [{ email }],
                subject: "Recuperar Contraseña",
                textContent: `Para recuperar la contraseña entra en este enlace -> ${process.env.FRONTEND_URL}/cambiarPassword/${token}`,
                htmlContent: `<p>Para recuperar la contraseña, entra a -> <a href="${process.env.FRONTEND_URL}/cambiarPassword/${token}">Recuperar Contraseña</a></p>`
            };

            await apiInstance.sendTransacEmail(sendSmtpEmail)

            return res.json({message:'Correo enviado con éxito'})



        } else {
            return res.json({ message: "No hay ninguna cuenta asociada a este correo" })
        }

    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: "Error al enviar el email" })
    }finally{
        if (conn) {
            conn.release()
        }
    }
})


//Validador de cambio de contraseña
const validadorChangePassword = [
        
        body('new_password')
        .trim()
        .notEmpty().withMessage('Password no puede estar vacío')
        .matches(/\d/).withMessage('Mínimo un dígito')
        .isLength({min:8,max:30}).withMessage('Password debe contener entre 8 y 30 carácteres')
        .matches(/[A-Z]/).withMessage('Mínimo una mayúscula en Password')
        .matches(/[#$€&%]/).withMessage('Mínimo un carácter especial en Password')
        .customSanitizer(val=>(val || '').replace(/\s+/g,''))
        .escape()
        
]

//Ruta para cambiar contraseña
app.post('/cambiarPassword/:token',validadorChangePassword,CSRFProtection,async(req,res)=>{
    let conn;
    try{
        const errors = validationResult(req)
        

        const token = req.params.token
        conn = await pool.getConnection()
        const decoded = jwt.verify(token,JWT_SECRET)
        const email = decoded.email
        const [data] = await conn.query('SELECT token FROM usuarios WHERE email = ? and token = ?',[email,token])
        if (data.length>0) {
            const {new_password,confirm_password} = req.body
            if (new_password===confirm_password) {
                const [datos] = await conn.query('SELECT password FROM usuarios WHERE email = ?',[email])
                if (datos.length>0) {
                    const password_equals = await bcrypt.compare(new_password,datos[0].password)
                    if (password_equals) {
                        res.json({"message":"La nueva contraseña no puede ser igual a la anterior"})
                    }else{
                        if (!errors.isEmpty()) {
                            return res.status(400).json({ message: errors.array()[0].msg })
                        }
                        
                        const new_encripted_password = await bcrypt.hash(new_password,10)
                        await conn.query('UPDATE usuarios SET password = ? WHERE email = ?',[new_encripted_password,email])
                        await conn.query('UPDATE usuarios SET token = "" WHERE email = ?',[email])
                        res.json({"message":"Contraseña cambiada con éxito"})
                    }
                }
            }else{
                res.json({"message":"Contraseñas no coinciden"})
            }
        }else{
            res.json({"message":"Token inválido o expirado"})
        }
    }catch(error){
        res.json({"message":"Token inválido"})
    }finally{
        if (conn) {
            conn.release()
        }
    }
})

//Iniciamos el servidor
const PORT = process.env.PORT || 5000
app.listen(PORT,()=>{
    console.log(`Servidor escuchando en puerto ${PORT} en modo producción`)
})

