const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const app = express();

const port = process.env.PORT || 8000;

// CORS options
const corsOption = {
  origin: ['http://localhost:5173', 'https://work-finder-server-site-3uwf5c7wx-moniruzzaman-lelins-projects.vercel.app'],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOption));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0f5vnoo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect to MongoDB (Optional starting in v4.7)
    await client.connect();

    const jobCollection = client.db('workFinder').collection('jobs');
    const bidsCollection = client.db('workFinder').collection('bids');

    // Routes definitions
    app.get('/jobs', async (req, res) => {
      const result = await jobCollection.find().toArray();
      res.send(result);
    });
//Generating jwt web tokens
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.S_Key, { expiresIn: '365d' });

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === "production" ? "none" : 'strict'
      }).send({ success: true });
    });
///Logout jwt 
app.get('/logout', (req, res)=>{
  res.clearCookie('token',  {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === "production" ? "none" : 'strict',
    maxAge: 0,
  }).send({ success: true });
})
///clear token on LogOut jwt
app.get('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === "production" ? "none" : 'strict',
    maxAge: 0
  }).send({ success: true });
});

// Job by ID
app.get('/job/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await jobCollection.findOne(query);
  res.send(result);
});

    // Add a bid
    app.post('/bid', async (req, res) => {
      const data = req.body;
      console.log(data, 'bid data');
      const result = await bidsCollection.insertOne(data);
      res.send(result);
    });

    // Add a job
    app.post('/add-job', async (req, res) => {
      const postJob = req.body;
      console.log(postJob, 'is here');
      const result = await jobCollection.insertOne(postJob);
      res.send(result);
    });

    // My posted jobs list
    app.get('/jobs/:email', async (req, res) => {
      const email = req.params.email;
      const query = { 'buyer.email': email };
      const result = await jobCollection.find(query).toArray();
      res.send(result);
    });

    // Delete a job post
    app.delete('/jobs/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.deleteOne(query);
      res.send(result);
    });

    // Update job
    app.put('/update/:id', async (req, res) => {
      const id = req.params.id;
      const jobData = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: jobData
      };
      const result = await jobCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // My bids
    app.get('/my-bids/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    });

    // Bids request for a job
    app.get('/bids-requests/:email', async (req, res) => {
      const email = req.params.email;
      const query = { 'buyer_email': email };
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    });

    // Update bid request status
    app.patch('/bid/:id', async (req, res) => {
      const id = req.params.id;
      const status = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: status };
      const result = await bidsCollection.updateOne(query, updateDoc);
      res.send(result);
      console.log('ok', status);
    });

    // Send a ping to confirm successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

  } catch (err) {
    console.error(err);
  }
}

// Start the run function
run();

// Routes that don't need to be inside `run`
app.get('/', (req, res) => {
  res.send('ok');
});

// Start the server
app.listen(port, () => console.log(`Server running on port: ${port}`));
