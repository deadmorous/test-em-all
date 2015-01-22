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
    _ = require('lodash')

// Found at http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

function Answer(options) {
    options = options || {}
    this.text = options.text
    this.correct = options.correct || false
}

Answer.clone = function(arg) {
    return new Answer(arg)
}

Answer.prototype.isCorrect = function() {
    if (typeof this.correct !== 'boolean')
        throw new Error('Answer is not defined properly')
    return this.correct? this.studentsAnswer === true:   !this.studentsAnswer
    }

Answer.prototype.isProcessed = function() {
    return typeof this.studentsAnswer === 'boolean'
}

Answer.prototype.toString = function() {
    var s = ''
    if (this.correct)
        s += '+'
    s += this.text
    return s
}

Answer.fromJson = function(json) {
    var result = new Answer
    _.merge(result, json)
    return result
}



function Question(options) {
    options = options || {}
    this.text = options.text
    this.answers = options.answers || []
    this.multipleAnswers = options.multipleAnswers || false
    this.keepAnswersOrder = options.keepAnswersOrder
    this.person = options.person
}

Question.clone = function(arg) {
    var options = {
        text: arg.text,
        answers: [],
        multipleAnswers: arg.multipleAnswers,
        keepAnswersOrder: arg.keepAnswersOrder,
        person: arg.person
    }
    _.each(arg.answers, function(a) {
        options.answers.push(Answer.clone(a))
    })
    return new Question(options)
}

Question.prototype.isProcessed = function() {
    for (var i=0, n=this.answers.length; i<n; ++i)
        if (!this.answers[i].isProcessed())
            return false
    return true
}

Question.prototype.isCorrect = function() {
    if (!(this.answers && this.answers.length > 0))
        throw new Error('Question is not defined properly')
    for (var i=0, n=this.answers.length; i<n; ++i)
        if (!this.answers[i].isCorrect())
            return false
    return true
}

Question.prototype.toString = function() {
    var s = ''
    s += '['
    if (this.multipleAnswers)
        s += '!'
    if (this.keepAnswersOrder)
        s += 'o'
    s += '] '
    s += this.text
    return s + '\n' + this.answers.join('\n')
}

Question.fromJson = function(json) {
    var result = new Question
    _.each(json, function(value, name) {
        if (name === 'answers') {
            result.answers = []
            for (var i=0; i<value.length; ++i)
                result.answers.push(Answer.fromJson(value[i]))
        }
        else
            result[name] = value
    })
    return result
}



var questions = [], personalQuestions = {}

function newTestQuestions(person) {
    // Clone questions
    var q = []
    _.each(questions, function(question) {
        q.push(Question.clone(question))
    })

    // Select questions for new test
    var N = 20
    if (q.length < N)
        throw new Error('Too few questions')
    shuffle(q)
    if (person && personalQuestions[person]) {
        var idx = 1 + Math.floor(Math.random() * (N-2))
        q.splice(idx, 0, personalQuestions[person])
        ++N
    }
    q.splice(N, q.length-N)

    // Shuffle answers in each question if not asked to keep order
    _.each(q, function(question) {
        if (!question.keepAnswersOrder)
            shuffle(question.answers)
    })
    return q
}

function readQuestions(fileName) {
    var lines = fs.readFileSync(path.join(__dirname, fileName), {encoding: 'utf8'}).split('\n')
    var qoptions
    var correctAnswerCount = 0
    function generateQuestion() {
        if (qoptions) {
            if (!qoptions.skipQuestion) {
                var q = new Question(qoptions)
                if (correctAnswerCount != 1   &&   !q.multipleAnswers)
                    throw new Error('Invalid question:\n' + q)
                if(qoptions.person)
                    personalQuestions[qoptions.person] = q
                else
                    questions.push( q )
            }
            qoptions = undefined
            correctAnswerCount = 0
        }
    }
    _.each(lines, function(line) {
        // console.log(line)
        line = line.trim()
        if (line) {
            if (qoptions) {
                // Add answer
                var correct = false
                if (line[0] == '+') {
                    correct = true
                    ++correctAnswerCount
                    line = line.substr(1).trim()
                }
                qoptions.answers.push(new Answer({text: line, correct: correct}))
            }
            else {
                // Add question
                qoptions = {}
                qoptions.multipleAnswers = false
                var m = line.match(/^(.*)\[(.+)\]$/)
                if (m) {
                    line = m[1].trim()
                    qoptions.person = m[2].toLowerCase()
                }

                m = line.match(/^\[([!ox]+)\]/)
                var qoptmap = { '!': 'multipleAnswers', o: 'keepAnswersOrder', x: 'skipQuestion' }
                if (m) {
                    _.each(m[1], function(c) {
                        qoptions[qoptmap[c]] = true
                    })
                    line = line.substr(m[1].length+2).trim()
                }
                qoptions.text = line
                qoptions.answers = []
            }
        }
        else
            // Add new question
            generateQuestion()
    })
    generateQuestion()
}

