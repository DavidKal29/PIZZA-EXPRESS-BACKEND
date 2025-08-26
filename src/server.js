//Iniciamos la app de express
const express = require('express')
const app = express()

//Herramientas para login/register/api
const pool = require('./db.js')
const cors = require('cors')
const bcrypt = require('bcryptjs')

//Herramientas para el auth
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')


//Usos de la aplicacion
app.use(express.json())//Para leer json
app.use(express.urlencoded({extended:true}))//Para leer formularios
app.use(cookieParser())//Para poder mandar cookies al forntend
app.use(cors({
    origin:'http://localhost:3000'
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

    const conn = await pool.getConnection()

    const encriptedPassword = await bcrypt.hash(password,10)

    const [user_exists] = await conn.query('SELECT * FROM usuarios WHERE email = ?',[email])

    if (user_exists.length>0) {
        console.log('El usuario ya existe');
        
        res.json({"message":"El usuario ya existe"})
    }else{
        await conn.query('INSERT INTO usuarios (email, username, password) VALUES (?,?,?)',[email,username,encriptedPassword])

        const [user] = await conn.query('SELECT * FROM usuarios WHERE email = ?',[email])

        console.log('EL user:',user);

        res.json({"user":user[0]})
    }

    
    
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