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
    _ = require('lodash')


function Task(options) {
    _.merge(this, _.pick(options || {}, ['text']))
}

var tasks = []

function readTasks(fileName) {
    var lines = fs.readFileSync(path.join(__dirname, fileName), {encoding: 'utf8'}).split('\n')
    var taskLines = []
    function addTask() {
        if (taskLines.length == 0)
            return
        tasks.push(new Task({text: taskLines.join('\n')}))
        taskLines = []
    }
    _.each(lines, function(line) {
        line = line.trim()
        if (line) {
            while (true) {
                var m = line.match(/^([^\$]*)(\$.*[<>].*\$)(.*$)/)
                if (!m)
                    break
                var formula = m[2]
                formula = formula
                    .replace(/\</g, '\\lt ')
                    .replace(/\>/g, '\\gt ')
                line = m[1] + formula + m[3]
            }
            taskLines.push(line)
        }
        else
            addTask()
    })
    addTask()
}

readTasks('task-data.txt')

var tasksLeft = tasks.length

function newTask() {
    if (tasksLeft == 0)
        tasksLeft = tasks.length
    var i = Math.floor(Math.random() * tasksLeft)
    --tasksLeft

    var tmp = tasks[i]
    tasks[i] = tasks[tasksLeft]
    tasks[tasksLeft] = tmp
    return tmp
}

function setupRoutes(app) {
    var task = express.Router()
    app.use('/task', task)
    task.get('/example', function(req, res) {
        res.render('task-example', { tasks: tasks })
    })
    task.use(function(req, res, next) {
        if (req.session.studentId && student(req))
            return next()
        res.redirect('/identify')
    })
    task.get('/', function(req, res) {
        var st = student(req)
        if (!st.task)
            // Assign new task
            st.task = newTask()
        res.render('task', {
            student: st,
            prop: 'task',
            title: 'Задача',
            backref: '',
            bonusref: st.taskSolved? '/task/2': undefined
        })
    })
    task.get('/2', function(req, res) {
        var st = student(req)
        if (!st.taskSolved)
            return res.status(403).send('Сначала решите первую задачу')
        if (!st.task2)
            // Assign new task
            st.task2 = newTask()
        res.render('task', {
            student: st,
            prop: 'task2',
            title: 'Задача 2',
            backref: '',
            bonusref: undefined
        })
    })
}

module.exports = setupRoutes
