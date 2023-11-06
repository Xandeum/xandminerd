const express = require('express');
const { createHandler } = require('graphql-http/lib/use/express');
const schema = require('./schema');

const app = express();
const port = 4000;

app.all('/drives', createHandler({ schema }));

app.listen({ port: 4000 });
console.log(`Listening to port ${port}`);