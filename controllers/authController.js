const userModel = require('../models/userModel');

exports.findUser = (req, res) => {
    const userId = parseInt(req.params.id); 
    const allUsers = userModel.getAllUsers(); 
    const user = allUsers.find(u => u.id === userId);

    if (user) {
        res.send(`User is : ${user.name}`);
    } else {
        res.status(404).send("User not found !");
    }
};