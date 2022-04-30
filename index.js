const express = require('express')
const app = express()
const cors = require('cors');
const admin = require("firebase-admin");
require('dotenv').config();
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const fileUpload = require('express-fileupload');

const port = process.env.PORT || 5000;

// const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const serviceAccount = require('./doctors-portal-firebase-adminsdk.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


// This is your test secret API key.
// const stripe = require("stripe")(process.env.STRIPE_SECRET);
const stripe = require("stripe")('sk_test_51Kpnq6JmlJsO1Fghx0h2arbM1R3qVwyK6PRvAy70eIGs2csbSezBlTp5HCxtAHohr3Hs8H93y0vRL7M8YGMsjDtU005MmTU11E');


//middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.swu9d.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zwiso.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }

    }
    next();
}

async function run() {
    try {

        await client.connect();
        const database = client.db('doctors_portal');
        const appointmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users');
        const doctorsCollection = database.collection('doctors');

        app.get('/appointments', verifyToken, async (req, res) => {
            //http://localhost:5000/appointments?email=sondachtg@gmail.com&date=4/20/2022
            const requester = req.decodedEmail;
            const email = req.query.email;
            const date = req.query.date;
            if (requester === email) {
                const query = { email: email, date: date }
                const cursor = appointmentsCollection.find(query);
                const appointments = await cursor.toArray();
                res.json(appointments);
            }
            else {
                res.status(403).json({ message: 'you do not have access to view others appointment' })
            }
            // const query = { email: email, date: date }
            // const cursor = appointmentsCollection.find(query);
            // const appointments = await cursor.toArray();
            // res.json(appointments);
        })

        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment);
            res.json(result)
        });

        app.put('/appointment/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    payment: payment
                }
            };
            const result = await appointmentsCollection.updateOne(filter, updateDoc);
            res.json(result);
        })


        app.get('/appointment/:id', async (req, res) => {
            const Id = req.params.id;
            console.log('appointment id : ', Id);
            //res.json({ id: Id });
            const query = { _id: ObjectId(Id) };
            const appointment = await appointmentsCollection.findOne(query);
            res.json(appointment);
        })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log('post /users ', user)
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        });

        app.put('/users', async (req, res) => {
            const user = req.body;
            console.log('put /users ', user)
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });

        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make admin' })
            }
        });


        // doctors api
        app.get('/doctors', async (req, res) => {
            const cursor = doctorsCollection.find({});
            const doctors = await cursor.toArray();
            res.json(doctors);
        });

        app.post('/doctors', async (req, res) => {
            const name = req.body.name;
            const email = req.body.email;
            const pic = req.files.image;
            const picData = pic.data;
            const encodedPic = picData.toString('base64');
            const imageBuffer = Buffer.from(encodedPic, 'base64');
            const doctor = {
                name,
                email,
                image: imageBuffer
            }
            const result = await doctorsCollection.insertOne(doctor);
            res.json(result);
        })



        app.post("/create-payment-intent", async (req, res) => {
            const paymentInfo = req.body;
            console.log('cpi ', paymentInfo);
            const amount = paymentInfo.price * 100;
            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.json({
                clientSecret: paymentIntent.client_secret,
            });
        });
    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello Doctors portal!')
})

app.listen(port, () => {
    console.log(`listening at ${port}`)
})

// app.get('/users')
// app.post('/users')
// app.get('/users/:id')
// app.put('/users/:id');
// app.delete('/users/:id')
// users: get
// users: post
