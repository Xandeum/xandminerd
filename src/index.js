const express = require('express');
const { createHandler } = require('graphql-http/lib/use/express');
const schema = require('./schema');
const { getDiskSpaceInfo, testNetworkSpeed } = require('./helpers');

let cors = require('cors');
const app = express();
app.use(cors())
const port = 4000;

app.post('/drives', createHandler({ schema }));
app.post('/', (req, res) => {
  getDiskSpaceInfo().then((data) => {
    res.status(200);
    res.send({ data });
  });
});

app.get('/network', (req, res) => {
  testNetworkSpeed().then((data) => {
    res.status(200);
    res.send({ data: JSON.parse(data) });
  }).catch((err) => {
    res.status(500);
    res.send({ err });
  });
});

app.listen({ port: 4000 });
console.log(`Listening to port ${port}`);