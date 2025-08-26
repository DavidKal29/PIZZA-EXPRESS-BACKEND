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

            const username = user_exists[0].username
            const email = user_exists[0].email

            const user = {email:email,username:username}
            
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


        const user = {email:user_exists[0].email,username:user_exists[0].username}
            
        //Preparamos el Tokencillo
        const token = jwt.sign(user,JWT_SECRET,{expiresIn:'1h'})

        res.cookie('token',token,{
            httpOnly: true,//Para que no se pueda leer desde el el DOM
            secure:false, //De momento false porque no tenemos https
            maxAge: 3600 * 1000 //Maximo 1 hora de expiracion
        })


        res.json({"user":user_exists})
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

    console.log('Consulta ha llegado');

    conn.release()
    

    if (results.length>0) {
        res.json(results)
    }else{
        res.json([])
    }
})

const PORT=5000
app.listen(PORT,()=>{
    console.log('Funcionando en el puerto 5000');
})