//Iniciamos la app de express
const express = require('express')
const app = express()
const cookieParser = require('cookie-parser')
const pool = require('./db.js')
const cors = require('cors')


app.use(express.json())//Para leer json
app.use(express.urlencoded({extended:true}))//Para leer formularios
app.use(cookieParser())//Para poder mandar cookies al forntend
app.use(cors({
    origin:'http://localhost:3000'
}))




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


app.post('/register',(req,res)=>{
    const body = req.body

    console.log('El cuerpo del body:',body);

    res.json({"message":"Datos recibidos con éxito"})
    
})

const PORT=5000
app.listen(PORT,()=>{
    console.log('Funcionando en el puerto 5000');
})