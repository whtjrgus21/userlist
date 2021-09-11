const express = require('express');                  // express 서버
const http = require('http');
const fs = require('fs');
const session = require('express-session');          // express 서버 세션
const MySQLStore = require('express-mysql-session')(session);  

// html에 있는 값을 받아오기 위해 사용 - 회원 가입 및 로그인
const bodyParser = require('body-parser');          // body-parser

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

// 회원 비밀번호 암호화
//const bcrypt = require('bcrypt-nodejs');

const bkfd2Password = require("pbkdf2-password");
const hasher = bkfd2Password();

// aws
const config = require('./dev');

const mysql = require('mysql');     // mysql 연동
const { response } = require('express');
const con = mysql.createConnection({
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database
});
con.connect((err) => {    //  mysql에 연결
  if (err) throw err;     // 만약 err가 있으면 에러를 콘솔창에 출력
  console.log('Mysql Connected!!'); // mysql과 연결이 되면 console에 출력
});

const app = express();

//////////////////////////////////// port ////////////////////////////////
const port = 5500;
const server = http.createServer(app);
//app.listen(port, () => console.log(`listening on ${port}!!`));

const io = require('socket.io')(server);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({   // 세션 
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
  store: new MySQLStore({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database
  })
}));

///////////////////////////////// page 관련 /////////////////////////////////
app.set('views', __dirname + '/client/views/');
// html을 ejs로 변환
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

// express에서 css 적용
app.use('/auth/css', express.static(__dirname + '/client/views/login/css/'));
app.use('/css', express.static(__dirname + '/client/views/main/css/'));
app.use('/auth/css', express.static(__dirname + '/client/views/register/css/'));
app.use('/css', express.static(__dirname + '/client/views/userlist/css'));
app.use('/css', express.static(__dirname + '/client/views/chat/css'));

// js 적용
app.use('/auth/js', express.static(__dirname + '/client/views/login/js'));
app.use('/js', express.static(__dirname + '/client/views/main/js'));
app.use('/auth/js', express.static(__dirname + '/client/views/register/js'));
app.use('/js', express.static(__dirname + '/client/views/chat/js'));

// app.use(express.static('./client/views/chat'));

///////////////////////////////// passport 설정 /////////////////////////////////
app.use(passport.initialize());
app.use(passport.session());

///////////////////////////////// logout /////////////////////////////////
app.get("/auth/logout", (req, res) => {
  req.logout();
  req.session.save(() => {
    res.redirect("/auth/login");
  });
});

app.get("/welcome", function (req, res) {
  if (req.user && req.user.displayName) {
    res.render('main/index.html', { displayName: req.user.displayName});
  } else {
    res.redirect('/auth/login')
  }
});
///////////////////////////////// landing page /////////////////////////////////
app.get('/', (req, res) => {
  if (req.user && req.user.displayName) {
    res.render('main/index.html',{displayName: req.user.displayName});
  } else {
    res.redirect('/auth/login');
  }
});

///////////////////////////////// passport 설정 /////////////////////////////////
passport.serializeUser(function (user, done) {
  console.log("serializeUser", user);
  done(null, user.authId);
});

passport.deserializeUser(function (id, done) {
  console.log("deserializeUser", id);
  const sql = "SELECT * FROM users WHERE authId=?";
  con.query(sql, [id], function (err, results) {
    if (err) {
      console.log(err);
      done("There is no user.");
    } else {
      done(null, results[0]);
    }
  });
});

passport.use(
  new LocalStrategy(function (username, password, done) {
    const uname = username;
    const pwd = password;
    const sql = "SELECT * FROM users WHERE authId=?";
    con.query(
      sql,
      ["local:" + uname],
      function (err, results) {
        if (err) {
          return done("There is no user.");
        }
        const user = results[0];
        return hasher(
          { password: pwd, salt: user.salt },
          function (err, pass, salt, hash) {
            if (hash === user.password) {
              console.log("LocalStrategy", user);
              done(null, user);
            } else {
              done(null, false);
            }
          }
        );
      }
    );
  })
);

//////////////////////////////////////// 로그인 /////////////////////////////////////////

app.post("/auth/login", passport.authenticate("local", {
    successRedirect: "/welcome",
    failureRedirect: "/auth/login",
    failureFlash: false,
  })
);

//////////////////////////////////////// 회원 가입 /////////////////////////////////////////

app.post('/auth/register', (req, res) => {
  hasher(
    { password: req.body.password },
    function (err, pass, salt, hash) {
      const user = {
        authId: "local:" + req.body.username,
        username: req.body.username,
        password: hash,
        salt: salt,
        displayName: req.body.displayName,
        email: req.body.email
      };
      const sql = "INSERT INTO users SET ?";
      con.query(
        sql,
        user,
        function (err, results) {
          if (err) {
            console.log(err);
            res.status(500);
          } else {
            req.login(user, function (err) {
              req.session.save(function () {
                res.redirect("/welcome");
              });
            });
          }
        }
      );
    }
  );
});

app.get('/auth/login', (req, res) => {
  console.log('로그인 페이지로 이동합니다.');
  res.render('login/index.html');
});

app.get('/auth/register', (req, res) => {
  console.log('회원 가입 페이지에 접속합니다.');
  res.render('register/index.html');
});

app.get('/userlist', (req, res) => {
  console.log('유저리스트로 이동합니다.');
  res.render('userlist/index.html', {displayName: req.user.displayName, email: req.user.email});
});

////////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////
app.get('/chat', (req, res) => {
  // fs.readFile('./client/views/chat/index.html', (err, data) => {
  //   if (err) {
  //     res.send(err)
  //   } else {
  //     res.writeHead(200, {'content-Type':'text/html'});
  //     res.write(data);
  //     res.end();
  //   }
  // });
  const user = {
    displayName: req.body.displayName
  };
  
  res.render('chat/index.html', { displayName: req.user.displayName});

  let socketConnected = new Set();

  io.on('connection', onConnected);

  function onConnected(socket, user) {
    // console.log(socket.id);

    socketConnected.add(user);

    // 현재 접속자 수
    io.emit('clients-total', socketConnected.size);

    // 연결이 안 되어 있을 경우
    socket.on('disconnect', () => {
      console.log('Socket disconnected', user);
      socketConnected.delete(user);
      io.emit('clients-total', socketConnected.size);
    });

    // 메세지를 보내면 전송
    socket.on('message', (data) => {
      console.log(data);
      socket.broadcast.emit('chat-message', data);
    });
  }
});

app.use('/css', express.static('./client/views/chat/css'));
app.use('/js', express.static('./client/views/chat/js'));



server.listen(port, () => {
  console.log(`listening on ${port}!!`);
})