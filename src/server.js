//Iniciamos la app de express
const express = require('express')
const app = express()

const dotenv = require('dotenv').config()

//Herramientas para login/register/api
const pool = require('./db.js')
const cors = require('cors')
const bcrypt = require('bcryptjs')

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
                maxAge: 3600 * 1000 //Maximo 1 hora de expiracion
            })

            
            res.json({"user":user_exists[0]})
        }else{
            console.log('El usuario existe pero contraseña equivocada');

            res.json({"message":"El usuario existe pero contraseña equivocada"})
            
        }
              
    }else{
        console.log('Usuario no existe');

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


app.get('/cart/addOne/:id_pizza',async(req,res)=>{
    const id_pizza = req.params.id_pizza

    const result = checkLogin(req,res)

    const conn = await pool.getConnection()

    if (result.user) {
        const id_usuario = result.user.id


        const [cart_exists] = await conn.query('SELECT * FROM carrito WHERE id_pizza = ? and id_usuario = ?',[id_pizza,id_usuario])

        if (cart_exists.length>0) {
            await conn.query('UPDATE carrito SET cantidad=cantidad+1, precio_total=precio_total+precio_unitario WHERE id_usuario = ? and id_pizza = ?',[id_usuario,id_pizza])

            res.status(200).json({"message":"Añadido al carrito"})
        }else{

            const [results] = await conn.query('SELECT precio FROM pizzas WHERE id = ?',[id_pizza])

            if (results.length>0) {
                const precio = results[0].precio
                await conn.query('INSERT INTO carrito (id_usuario,id_pizza,cantidad,precio_total,precio_unitario) VALUES(?,?,?,?,?)',[id_usuario,id_pizza,1,precio,precio])

                res.status(200).json({"message":"Añadido al carrito"})
            }else{
                res.status(404).json({"message":"No existe ese producto en el carrito"})
            }

            
        }

        
    }else{
        res.status(500).json({"message":"No existe usuario con ese id"})
    }
})


app.get('/cart',async(req,res)=>{
    const conn = await pool.getConnection()
    console.log('HEMOS ENTRADO AL CARRITO / CART');
    

    const results = checkLogin(req,res)

    if (results.user) {
        const id_user = results.user.id

        const consulta = `SELECT p.nombre, p.imagen, c.id, c.id_usuario, c.id_pizza, c.cantidad, c.precio_total
        FROM pizzas p 
        INNER JOIN carrito as c
        ON p.id = c.id_pizza
        WHERE c.id_usuario = ?
        `

        const [cart] = await conn.query(consulta,[id_user])

        console.log('El carrito:',cart);
        

        if (cart.length>0) {
            console.log('El carrito tiene datos');
            
            res.json({"cart":cart})
        }else{
            console.log('El carrito no tien edatos');
            
            res.json({"cart":[]})
        }


    }else{
        res.json({"message":"Not Logged User"})
    }
})




const PORT=5000
app.listen(PORT,()=>{
    console.log('Funcionando en el puerto 5000');
})