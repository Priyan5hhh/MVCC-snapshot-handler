const express = require('express');
const app = express();
const authRoutes = require('./routes/authRoutes'); 

app.use('/', authRoutes); 

app.listen(3000, () => console.log("Server chal raha hai!"));