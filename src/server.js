//Iniciamos la app de express
const express = require('express')
const app = express()

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

//Herramientas para el auth
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const JWT_SECRET=process.env.JWT_SECRET

//Middlewares
app.use(express.json()) //Para leer json
app.use(express.urlencoded({extended:true})) //Para leer formularios
app.use(cookieParser()) //Para poder mandar cookies al frontend
app.use(cors({
    origin:'http://localhost:3000',
    credentials: true //Para enviar cookies
}))

//Ruta de prueba
app.get('/',(req,res)=>{
    try{
        res.send('Esto funciona a la perfección')
    }catch(error){
        res.status(500).json({message:"Error en la ruta /"})
    }
})

//Ruta de login
app.post('/login',async(req,res)=>{
    try{
        let {email,password} = req.body
        const conn = await pool.getConnection()
        const [user_exists] = await conn.query('SELECT * FROM usuarios WHERE email = ?',[email])

        if (user_exists.length>0) {
            //Usuario encontrado
            console.log('El usuario ya existe');
            const equalPassword = await bcrypt.compare(password,user_exists[0].password)

            if (equalPassword) {
                console.log('EL usuario ha sido loqueado con éxito');
                const id = user_exists[0].id
                const username = user_exists[0].username
                const email = user_exists[0].email
                const user = {id:id,email:email,username:username}
                
                //Generamos token
                const token = jwt.sign(user,JWT_SECRET,{expiresIn:'1h'})

                res.cookie('token',token,{
                    httpOnly: true,
                    secure:false,
                    maxAge: 3600 * 1000,
                    sameSite:'lax'
                })

                conn.release()
                res.json({"user":user_exists[0]})
            }else{
                //Contraseña incorrecta
                console.log('El usuario existe pero contraseña equivocada');
                conn.release()
                res.json({"message":"El usuario existe pero contraseña equivocada"})
            }
        }else{
            //Usuario no existe
            console.log('Usuario no existe');
            conn.release()
            res.json({"message":"Usuario no existe"})
        }
    }catch(error){
        res.status(500).json({message:"Error en login"})
    }
})

//Ruta de registro
app.post('/register',async(req,res)=>{
    try{
        let {email,username,password} = req.body
        const conn = await pool.getConnection()
        const encriptedPassword = await bcrypt.hash(password,10)
        const [user_exists] = await conn.query('SELECT * FROM usuarios WHERE email = ? or username = ?',[email,username])
        
        if (user_exists.length>0) {
            console.log('El usuario ya existe');
            conn.release()
            res.json({"message":"El usuario ya existe"})
        }else{
            await conn.query('INSERT INTO usuarios (email, username, password) VALUES (?,?,?)',[email,username,encriptedPassword])
            const [user_exists] = await conn.query('SELECT * FROM usuarios WHERE email = ?',[email])
            const user = {id:user_exists[0].id,email:user_exists[0].email,username:user_exists[0].username}
            const token = jwt.sign(user,JWT_SECRET,{expiresIn:'1h'})

            res.cookie('token',token,{
                httpOnly: true,
                secure:false,
                maxAge: 3600 * 1000
            })

            conn.release()
            res.json({"user":user})
        }
    }catch(error){
        res.status(500).json({message:"Error en register"})
    }
})

//Función para chequear si hay login
const checkLogin = (req,res)=>{
    const token = req.cookies.token
    if (!token) {
        const result = {loggedIn:false}
        return result
    }else{
        try {
            const user_decoded = jwt.verify(token,JWT_SECRET)
            console.log('usuario logueado');
            const result = {loggedIn:true,user:user_decoded}
            return result
        } catch (error) {
            const result = {loggedIn:false}
            return result   
        }
    }
}

//Ruta para verificar login
app.get('/me',(req,res)=>{
    try{
        console.log('Comprobando login');
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
                maxAge:3600 * 1000,
                httpOnly:true,
                secure:false
            })
        }
        res.json({"message":"Logout"})
    }catch(error){
        res.status(500).json({message:"Error en logout"})
    }
})

