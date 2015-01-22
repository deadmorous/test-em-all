/*
test-em-all - a tool for online examination of students.
Copyright (C) 2015 Stepan Orlov

This file is part of test-em-all.

Full text of copyright notice can be found in file copyright_notice.txt in the test-em-all root directory.
License agreement can be found in file LICENSE.md in the test-em-all root directory.
*/

var
    express = require('express'),
    fs = require('fs'),
    path = require('path'),
    students = require('./students'),
        student = students.student,
        studentsData = students.data,
        StudentsData = students.Data,
    Test = require('./test.js').Test,
    _ = require('lodash'),
    crypto = require('crypto')

var dataDir = path.join(__dirname, 'data')

fs.mkdir(dataDir, function(){})

module.exports = function(app) {
    var su = express.Router()
    var nameEnding = ''
    app.use('/su', su)
    su.get('/auth', function(req, res) {
        if (req.session.supervisor)
            return res.redirect('/su')
        res.render('su-auth', {message: req.flash('suAuthErrorMessage')})
    })
    su.post('/auth', function(req, res) {
        var SuPassHash = 'bc59e772e61054fcfcfa6f9e478b307a5b05286b'
        var shasum = crypto.createHash('sha1')
        shasum.update(req.body.pass, {encoding: 'utf8'})
        var hash = shasum.digest('hex');
        if(hash === SuPassHash) {
            req.session.supervisor = true
            return res.redirect('/su')
        }
        req.flash('suAuthErrorMessage', 'Неверный пароль')
        res.redirect('/su/auth')
    })
    su.get('/exit', function(req, res) {
        delete req.session.supervisor
        res.redirect('/su/auth')
    })
    su.use(function(req, res, next) {
        if (!req.session.supervisor)
            return res.redirect('/su/auth')
        next()
    })
    su.get('/', function(req, res) {
        fs.readdir(dataDir, function(err, files) {
            if (err) {
                console.log(err)
                return res.status(500).send('Unable to load data file list')
            }
            res.render('su', {
                studentsData: studentsData,
                files: files,
                nameEnding: nameEnding
            })
        })
    })
    su.post('/update-student', function(req, res) {
        var b = JSON.parse(req.body.data)
        if (!(b.id && b.field && b.value !== undefined))
            return res.status(400).send('Query parameters id, field, and value are required')
        if (!b.field in {examFinished:1, markPut:1, hasBonus:1, taskSolved:1, termTest:1})
            return res.status(400).send('Query parameter \'field\' has an invalid value')
        var st = studentsData.byid(b.id)
        if (!st)
            return res.status(404).send('Такой студент не найден')
        st[b.field] = b.value
        studentsData.unsaved = true
        res.sendStatus(200)
    })
    su.post('/deny-identification', function(req, res) {
        var b = req.body
        if (b.value === undefined)
            return res.status(400).send('Query \'value\' is required')
        var v = typeof b.value === 'string'? b.value === 'true': b.value == true
        studentsData.denyIdentification = v
        res.sendStatus(200)
    })
    su.post('/save', function(req, res) {
        if (studentsData.timeTillAllFinish() > 0)
            return res.status(403).send('Cannot save data: not all students have finished passing the test')
        nameEnding = req.body.nameEnding
        var nameEndingFinal = nameEnding? '-' + nameEnding: ''
        var time = (new Date).toISOString().replace(/:/g,'-').replace(/\.\d+\w?$/, '').replace(/T/, '_')
        var fileName = time+nameEndingFinal+'.json'
        var filePath = path.join(dataDir, fileName)
        fs.writeFile(filePath, JSON.stringify(studentsData), {encoding: 'utf8'}, function(err) {
            if (err) {
                console.log(err)
                return res.status(500).send('Failed to save file ' + fileName)
            }
            studentsData.unsaved = false
            res.send('Saved file ' + fileName)
        })
    })
    su.get('/load', function(req, res) {
        var fileName = req.query.file
        if (!fileName)
            return res.status(400).send('Query parameter \'file\' is missing')
        if (studentsData.timeTillAllFinish() > 0)
            return res.status(403).send('Cannot load data: not all students have finished passing the test')
        if (studentsData.unsaved)
            return res.status(403).send('Cannot load data: save current state first')
        var filePath = path.join(dataDir, fileName)
        fs.readFile(filePath, {encoding: 'utf8'}, function(err, data) {
            if (err) {
                console.log(err)
                return res.status(404).send('Failed to read file ' + fileName)
            }
            var json = JSON.parse(data)
            var newStudentsData = StudentsData.fromJson(json, Test)
            studentsData.list = newStudentsData.list
            res.redirect('/su')
        })
    })
    su.get('/clear', function(req, res) {
       if (studentsData.timeTillAllFinish() > 0)
           return res.status(403).send('Cannot clear data: not all students have finished passing the test')
       if (studentsData.unsaved)
           return res.status(403).send('Cannot clear data: save current state first')
       studentsData.list = {}
       res.redirect('/su')
    })

    su.get('/test', function(req, res) {
        var studentId = req.query.student
        if (!studentId)
            return res.status(400).send('Query parameter \'student\' is missing')
        var st = studentsData.byid(studentId)
        if (!st)
            return res.status(404).send('Student is not found')
        if (!st.test)
            return res.status(404).send('No test is associated with the student')
        res.render('test', {
            req: req,
            student: st,
            allFinished: true,
            timeTillAllFinish: 0,
            timeTillAllFinishFmt: '-',
            summary: st.test.summary(),
            backref: '/su',
            suview: true
        })
    })
    su.get('/task', function(req, res) {
        var studentId = req.query.student
        if (!studentId)
            return res.status(400).send('Query parameter \'student\' is missing')
        var st = studentsData.byid(studentId)
        if (!st)
            return res.status(404).send('Student is not found')
        if (!st.task)
            return res.status(404).send('No test is associated with the student')
        res.render('task', {
            student: st,
            prop: 'task',
            title: 'Задача',
            backref: '/su',
            suview: true
        })
    })
    su.get('/task2', function(req, res) {
        var studentId = req.query.student
        if (!studentId)
            return res.status(400).send('Query parameter \'student\' is missing')
        var st = studentsData.byid(studentId)
        if (!st)
            return res.status(404).send('Student is not found')
        if (!st.task)
            return res.status(404).send('No test is associated with the student')
        res.render('task', {
            student: st,
            prop: 'task2',
            title: 'Задача 2',
            backref: '/su',
            suview: true
        })
    })
    su.get('/trash', function(req, res) {
       var studentId = req.query.student
       if (!studentId)
           return res.status(400).send('Query parameter \'student\' is missing')
       if (!studentsData.canTrash(studentId))
           return res.status(403).send('Student cannot be moved to trash')
       studentsData.trash(studentId)
       res.redirect('/su')
    })
}
