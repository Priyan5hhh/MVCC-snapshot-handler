const users = [
    { id: 1, name: "Neha", password: "123" },
    { id: 2, name: "Rahul", password: "456" },
    { id: 3, name: "Amit", password: "789" }
];

exports.getAllUsers = () => {
    return users;
};