//Ruta para obtener todas las pizzas
app.get('/pizzas',async(req,res)=>{
    try{
        const conn = await pool.getConnection()
        const consulta = `SELECT p.id,p.nombre,p.precio,p.imagen,GROUP_CONCAT(i.nombre SEPARATOR ',') as ingredientes 
            FROM pizzas p 
            INNER JOIN pizza_ingredientes as pi 
            ON p.id = pi.id_pizza 
            INNER JOIN ingredientes as i 
            ON pi.id_ingrediente = i.id 
            GROUP BY p.id, p.nombre, p.precio, p.imagen;
        `
        const [results] = await conn.query(consulta)
        console.log('Los resultados de las pizzas:',results);
        conn.release()
        res.json(results.length>0 ? results : [])
    }catch(error){
        res.status(500).json({message:"Error en /pizzas"})
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

//Ruta para finalizar compra
app.post('/finalizarCompra',async(req,res)=>{
    try{
        const {nombreDestinatario,domicilio,localidad,codigoPostal,puerta,cart} = req.body
        const conn = await pool.getConnection()
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
                    id_pizza = data[0].id
                    precio = parseFloat(data[0].precio)
                    precio = (precio * cart[i].cantidad).toFixed(2)
                    await conn.query('INSERT INTO detalles_pedido (id_pedido,id_pizza,cantidad,precio) VALUES(?,?,?,?)',[id_pedido,id_pizza,cart[i].cantidad,precio])
                }
            }
            conn.release()
            res.json({"message":"Pedido realizado"})
        }else{
            conn.release()
            res.json({"message":"Usted no está logueado"})
        }
    }catch(error){
        res.status(500).json({message:"Error en finalizarCompra"})
    }
})

//Ruta para obtener pedidos del usuario
app.get('/obtenerPedidos',async(req,res)=>{
    try{
        const result = checkLogin(req,res)
        if (result.loggedIn) {
            const user_id = result.user.id
            const conn = await pool.getConnection()
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
            conn.release()
            res.json({"message":pedidos})
        }else{
            res.json({"message":"Usted no está logueado"})
        }
    }catch(error){
        res.status(500).json({message:"Error en obtenerPedidos"})
    }
})

//Ruta para enviar correo de recuperación
app.post('/recuperarPassword',async(req,res)=>{
    try{
        const conn = await pool.getConnection()
        const {email} = req.body
        const [user_exists] = await conn.query('SELECT * FROM usuarios WHERE email = ?',[email])
        if (user_exists.length>0) {
            const token = jwt.sign({email:email},JWT_SECRET)
            const mailOptions = {
                from: process.env.CORREO,
                to: email,
                subject: "Recuperación de Contraseña",
                text: `Para recuperar el password, entre en este enlace -> http://localhost:3000/cambiarPassword/${token}`
            };
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log("Error al enviar:", error);
                    res.json({"message":"Error al enviar correo"})
                }
                console.log("Correo enviado:", info.response);
            });
            await conn.query('UPDATE usuarios SET token = ? WHERE email = ?',[token,email])
            res.json({"message":"Correo enviado","token":token})
        }else{
            console.log('EL usuario no existe');
            res.json({"message":"El usuario no existe"})
        }
    }catch(error){
        res.status(500).json({message:"Error en recuperarPassword"})
    }
})

//Ruta para cambiar contraseña
app.post('/cambiarPassword/:token',async(req,res)=>{
    try{
        const token = req.params.token
        const conn = await pool.getConnection()
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
                        res.json({"message":"Las nueva contraseña no puede ser igual a la anterior"})
                    }else{
                        const new_encripted_password = await bcrypt.hash(new_password,10)
                        await conn.query('UPDATE usuarios SET password = ?',[new_encripted_password])
                        await conn.query('UPDATE usuarios SET token = "" WHERE email = ? and token = ?',[email,token])
                        res.json({"message":"Contraseña cambiada con éxito"})
                    }
                }
            }else{
                res.json({"message":"Contraseñas no coinciden"})
            }
        }else{
            res.json({"message":"Solo se puede cambiar una vez, solicite nuevo token"})
        }
    }catch(error){
        res.json({"message":"Token Invalido"})
    }
})

//Iniciamos el servidor
app.listen(5000,()=>{
    console.log('Escuchando en el 5000');
})
