//Iniciamos la app de express
const express = require('express')
const app = express()
const cookieParser = require('cookie-parser')
const pool = require('./db.js')


app.use(express.json())//Para leer json
app.use(express.urlencoded({extended:true}))//Para leer formularios
app.use(cookieParser())//Para poder mandar cookies al forntend


app.get('/',(req,res)=>{
    res.send('Esto funciona a la perfección')
})

app.get('/pizzas',async(req,res)=>{
    const conn = await pool.getConnection()

    const [pizzas] = await conn.query('SELECT * FROM pizzas')

    console.log("Las pizzas:",pizzas);
    

    if (pizzas.length>0) {
        res.status(200).send(pizzas)
    }else{
        res.status(404).json({"message":"No se han encontrado las pizzas"})
    }

})

const PORT=3000
app.listen(PORT,()=>{
    console.log('Funcionando en el puerto 3000');
})