readQuestions('test-data.txt')
readQuestions('test-data-personal.txt')


function formatMsecSpan(ms) {
    var seconds = ms / 1000
    var minutes = Math.floor(seconds/60)
    seconds -= minutes*60
    seconds = Math.floor(seconds).toString()
    if (seconds.length === 1)
        seconds = '0' + seconds
    return minutes + ':' + seconds
}



function Test(st) {
    if (arguments.length == 0)
        return
    this.startTime = Date.now()
    this.questions = newTestQuestions(st.lastname.toLowerCase())
    this.finished = false
}

Test.Duration = 15*60*1000;

Test.prototype.errorCount = function() {
    var n = 0
    _.each(this.questions, function(question) {
        if (question.person)
            return
        if (!question.isCorrect())
            ++n
    })
    return n
}

Test.prototype.timeleft = function() {
    var t = Test.Duration - (Date.now() - this.startTime)
    return t >= 0 ?   t:   0
}

Test.prototype.status = function(student) {
    function linkToTest() {
    if (student)
        return '<a href="/su/test?student=' + student.id + '">тест</a>'
    else
        return 'тест'
    }

    if (this.finished)
        return { id: 'finished', text: linkToTest() + ' сдан' }
    if (this.abandoned)
        return { id: 'abandoned', text: 'тест отклонён' }
    var t = this.timeleft()
    if (t > 0)
        return { id: 'running', text: 'тест не завершен' }
    else
        return { id: 'waiting', text: linkToTest() + ' завершен, но не сдан' }
}

Test.prototype.shortSummary = function(student) {
    var status = this.status(student)
    var msg = [status.text]
    switch (status.id) {
    case 'finished':
        msg.push('ошибок: ' + this.errorCount())
        break
    case 'abandoned':
        break
    case 'running':
        msg.push('осталось ' + formatMsecSpan(this.timeleft()))
        break
    case 'waiting':
        msg.push('ждём')
        break
    }
    if (this.endTime)
        msg.push('длился ' + formatMsecSpan(this.endTime-this.startTime))
    return msg.join(', ')
}

Test.prototype.summary = function() {
    var n = this.errorCount()
    switch (n) {
        case 0:
            return 'У Вас нет ошибок в тесте! Решите <a href="/task">задачу</a>, чтобы получить отличную оценку.'
        case 1:
            return 'У Вас всего одна ошибка в тесте. Решите <a href="/task">задачу</a>, чтобы получить отличную оценку.'
        case 2:   case 3:
            return 'У Вас ' + n + ' ошибки в тесте. Решите <a href="/task">задачу</a>, чтобы получить оценку "хорошо". Или троечку и можно идти домой.'
        case 4:   case 5:
            return 'У Вас ' + n + ' ошибок в тесте. Решите <a href="/task">задачу</a>, чтобы получить оценку "удовлетворительно".'
        case 6:   case 7:
            return 'У Вас ' + n + ' ошибок в тесте. Решите <a href="/task">две задачи</a>, чтобы получить оценку "удовлетворительно".'
        default:
            return 'У Вас ' + n + ' ошибок в тесте. Приходите как-нибудь в другой раз.'
    }
}

