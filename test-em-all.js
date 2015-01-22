/*
test-em-all - a tool for online examination of students.
Copyright (C) 2015 Stepan Orlov

This file is part of test-em-all.

Full text of copyright notice can be found in file copyright_notice.txt in the test-em-all root directory.
License agreement can be found in file LICENSE.md in the test-em-all root directory.
*/

var
    path = require('path'),
    express = require('express'),
    logger = require('morgan'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    flash = require('express-flash'),
    favicon = require('express-favicon')

var app = express()

app.set('port', process.env.PORT || 80)
//app.set('port', process.env.PORT || 3000)
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')

app.use(logger('dev'))
app.use(favicon('public/favicon.png'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))
app.use(methodOverride())
app.use(cookieParser('your secret here'))
app.use(session({
    secret: 'zzzzz-aaaaa',
    resave: false,
    saveUninitialized: false
}))
app.use(flash())


require('./students')(app)
require('./su')(app)
require('./test')(app)
require('./task')(app)

app.get('/', function(req, res) {
    if (!req.session.studentId)
        res.redirect('/identify')
    else
        res.redirect('/test')
})

app.use(express.static(path.join(__dirname, 'public')));

app.listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'))
})
