var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');
var jwt = require('jsonwebtoken');
const jwtSecret = 'akjdhkljdh2329';
const imageDownloader = require('image-downloader');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const mongoose = require('mongoose');
const User = require('./models/user.js');
const Place = require('./models/place.js');
const fs = require('fs');
const multer = require('multer');


require('dotenv').config();

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(__dirname + '/uploads'));

app.use(
    cors({
        origin: 'http://localhost:3000',
        credentials: true,
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        preflightContinue: true,
        optionsSuccessStatus: 200
    })
);
app.use('/', indexRouter);
app.use('/users', usersRouter);

// passatlas:AirbnbBook

const bcrypt = require('bcryptjs');
const { log } = require('console');
const Booking = require('./models/bookings');
const bcryptSalt = bcrypt.genSaltSync(10);

function getUserDataFromReq(req) {
    const { token } = req.body;
    return new Promise((resolve, reject) => {
        jwt.verify(token, jwtSecret, {}, async (err, userData) => {
            if (err) throw err;
            resolve(userData);
        });
    });
}

app.get('/test', (req, res) => {
    res.json('test ok');
});

app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const userDoc = await User.create({
            name,
            email,
            password: bcrypt.hashSync(password, bcryptSalt),
        });
        res.json(userDoc);
    } catch (error) {
        res.status(422).json(error);
    }
});
app.post('/upload-by-link', async (req, res) => {
    const { link } = req.body;
    const newName = 'photo' + Date.now() + '.jpg';
    await imageDownloader.image({
        url: link,
        dest: __dirname + '/uploads/' + newName,
    });
    res.json(newName)
});

const photosMiddleware = multer({ dest: 'uploads' });

app.post('/upload', photosMiddleware.array('photos', 100), (req, res) => {
    const uploadedFiles = [];
    for (let i = 0; i < req.files.length; i++) {
        const { path, originalname } = req.files[i];
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        const newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
        uploadedFiles.push(newPath.replace('uploads\\', ''));
    }
    res.json(uploadedFiles);
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const userDoc = await User.findOne({ email });
    if (userDoc) {
        const passTrue = bcrypt.compareSync(password, userDoc.password);
        if (passTrue) {
            jwt.sign(
                { email: userDoc.email, id: userDoc._id, name: userDoc.name },
                jwtSecret,
                {},
                (err, token) => {
                    if (err) throw err;
                    else {
                        res.json({ userDoc, token });
                    }
                }
            );
        } else {
            res.status(422).json('password not ok');
        }
    } else {
        res.json('not found');
    }
});

app.post('/profile', async (req, res) => {
    const { token } = await req.body;
    if (token) {
        jwt.verify(token, jwtSecret, {}, async (err, userData) => {
            if (err) throw err;
            console.log(userData);
            const { name, email, _id } = await User.findById(userData.id)
            res.json({ name, email, _id });
        });
    } else {
        res.json(null);
    }
});

app.post('/places', (req, res) => {
    const {
        token, price, title, address, addedPhotos, description, perks, extraInfo, checkIn, checkOut, maxGuests
    } = req.body;

    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if (err) throw err;
        const placeDoc = await Place.create({
            owner: userData.id,
            title, address, photos: addedPhotos, description, perks, extraInfo, checkIn, checkOut, maxGuests, price
        });
        res.json(placeDoc);
    });
});

app.post('/user-placesList', (req, res) => {
    const { token } = req.body;
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        const { id } = userData;
        res.json(await Place.find({ owner: id }));
    });
});

app.get('/places/:id', async (req, res) => {
    const { id } = req.params;
    res.json(await Place.findById(id));
});

app.put('/places', async (req, res) => {
    const {
        token, id, title, address, addedPhotos, description, perks, extraInfo, checkIn, checkOut, maxGuests, price
    } = req.body;

    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if (err) throw err;
        const placeDoc = await Place.findById(id);
        if (userData.id === placeDoc.owner.toString()) {
            placeDoc.set({
                title, address, photos: addedPhotos, description, perks, extraInfo, checkIn, checkOut, maxGuests, price
            })
            await placeDoc.save();
            res.json('updated');
        }
    });
});

app.get('/places', async (req, res) => {
    res.json(await Place.find());
});

app.post('/bookings', async (req, res) => {
    const userData = await getUserDataFromReq(req);
    const {
        place, checkIn, checkOut, numberOfGuests, name, phone, price
    } = req.body;

    Booking.create({
        place, checkIn, checkOut, numberOfGuests, name, phone, price,
        user: userData.id
    }).then((doc) => {
        res.json(doc);
    }).catch((err) => {
        if (err) throw err;
    })
});



app.post('/bookingsList', async (req, res) => {
    const userData = await getUserDataFromReq(req);
    res.json(await Booking.find({ user: userData.id }).populate('place'))
})

module.exports = app;
