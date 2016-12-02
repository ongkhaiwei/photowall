/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express'),
	path = require('path'),
	fs = require('fs'),
	multer = require('multer'),
	errorhandler = require('errorhandler'),
	bodyParser   = require('body-parser'),
	session = require('express-session'),
  pkgcloud = require('pkgcloud'),
  multer  = require('multer');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// create a new express server
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ secret: 'SECRET' } ));
app.use(express.query());

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

var config = {
    provider: 'openstack',
    useServiceCatalog: true,
    useInternal: false,
    keystoneAuthVersion: 'v3',
    authUrl: 'https://identity.open.softlayer.com',
    tenantId: 'f9f782a9e69d47438bd390945c1f9f89',    //projectId from credentials
    domainId: '1cf07d8b33c64135bc5357b2dd10af23',
    username: 'admin_3229aa3df3395afae5ca9a1c38d9267822867385',
    password: 'pyz1G*kMG2nD&IIf',
    region: 'dallas'   //dallas or london 
  };

var storageClient = pkgcloud.storage.createClient(config);

storageClient.auth(function(err) {
    if (err) {
        console.error(err);
    }
    else {
        console.log(storageClient._identity);
    }
});

app.get('/photo', function(req,res) {
  res.redirect('photo.html');
});

app.get('/qrcode', function(req,res) {
  res.redirect('qrcode.html');
});

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new photo', function (data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new photo', {
      message: data
    });
  });
});


var upload = multer({ dest: 'uploads/' });

app.get("/files", function(req, res) {

  storageClient.getFiles("my-container", function(err, files) {
    res.status(200).send(files).end();
  });

});

app.get("/file/:filename", function (req, res) {

  var myFile2 = fs.createWriteStream("uploads/"+req.params.filename);

  storageClient.download({
    container: 'my-container',
    remote: req.params.filename
  }, function(err, result) {

    var uploadFolder = path.join(__dirname, 'uploads/');
    fs.readFile(uploadFolder + req.params.filename, function (err, content) {
      if (err) {
        res.writeHead(400, {'Content-type':'text/html'})
        console.log(err);
        res.end("No such image");
      } else {
          //specify the content type in the response will be an image
        res.writeHead(200,{'Content-type':'image/jpg'});
        res.end(content);
      }
    });

  }).pipe(myFile2);

});

var im = require('imagemagick');

app.post('/upload', upload.single('file'), function(req, res) {

  im.convert(['uploads/'+req.file.filename, '-rotate', '90', 'uploads/'+'_'+req.file.filename],
    function(err, stdout){
      if (err) throw err;
      im.resize({
        srcPath: 'uploads/'+'_'+req.file.filename,
        dstPath: 'uploads/'+'t_'+req.file.filename,
        width:   360
       
        }, function(err, stdout){
          if (err) throw err;
          var myFile = fs.createReadStream('uploads/'+'t_'+req.file.filename);

          var upload = storageClient.upload({
            container: 'my-container',
            remote: 't_'+req.file.filename
          });

          upload.on('error', function(err) {
            console.error(err);
          });

          upload.on('success', function(file) {
            console.log(file.toJSON());
            res.status(200).send('t_'+req.file.filename).end();
          });

          myFile.pipe(upload);
      });
    });
});

// start server on the specified port and binding host
server.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});
