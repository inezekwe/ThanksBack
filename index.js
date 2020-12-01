const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const promise = require('bluebird');
const session = require('express-session');
const portNumber = process.env.PORT || 4000;
const cors = require('cors');
const fileUpload = require('express-fileupload');
const { response } = require('express');

app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}))

// enable files upload
app.use(fileUpload({
    createParentPath: true
}));

//salt rounds for bcrypt
const saltRounds = 10;


// Database connection parameters:
const config = {
    host: 'localhost',
    port: 5432,
    database: 'thanks',
    user: 'thanks',
    password: 'thankyou'
};

// pg-promise initialization options:
const initOptions = {
    // Use a custom promise library, instead of the default ES6 Promise:
    promiseLib: promise,
};

// Load and initialize pg-promise:
const pgp = require('pg-promise')(initOptions);

// Create the database instance
const db = pgp(config);

//loads environment variables from a '.env' file into process.env
require('dotenv').config();

//session management....leave commented out until middleware implementation
app.use(session({
    secret: process.env.SECRET_KEY,
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge: 720000
    }
}))

app.use(express.urlencoded({
    extended: true
}));
app.use(express.json());


// ---------------- Beginning of Routes --------------------- //
// ---------------------------------------------------------- //

//upload pictures, documents, etc.
app.post("/documents", async (req, res) => {
    try {
      if(!req.files){
        res.send({
          status: false,
          message: "No files"
        })
      } else {
        //assign object of image uploaded to 'picture' variable before moving it to 'uploads' folder
        const file = req.files[''];
        file.mv("./uploads/" + file.name)
  
        res.send({
          status: true,
          message: "File is uploaded"
        })
      }
    } catch (error) {
      res.status(500).send(error)
    }
  })

// ---------------------------------------------------- //

//get items from gratitudes table
app.post('/api/saved_gratitudes', (req, res) => {
    db.query(`SELECT id, isdeleted, title, entry, date_of_entry
              FROM gratitudes
              WHERE userid=${req.body.id}`)
            .then((response) => {
                //console.log(req.session);
                res.send(response)
            })
            .catch((error) => {
                res.send(`${error}, could not get data from gratitudes table`)
            })
})

// ---------------------------------------------------- //

//insert entry into gratitudes table
app.post('/api/gratitude', (req, res) => {
    db.query(`INSERT INTO gratitudes (entry, title, userid)
                VALUES ('${req.body.entry}', '${req.body.title}', '${req.body.id}')`)
})

//no association with a user session is in place now. in order for that to happen it would need to be something like the following where 'req.session.user[0].id' is referenced.

// app.post('/api/gratitude', (req, res) => {
//     db.query(`INSERT INTO gratitudes (entry, title, userid)
//                 VALUES ('${req.body.entry}', '${req.body.title}', '${req.session.user[0].id}')`)
// })


// ---------------------------------------------------- //

//insert saved quotes into quotes table
app.post('/api/quotes', (req, res) => {
    db.query(`INSERT INTO quotes (author, quote, userid)
            VALUES ('${req.body.author}', '${req.body.quote}', ${req.body.id} )`)
            .then(response => {
                res.send(response);
            })
            .catch(err => {
                console.log(err);
                res.send(err);
            })
})

//get saved quotes from quotes table according to user id
app.post('/api/saved_quotes', (req, res) => {
    db.query(`SELECT id, isdeleted, author, quote, date_of_entry FROM quotes WHERE userid=${req.body.id}`)
        .then(response => {
            res.json({message: "OK", results: response});
        })
        .catch(err => {
            res.send(err);
        })
})

//remove saved quote from table according to user id
app.post('/api/remove_quote', (req, res) => {
    db.query(`UPDATE quotes SET isdeleted=true WHERE id=${req.body.id} AND userid = ${req.body.userid}`)
        .then(response => {
            res.json(response);
        })
        .catch(err => {
            res.send(err);
        })
})


// ---------------- Routes for Authentication ---------------- //
// ---------------------------------------------------------- //

// check if user is already authenticated and has a session
app.get('/api/checkuser', authenticatedMiddleware, (req, res) => {
    res.send("yah, you good to go");
})

// ---------------------------------------------------- //

// register a user
app.post('/register', (req, res) => {
    if (!req.body.email) {
        res.status(404).send("Email is required");
    }
    if (!req.body.password) {
        res.status(404).send("Password is required");
    } 
    if (!req.body.name) {
        res.status(404).send("Name is required");
    } else {
        let email = req.body.email;
        let password = req.body.password;
        let name = req.body.name

        bcrypt.hash(password, saltRounds, function (err, hash) {
            // Store hash in your password DB.
            passHash = hash;

            db.query(`INSERT INTO users ("password", "email", "name") VALUES('${passHash}', '${email}', '${name}')`)
            console.log("You've been registered...");
            res.send("OK");

        });
    }
})

// ---------------------------------------------------- //

// login for user
app.post('/login', (req, res) => {
    //console.log(req);
    if (!req.body.email) {
        res.status(404).send("Email is required");
    }
    if (!req.body.password) {
        res.status(404).send("Password is required");
    }

    db.query(`SELECT * FROM users WHERE email = '${req.body.email}'`)
        .then((results) => {
            bcrypt.compare(req.body.password, results[0].password, function (err, result) {
                if (result === true) {
                    // assign results from db.query above to a session
                    req.session.user = results;
                    res.json({message: "OK", response: results});
                } else {
                    res.send("Invalid Credentials");
                }
            })
        })
        .catch((err) => {
            console.log(`Error while logging in...${err}`);
        })
})


// ---------------- Functions ---------------- //

// Middleware to check if user has session
function authenticatedMiddleware(req, res, next) {
    // if user is authenticated let request pass
    if (req.session.user) {
        next();
    } else { // user is not authenticated send them to login
        console.log('Middleware check...user not authenticated');
        
    }
}


app.listen(portNumber, function () {
    console.log(`My API is listening on port ${portNumber}...`);
});