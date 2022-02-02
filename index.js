const Express = require('express');
var cors = require('cors')
var admin = require("firebase-admin/app");
var firebase_auth = require("firebase-admin/auth");

require('dotenv').config();

var serviceAccount = require("./svs_SAK.json");

admin.initializeApp({
  credential: admin.cert(serviceAccount)
});

const app = Express();

app.use(cors())

app.get("/authenticate",
async (req, res) => {
  const uid = req.query.uid;
  firebase_auth.getAuth()
    .createCustomToken(uid)
    .then((customToken) => {
        res.send(customToken);
    })
    .catch((error) => {
        console.log('Error creating custom token:', error);
    });

}


);


app.listen(3000, () => {
    console.log("Server running on port 3000");
});

