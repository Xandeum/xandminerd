const express = require('express');
const { createHandler } = require('graphql-http/lib/use/express');
const schema = require('./schema');
const { getDriveInfo } = require('./helpers');

let cors = require('cors');
const app = express();
app.use(cors())
const port = 4000;

app.post('/drives', createHandler({ schema }));
app.get('/', (req, res) => {
  getDriveInfo();
  res.status(200);
  res.send({ message: 'Hello World!' });
});
app.listen({ port: 4000 });
console.log(`Listening to port ${port}`);