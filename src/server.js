//Iniciamos la app de express
const express = require('express')
const app = express()
const cookieParser = require('cookie-parser')
const pool = require('./db.js')

console.log('La piscina:',pool);


app.use(express.json())//Para leer json
app.use(express.urlencoded({extended:true}))//Para leer formularios
app.use(cookieParser())//Para poder mandar cookies al forntend


app.get('/',(req,res)=>{
    res.send('Esto funciona a la perfección')
})



const PORT=3000
app.listen(PORT,()=>{
    console.log('Funcionando en el puerto 3000');
})