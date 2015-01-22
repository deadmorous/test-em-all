/*
test-em-all - a tool for online examination of students.
Copyright (C) 2015 Stepan Orlov

This file is part of test-em-all.

Full text of copyright notice can be found in file copyright_notice.txt in the test-em-all root directory.
License agreement can be found in file LICENSE.md in the test-em-all root directory.
*/

var _ = require('lodash')

function Student(options) {
    _.merge(this, _.pick(options || {}, ['firstname', 'lastname', 'group']))
}

Student.prototype.summary = function() {
    var self = this
    if (self.trash)
        return 'запись деактивирована'
    function attrIf(condition, attr) {
        return condition? ' '+attr: ''
    }
    function linkToStudent(path, text, prop) {
        if (self[prop])
        return '<a href="' + path + '?student=' + self.id + '">' + text + '</a>'
    else
        return text
    }
    var result = []
    var sealed = attrIf(self.examFinished, 'disabled')
    var taskSolved = attrIf(self.taskSolved, 'checked')
    var bonus = attrIf(self.hasBonus, 'checked')
    var termTest = attrIf(self.termTest, 'checked')
    var markPut = attrIf(self.markPut, 'checked')
    var examFinished = attrIf(self.examFinished, 'checked')
    var testNotStarted = attrIf(!self.test, 'disabled')
    result.push('<input type="checkbox"' + examFinished + testNotStarted + ' id="' + self.id+'|examFinished"' + '"' + '/> Экзамен закончен')
    result.push('<input type="checkbox"' + markPut + sealed + ' id="' + self.id+'|markPut"' + '"' + '/> Оценка выставлена')
    result.push('<input type="checkbox"' + bonus + sealed + ' id="' + self.id+'|hasBonus"' + '/> ' + linkToStudent('/su/task2', 'Бонус', 'task2'))
    result.push('<input type="checkbox"' + taskSolved + sealed + ' id="' + self.id+'|taskSolved"' + '/> ' + linkToStudent('/su/task', 'Задача', 'task'))
    result.push('<input type="checkbox"' + termTest + sealed + ' id="' + self.id+'|termTest"' + '/> Контрольная')
    var t = self.test
    result.push(t? t.shortSummary(self): 'тест не начат')
    for(var i=0; i<result.length; ++i)
        result[i] = '<span class="stateItem">'+result[i]+'</span>'
    return result.join('')
}

Student.prototype.mark = function() {
    if (this.trash)
        return '-'
    var t = this.test
    if (!(t && (t.finished || t.abandoned)))
        return 'ждём окончания теста'
    if (t.abandoned)
        return '-'
    var mark = 5 - Math.floor(t.errorCount()/2)
    if (mark === 5   &&   !this.termTest   &&   !this.taskSolved)   --mark
    if (!this.taskSolved)   --mark
    if (this.hasBonus)   ++mark
    if (mark > 5)
        mark = 5
    else if (mark<2)
        mark=2
    var markMap = ['неудовлетворительно', 'удовлетворительно', 'хорошо', 'отлично']
    var result = markMap[mark-2]
    if (!this.markPut)
        result = 'пока ' + result
    return result
}

Student.fromJson = function(json, Test) {
    var result = new Student
    _.each(json, function(value, name) {
        if (name === 'test')
            result.test = Test.fromJson(value)
        else
            result[name] = value
    })
    return result
}



function Data() {
    this.list = {}
}

var data = new Data()

Data.prototype.ids = function() {
    return _.keys(this.list)
}
Data.prototype.byid = function(id) {
    return this.list[id]
}
Data.prototype.has = function(id) {
    return this.list.hasOwnProperty(id)
}
Data.prototype.timeTillAllFinish = function() {
    var result = 0
    _.each(this.list, function(student) {
        if (!student.test    ||   student.test.finished   ||   student.test.abandoned)
            return
        var t = student.test.timeleft()
        if (t > 0   &&   result < t)
            result = t
    })
    return result
}

Data.prototype.canTrash = function(id) {
    var st = this.byid(id)
    if (!st)
        return false
    if (st.trash)
        return false
    if (!st.test)
        return true
    if (st.test.finished || st.test.abandoned)
        return false
    return true
}

Data.prototype.trash = function(id) {
    var st = this.byid(id)
    if (!st)
        return
    var n = 1, newId
    while (true) {
        newId = 'trash-' + n
        if (!this.list.hasOwnProperty(newId))
            break
    }
    var t = st.test
    if (t) {
        t.finished = false
        t.abandoned = true
    }
    delete this.list[id]
    st.id = newId
    st.trash = true
    this.list[newId] = st
}

Data.fromJson = function(json, Test) {
    var result = new Data
    _.each(json.list, function(student, id) {
        result.list[id] = Student.fromJson(student, Test)
    })
    return result
}



function setupRoutes(app) {
    app.use(function(req, res, next) {
        req.students = data
        next()
    })
    app.get('/list-students', function(req, res) {
        res.send( JSON.stringify(data.list) )
    })
    
    app.get('/identify', function(req, res) {
        res.render('identify', {message: req.flash('identificationErrorMessage'), identificationData: req.session.identificationData})
    })
    app.post('/identify', function(req, res) {
        if (data.denyIdentification)
            return res.status(403).send('Идентификация в данный момент запрещена')
        var b = req.session.identificationData = req.body
        b = _.pick(b, ['firstname', 'lastname', 'group'])
        var ok = true
        if (!(b.firstname && b.lastname && b.group)) {
            req.flash('identificationErrorMessage', 'Поля "Имя", "Фамилия" и "Номер группы" должны быть заполнены')
            ok = false
        }
        if (b.group && !b.group.match(/\d+\/\d+/)) {
            req.flash('identificationErrorMessage', 'Номер группы должен иметь формат 12345/6')
            ok = false
        }
        if (!ok)
            return res.redirect( '/identify' )
        var student = new Student(b)
        var studentId = JSON.stringify(b).toLowerCase().replace(/"/g,'_')
        if (data.has(studentId)) {
            req.flash('identificationErrorMessage', 'Этот студент уже зарегистрирован')
            return res.redirect( '/identify' )
        }
        student.id = studentId
        data.list[studentId] = student
        data.unsaved = true
        req.session.studentId = studentId
        res.redirect('/test/start')
    })
    app.get('/exit', function(req, res) {
        if (!req.session.studentId)
            return res.redirect('/')
        if (req.query.sure === 'yes') {
            var st = data.byid(req.session.studentId)
            if (st && st.test && !st.test.finished && !st.test.abandoned) {
                st.test.abandoned = true
                data.unsaved = true
            }
            delete req.session.studentId
            return res.redirect('/')
        }
        res.render('exit', { student: data.byid(req.session.studentId) })
    })
}
setupRoutes.data = data
setupRoutes.student = function(req) {
    return data.byid(req.session.studentId)
}
setupRoutes.Data = Data

module.exports = setupRoutes
