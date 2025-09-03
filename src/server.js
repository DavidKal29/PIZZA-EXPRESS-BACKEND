//Iniciamos la app de express
const express = require('express')
const app = express()

const dotenv = require('dotenv').config()

//Herramientas para login/register/api
const pool = require('./db.js')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const nodemailer = require('nodemailer')

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



//Usos de la aplicacion
app.use(express.json())//Para leer json
app.use(express.urlencoded({extended:true}))//Para leer formularios
app.use(cookieParser())//Para poder mandar cookies al forntend
app.use(cors({
    origin:'http://localhost:3000',
    credentials: true //Para enviar cookies
}))



app.get('/',(req,res)=>{
    res.send('Esto funciona a la perfección')
})


app.post('/login',async(req,res)=>{
    let {email,password} = req.body

    const conn = await pool.getConnection()

    const [user_exists] = await conn.query('SELECT * FROM usuarios WHERE email = ?',[email])

    if (user_exists.length>0) {
        console.log('El usuario ya existe');

        const equalPassword = await bcrypt.compare(password,user_exists[0].password)

        if (equalPassword) {
            console.log('EL usuario ha sido loqueado con éxito');

            const id = user_exists[0].id
            const username = user_exists[0].username
            const email = user_exists[0].email

            const user = {id:id,email:email,username:username}
            
            //Preparamos el Tokencillo
            const token = jwt.sign(user,JWT_SECRET,{expiresIn:'1h'})

            res.cookie('token',token,{
                httpOnly: true,//Para que no se pueda leer desde el el DOM
                secure:false, //De momento false porque no tenemos https
                maxAge: 3600 * 1000, //Maximo 1 hora de expiracion
                sameSite:'lax'//La cookie solo se envia entre backend y dominios que esten en CORS  
            })

            conn.release()

            
            res.json({"user":user_exists[0]})
        }else{
            console.log('El usuario existe pero contraseña equivocada');

            conn.release()

            res.json({"message":"El usuario existe pero contraseña equivocada"})
            
        }
              
    }else{
        console.log('Usuario no existe');

        conn.release()

        res.json({"message":"Usuario no existe"})
        
    }
    
})


app.post('/register',async(req,res)=>{
    let {email,username,password} = req.body
    console.log(req.body.email);
    

    const conn = await pool.getConnection()

    const encriptedPassword = await bcrypt.hash(password,10)

    const [user_exists] = await conn.query('SELECT * FROM usuarios WHERE email = ?',[email])

    console.log('queee');
    

    if (user_exists.length>0) {
        console.log('El usuario ya existe');

        conn.release()
        
        res.json({"message":"El usuario ya existe"})
    }else{
        
        await conn.query('INSERT INTO usuarios (email, username, password) VALUES (?,?,?)',[email,username,encriptedPassword])

        const [user_exists] = await conn.query('SELECT * FROM usuarios WHERE email = ?',[email])


        const user = {id:user_exists[0].id,email:user_exists[0].email,username:user_exists[0].username}
            
        //Preparamos el Tokencillo
        const token = jwt.sign(user,JWT_SECRET,{expiresIn:'1h'})

        res.cookie('token',token,{
            httpOnly: true,//Para que no se pueda leer desde el el DOM
            secure:false, //De momento false porque no tenemos https
            maxAge: 3600 * 1000 //Maximo 1 hora de expiracion
        })

        conn.release()


        res.json({"user":user})
    }

    
    
})

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

app.get('/me',(req,res)=>{
    console.log('Comprobando login');

    const result = checkLogin(req,res)

    res.json(result)
    
})

app.get('/logout',(req,res)=>{
    const result = checkLogin(req,res)

    
    if (result.loggedIn) {
        res.clearCookie('token',{
            maxAge:3600 * 1000,
            httpOnly:true,
            secure:false
        })
    }

    res.json({"message":"Logout"})
})





app.get('/pizzas',async(req,res)=>{
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
    

    console.log('Consulta ha llegado');

    conn.release()
    

    if (results.length>0) {
        res.json(results)
    }else{
        res.json([])
    }
})


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



app.post('/finalizarCompra',async(req,res)=>{
    console.log('El body:',req.body);

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

                console.log('El presio:',precio);
                

                precio_total = precio_total + (precio * cart[i].cantidad)

                
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

                console.log('El presio:',precio);
                

                precio = (precio * cart[i].cantidad)

                precio = precio.toFixed(2)

                await conn.query('INSERT INTO detalles_pedido (id_pedido,id_pizza,cantidad,precio) VALUES(?,?,?,?)',[id_pedido,id_pizza,cart[i].cantidad,precio])
                
            }

        }

        conn.release()

        res.json({"message":"Pedido realizado"})
    }else{

        conn.release()


        res.json({"message":"Usted no está logueado"})
    }

    
    
})


app.get('/obtenerPedidos',async(req,res)=>{
    const result = checkLogin(req,res)

    if (result.loggedIn) {
        const user_id = result.user.id

        const conn = await pool.getConnection()

        const pedidos = []

        const [data] = await conn.query('SELECT * FROM pedidos WHERE id_usuario = ? ORDER BY id DESC',[user_id])

        //console.log('La data:',data);
        

        for (let i = 0; i < data.length; i++) {
            const consulta = `SELECT dp.cantidad, dp.precio, p.id, p.imagen, p.nombre, p.precio as precio_unitario
            FROM detalles_pedido dp
            INNER JOIN pizzas p
            ON dp.id_pizza = p.id
            WHERE dp.id_pedido = ?
            `

            const [detalles_pedido] = await conn.query(consulta,[data[i].id])

            console.log('Los detalles del pedido:',detalles_pedido);
            

            pedidos.push({pedido:data[i], detalles_pedido:detalles_pedido})
            
        }

        console.log('Los pedidos:',pedidos);
        //console.log('Los detallles del primer pedido:',pedidos[0].detalles_pedido);
        
        conn.release()

        res.json({"message":pedidos})
        


    }else{

        conn.release()
        res.json({"message":"Usted no está logueado"})
    }
})



app.post('/recuperarPassword',async(req,res)=>{
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

})

app.post('/cambiarPassword/:token',async(req,res)=>{

    console.log('He caido asqui');
    

    const token = req.params.token

    console.log('El token:',token);
    

    const conn = await pool.getConnection()

    try {
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
                        res.json({"message":"Las contraseñas son iguales"})
                    }else{
                        const new_encripted_password = await bcrypt.hash(new_password,10)
                        await conn.query('UPDATE usuarios SET password = ?',[new_encripted_password])

                        await conn.query('UPDATE usuarios SET token = "" WHERE email = ? and token = ?',[email,token])
                        res.json({"message":"Contraseña cambiada con éxito"})
                    }
                }
            }else{
                res.json({"message":"Contraseñas coinciden"})
            }

        }else{
            res.json({"message":"Todo mal, token no existe en el usuario"})
        }

    } catch (error) {
        res.json({"message":"Token Invalido"})
    }

    

})



const PORT=5000
app.listen(PORT,()=>{
    console.log('Funcionando en el puerto 5000');
})