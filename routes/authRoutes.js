// const express=require('express');
// const routes=express.Router();
// const userController=require('../controller/controls.js');
// routes.get('/user',userController.getUsers);
// routes.get('/user/:id',userController.getUsersById);
// module.exports=routes;
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/user/:id', authController.findUser);

module.exports = router;