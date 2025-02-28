const express=require('express');
const bodyParser=require('body-parser');
const myempRoutes=require('./routes/myemp');
const app=express();
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/myemp',myempRoutes);

app.set('view engine','ejs');
const path = require('path'); // Import path module
app.set('views', path.join(__dirname, 'views'));


app.listen(3000,()=>{
    console.log('server is running on http://localhost:3000');
});