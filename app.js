const Express = require('express');
const axios = require('axios');
var cors = require('cors')
var admin = require("firebase-admin/app");
var firebase_auth = require("firebase-admin/auth");
const Discord = require('discord.js');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
var dynamo = require('dynamodb');
require('dotenv').config();
AWS.config.update({ accessKeyId: process.env.AWSAccessKeyId, secretAccessKey: process.env.AWSSecretKey, region: 'eu-central-1' });
dynamo.AWS.config.update({ accessKeyId: process.env.AWSAccessKeyId, secretAccessKey: process.env.AWSSecretKey, region: 'eu-central-1' });
const AWS_client = new AWS.DynamoDB.DocumentClient();
const tableName = 'svs-users';
const Joi = require('joi');
const discord_client = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MEMBERS", "GUILD_PRESENCES"] });
var serviceAccount = {
  "type": process.env.type,
  "project_id": process.env.project_id,
  "private_key_id": process.env.private_key_id,
  "private_key": process.env.private_key,
  "client_email": process.env.client_email,
  "client_id": process.env.client_id,
  "auth_uri": process.env.auth_uri,
  "token_uri":process.env.token_uri,
  "auth_provider_x509_cert_url": process.env.auth_provider_x509_cert_url,
  "client_x509_cert_url": process.env.client_x509_cert_url
}
;
const PORT = process.env.PORT || 8080
admin.initializeApp({
  credential: admin.cert(serviceAccount)
});

const app = Express();

app.use(cors())

var User = dynamo.define('user', {
  hashKey: 'user_id',
  timestamps: true,
  schema: {
    user_id: Joi.string(),
    data: Joi.string(),
  }
});

var Server_id = dynamo.define('server_id', {
  hashKey: 'id',
  timestamps: true,
  schema: {
    id: Joi.string(),
  }
});

dynamo.createTables(function (err) {
  if (err) {
    console.log('Error creating tables: ', err);
  } else {
    console.log('Tables has been created');
  }
});
var dynamodb = new AWS.DynamoDB();
dynamo.dynamoDriver(dynamodb);


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


app.get("/",
  async (req, res) => {
    res.json("HELLO WORLD")

  }
);

app.get('/servers', (req, res) => {
  let o = { servers: [] }
  discord_client.guilds.cache.each(guild => {
    let obj = {};
    obj.id = guild.id;
    obj.name = guild.name;
    obj.icon = guild.icon;
    o.servers.push(obj);
  });
  res.json(o);
});

app.get('/servers/:id', (req, res) => {
  const id = req.params.id;
  const s = discord_client.guilds.cache.get(id);
  let o = {}
  o.id = s.id;
  o.name = s.name;
  o.icon = s.icon;

  res.json(o);
});

app.get('/servers/:id/users', (req, res) => {
  const id = req.params.id;
  const s = discord_client.guilds.cache.get(id);
  var o = s.members.cache.map(user => user.id);
  res.json(o);
});


app.get('/users/:id', (req, res) => {
  const id = req.params.id;
  User.get(id, function (err, acc) {
    if (acc === null) {
      discord_client.users.fetch(id).then(
        user => {

          let o = {}
          o.id = user.id;
          o.name = user.username;
          o.tag = user.tag;
          o.icon = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?`;
          const s = discord_client.guilds.cache.get(process.env.SvS_ID);
          let member = s.members.cache.get(user.id);
          o.isStaff = (member.roles.cache.has(process.env.SvS_Staff_ID));
          o.isLeaders = (member.roles.cache.has(process.env.SvS_Leaders_ID));
          User.create({ user_id: user.id, data: JSON.stringify(o) }, function (err, acc) {
            console.log('created account in DynamoDB', acc.get('user_id'));
          });
          res.json(user);

        }



      );


    }
    else {
      let data = acc.get('data');
      data = JSON.parse(data);
      console.log(data);
      res.json(data);
    }

  });
});

app.get('/update_user/:id', (req, res) => {
  const id = req.params.id;
  discord_client.users.fetch(id).then(
    user => {

      let o = {}
      o.id = user.id;
      o.name = user.username;
      o.tag = user.tag;
      o.icon = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?`;
      const s = discord_client.guilds.cache.get(process.env.SvS_ID);
      let member = s.members.cache.get(user.id);
      o.isStaff = (member.roles.cache.has(process.env.SvS_Staff_ID));
      o.isLeaders = (member.roles.cache.has(process.env.SvS_Leaders_ID));
      User.update({ user_id: user.id, data: JSON.stringify(o) }, function (err, acc) {
        console.log('created account in DynamoDB', acc.get('user_id'));
      });
      res.json(user);

    }

  );
});


app.get('/invites/id/:id', (req, res) => {
  const id = req.params.id;
  let data = {};
  Server_id.get(id, function (err, acc) {
    if (acc === null) {
      
      axios.get('https://discord.com/api/invites/' + id)
  .then(function (response) {
    data = {id:response.data.guild.id};
    res.json(data);
  })
  .catch(function (error) {
    
    res.json(error);
  })
  .then(function () {
    Server_id.update(data, function (err, acc) {
      //         console.log('created account in DynamoDB', acc.get('user_id'));
       });
  });



    }
    else {
       data = acc.get('data');
      data = JSON.parse(data);
      console.log(data);
      res.json(data);
    }

  });


});



app.get('/invites/data/:id', (req, res) => {
  const id = req.params.id;
  axios.get('https://discord.com/api/invites/' + id)
  .then(function (response) {
    console.log(response.data.guild);
  })
  .catch(function (error) {
    
    res.json(error);
  })
  .then(function () {
    // always executed
  });




//   discord_client.users.fetch(id).then(
//     user => {

//       let o = {}
//       o.id = user.id;
//       o.name = user.username;
//       o.tag = user.tag;
//       o.icon = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?`;
//       const s = discord_client.guilds.cache.get(process.env.SvS_ID);
//       let member = s.members.cache.get(user.id);
//       o.isStaff = (member.roles.cache.has(process.env.SvS_Staff_ID));
//       o.isLeaders = (member.roles.cache.has(process.env.SvS_Leaders_ID));
//       User.update({ user_id: user.id, data: JSON.stringify(o) }, function (err, acc) {
//         console.log('created account in DynamoDB', acc.get('user_id'));
//       });
//       res.json(user);

//     }

//   );
});








discord_client.login(process.env.BOT_TOKEN);


app.listen(PORT, () => {
  console.log("Server running on port "+ PORT);
});




