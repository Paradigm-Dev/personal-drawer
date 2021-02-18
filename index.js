#!/usr/bin/env node

const express = require('express');
const fs = require('fs');
const cors = require('cors');
const prettyBytes = require('pretty-bytes');
const mime = require('mime-types');
const moment = require('moment');
const formidable = require('formidable');
const _path = require('path');

const app = express();
const dir = '/';

app.use(express.json());
app.use(cors());
app.use('/', express.static(__dirname + '/dist'));

function files(path) {
	const dir = fs.readdirSync(path, { withFileTypes: true });

	let stats = [];
	dir.forEach(async (item) => {
		let stat = fs.statSync(`${decodeURIComponent(path)}/${item.name}`);

		if (item.name[0] != '.') {
			stats.push({
				name: item.name,
				size: prettyBytes(stat.size),
				modified: moment(stat.mtime).format('M/D/YYYY [at] h:mm'),
				dir: stat.isDirectory(),
				type: mime.lookup(`${decodeURIComponent(path)}/${item.name}`) || _path.extname(item.name) + ' file',
				path: `${decodeURIComponent(path)}/${item.name}`
			});
		}
	});

	return stats;
}

app.get('/api/:path', (req, res) => {
	if (decodeURIComponent(req.params.path) == '/') {
		res.json({ files: files('/') });
	} else {
		res.json({ files: files(dir + '/' + decodeURIComponent(req.params.path).substring(dir.length + 1)) });
	}
});

app.get('/api/download/:path', async (req, res) => {
	res.download(decodeURIComponent(req.params.path));
});

app.post('/api/:path', async (req, res) => {
	const file_path = decodeURIComponent(req.params.path);

	const form = formidable({
		multiples: true,
		uploadDir: file_path,
		keepExtensions: true,
		maxFileSize: 100 * 1024 * 1024 * 1024
	});

	form.on('file', (filename, file) => {
		fs.renameSync(file.path, `${file_path}/${file.name}`);
	});

	form.once('end', () => {
		res.json({ files: files(file_path) });
	});

	await form.parse(req, async (error, fields, items) => {
		if (error) {
			console.error(error);
			res.end();
		} else {
			Object.keys(items).forEach(async (i) => {});
		}
	});
});

app.delete('/api/:path', async (req, res) => {
	const path = decodeURIComponent(req.params.path);

	if (fs.statSync(path).isDirectory()) {
		fs.rmdir(path, { maxRetries: 3, retryDelay: 100, recursive: true }, function (err) {
			if (err) console.error(err);
			res.json({ files: files(path.substring(0, path.lastIndexOf('/'))) });
		});
	} else {
		fs.unlink(path, async (error) => {
			if (error) throw error;
			res.json({ files: files(path.substring(0, path.lastIndexOf('/'))) });
		});
	}
});

app.post('/api/rename/:path', async (req, res) => {
	fs.rename(decodeURIComponent(req.params.path), req.body.new, async (err) => {
		if (err) throw err;
		res.json({
			files: files(req.body.new.substring(0, req.body.new.lastIndexOf('/')))
		});
	});
});

app.put('/api/:path', (req, res) => {
	const path = decodeURIComponent(req.params.path);

	if (fs.existsSync(path + '/New folder')) {
		res.json({ error: 'New folder already exists!' });
	} else {
		fs.mkdirSync(path + '/New folder');
		res.json({ files: files(path) });
	}
});

app.listen(5000);
