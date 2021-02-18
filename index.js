#!/usr/bin/env node

const express = require('express');
const fs = require('fs');

const app = express();

const dir = process.argv[2];

console.log(dir);

app.get('/', (req, res) => {
	res.send(fs.readdirSync(dir));
});

app.listen(5000);
