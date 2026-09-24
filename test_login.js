const fs = require('fs');

global.window = {};

// Load api.js
const apiCode = fs.readFileSync('js/api.js', 'utf8');
eval(apiCode + `

window.google.script.run.withSuccessHandler(res => {
    console.log("Success handler Response:", res);
}).loginUser("admin", "1234");
`);
