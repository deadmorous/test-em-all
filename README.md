# test-em-all

## About

test-em-all is a tool a tool for online examination of students.

It is a Web server written in node.js

## Usage

The tool is supposed to be used in classes, where each student identifies himself or herself to the server (when going to server root path ```/``` in a browser),
and the examinator is able to identify student as well. When a student identifies himself or herself to the server, the server offers a test consisting of 20
questions that have to be answered in 15 minutes.

Then, a task is offered. When the task is solved, student can take another task (no more than two tasks in total).

Each student is able to pass the examination only once (under the same idendification data) during one server run.

Examinator (supervisor) can view examinator's page at /su, and should enter a password to access that page. The page shows which students have identified themselves, and the
results of passing the test for each student.
Examinator can check three boxes for each student. These checks influence student's mark.
Current state can be saved to a file, or read from a file.

Test questions with correct answers should be in file ```test-data.txt``` (see ```test-data-example.txt```)

Tasks should be in file ```task-data.txt``` (see ```task-data-example.txt```). They can use LaTeX formulas.

## Installation

* Install node.js and npm
* ```npm install```
* [Download MathJax](http://mathjax.readthedocs.org/en/latest/installation.html) (I used version 2.4),
  unzip, and put into the ```public/``` dubdir, so that the file ```MathJax.js``` has the path ```public/MathJax/MathJax.js```

## Starting server
* ```[PORT=1234] node test-em-all.js```