Test.fromJson = function(json) {
    var result = new Test
    _.each(json, function(value, name) {
        if (name === 'questions') {
            result.questions = []
            for (var i=0; i<value.length; ++i)
                result.questions.push(Question.fromJson(value[i]))
        }
        else
            result[name] = value
    })
    return result
}


function timeleft(st) {
    return st.test.timeleft()
}



function setupRoutes(app) {
    var test = express.Router()
    app.use('/test', test)
    test.use(function(req, res, next) {
        if (req.session.studentId && student(req))
            return next()
        res.redirect('/identify')
    })
    test.get('/start', function(req, res) {
        res.render('start-test', {req: req, student: student(req)})
    })
    test.get('/', function(req, res) {
        var st = student(req)
        if (!st.test)
            // Start the test
            st.test = new Test(st)
        if (req.query.qidx === undefined   ||   !st.test.questions[req.query.qidx] instanceof Question)
            return res.redirect('/test?qidx=0')
        var timeTillAllFinish = studentsData.timeTillAllFinish()
        res.render('test', {
            req: req,
            student: student(req),
            allFinished: timeTillAllFinish === 0,
            timeTillAllFinish: timeTillAllFinish,
            timeTillAllFinishFmt: formatMsecSpan(timeTillAllFinish),
            summary: timeTillAllFinish === 0   &&   st.test.finished ?   st.test.summary() :   undefined,
            backref: ''
        })
    })
    test.post('/update', function(req, res) {
        var st = student(req)
        if (!st.test)
            return res.status(400).send('Тест не начат')
        var d = JSON.parse(req.body.data)
        if (!st.test.questions.hasOwnProperty(d.qidx))
            return res.status(400).send('Неправильный номер вопроса')
        var question = st.test.questions[d.qidx]
        if (!((d.answers instanceof Array) && d.answers.length === question.answers.length))
            return res.status(400).send('Неправильный размер массива ответов')
        if (st.test.finished)
            return res.status(400).send('Тест уже сдан')
        if (st.test.abandoned)
            return res.status(400).send('Тест отклонён')
        if (timeleft(st) <= 0)
            return res.status(400).send('Время теста истекло. Сдавайтесь!')
        _.each(d.answers, function(value, index) {
            question.answers[index].studentsAnswer = value === true
        })
        studentsData.unsaved = true
        res.sendStatus(200)
    })
    test.get('/finish', function(req, res) {
        var st = student(req)
        if (!st.test)
            return res.status(400).send('Тест не начат')
        if (st.test.finished)
            return res.status(400).send('Тест уже сдан')
        if (st.test.abandoned)
            return res.status(400).send('Тест отклонён')
        if (req.query.sure === 'yes') {
            st.test.finished = true
            st.test.endTime = Date.now()
            studentsData.unsaved = true
            res.redirect('/test')
        }
        else if (st.test.finished)
            res.redirect('/test')
        else
            res.render('finish-test', {req: req, student: student(req), timeleft: timeleft(st) > 0, _: _})
    })
    test.get('/abandon', function(req, res) {
        var st = student(req)
        if (!st.test)
            return res.status(400).send('Тест не начат')
        if (st.test.finished)
            return res.status(400).send('Тест уже сдан')
        if (timeleft(st) > 0)
            return res.status(400).send('Еще есть время подумать!')
        st.test.abandoned = true
        st.test.endTime = Date.now()
        studentsData.unsaved = true
        res.send('До новых встреч!')
    })
    test.get('/timeleft', function(req, res) {
        var st = student(req)
        if (!st.test)
            return res.status(400).send('Тест не начат')
        if (st.test.finished)
            return res.status(400).send('Тест уже сдан')
        if (st.test.abandoned)
            return res.status(400).send('Тест отклонён')
        var t = timeleft(st)
        if (t <= 0)
            return res.send('Время истекло')
        res.send(formatMsecSpan(t))
    })
    test.get('/timeTillAllFinish', function(req, res) {
        var timeTillAllFinish = studentsData.timeTillAllFinish()
        res.send(timeTillAllFinish > 0? formatMsecSpan(timeTillAllFinish): '')
    })
}
setupRoutes.Test = Test
setupRoutes.Question = Question

module.exports = setupRoutes
