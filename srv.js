#!/usr/bin/env /home/pi/n/bin/node
const http = require('http');
const hostname = '*';
const port = 3000;
const {promisify} = require('util');

var redis = require('redis');
var exec = require('child_process').exec;
var client = redis.createClient();

const getAsync = promisify(client.get).bind(client);
const hgetall = promisify(client.hgetall).bind(client);
const sadd = promisify(client.sadd).bind(client);
const zincrby = promisify(client.zincrby).bind(client);
const smembers = promisify(client.smembers).bind(client);
const zscore = promisify(client.zscore).bind(client);
const zscan = promisify(client.zscan).bind(client);

async function ServerMain(req, res)
{
	res.statusCode = 200;
	res.setHeader('Content-Type', 'text/html');

	var url = req.url;
	var array = Array();
	var a = url.split("/");
	for(var v in a)
	{
		if(a[v].length)
			array.push(a[v]);
	}
	res.write("<html><body>");
	var Command = array[0];
	if(Command != "add")
	{
		res.write("Command '" + Command);
		res.write("'         Known [show, add]<br>");
	}
	console.log("got commmand "+ Command + " url " + req.url);

	if(Command == "show")
	{
		try{
			let patterns = await smembers("patterns");
			res.write("<table>");
			for(let j = 0; j < patterns.length; ++j)
			{
				let code = patterns[j];
				let score = await zscore("scores", code);
				res.write("<tr><td>" + score + "</td><td><a href='dis/"+ code + "'>" + code  + "</a></td></tr>");
			}

			res.end("</table></body></html>");
			}catch(e){
				console.log(e);
			}
	}
	else if(Command == "add")
	{
		if(array.length < 3)
		{
			res.end("failed to add, to few args (" + array.length + ")");
		}
		else
		{
			try{
				let client = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
				let version = array[1];
				res.write("Thank you for reporting.<br>");
				res.write("client:" + client + "<br>");
				res.write("version:" + version + "<br>");
				for(let i = 2; i < array.length; ++i)
				{
					let code = array[i].toLowerCase();
					let Reject = 0;
					console.log("processing ", code);
					let l = code.length;
					if(l > 40)
						l = 40;
					for(let j = 0; j < l; ++j)
					{
						Reject = Reject || -1 == "0123456789abcdef".indexOf(code[j]);
					}
					if(!Reject)
					{	
						await sadd("patterns", code);
						await zincrby("scores", 1, code);
					}
					else
					{
						res.write("Invalid '" + code + "'<br>");
					}
				}
				res.end("</body></html>");
			}
			catch(e)
			{
				console.log(e);
			}	
		}
	}
	else if(Command == "dis")
	{
		if(array.length < 2)
		{
			res.end("failed to add, to few args (" + array.length + ")</body></html>");
		}
		else
		{
			let code = array[1];
			res.write("disassembling "+ code + "\n");
			let asm = ".byte ";
			let len = code.length < 40 ? code.length : 40;
			for(var i = 0; i < len; i += 2)
			{
			 	asm += "0x" + code[i] + code[i+1];
			 	if(i + 2 < code.length)
			 		asm += ",";
			}
			exec('echo "'+ asm + '" | raspberry-pi-as-x86-64 ', function callback(error, stdout, stderr){	
				exec("raspberry-pi-objdump-x86-64 -M intel -d", function callback(error, stdout, stderr){		
					res.write("<pre><code>");
					res.write(stdout);
					res.write("</code></pre>");
					res.end("</body></html>");
				});
			});
		}
	}
	else
	{
		res.write("unknown command '" + Command + "'");
		res.end("</body></html>");
	}
}


const server = http.createServer(ServerMain);
async function startup(){
	server.listen(port, () => {	
		console.log('Server running at port ${port}');
	});
}

client.on("ready", startup);
