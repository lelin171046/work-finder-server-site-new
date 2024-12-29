const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet')
const cookieParser = require('cookie-parser');
require('dotenv').config();
const app = express();

const port = process.env.PORT || 3003;

// CORS options
const corsOption = {
  origin: ['http://localhost:5173', 'https://builder-bd.firebaseapp.com', ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOption));
app.use(express.json());
app.use(cookieParser());

//halmet

app.use(helmet());

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://vercel.live"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
    },
  })
);

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token
  console.log(token);
  if (!token) return res.status(401).send({ message: 'UNauthorized access' })
  if (token) {
    jwt.verify(token, process.env.S_Key, (err, decoded) => {
      if (err) {
        console.log(err)
        return res.status(401).send({ message: 'UNauthorized access' })

      }
      console.log(decoded);
      req.user = decoded
      next()

    })
  }

}

// const uri = `mongodb://localhost:27017/`

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
    // await client.connect();

    const jobCollection = client.db('workFinder').collection('jobs');
    const bidsCollection = client.db('workFinder').collection('bids');

    // Routes definitions
    app.get('/jobs', async (req, res) => {
      const result = await jobCollection.find().toArray();
      res.send(result);
    });
    //Generating jwt web tokens
    app.post('/jwt', async (req, res) => {
      const email = req.body;
      console.log(email);
      const token = jwt.sign(email, process.env.S_Key, { expiresIn: '365d' });

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === "production" ? "none" : 'strict'
      }).send({ success: true });
    });
    ///Logout jwt 
    app.get('/logout', (req, res) => {
      res.clearCookie('token', {
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
      const bidData = req.body;
      const query = {
        email: bidData.email,
        jobId: bidData.jobId
      }
      const alreadyAlllied = await bidsCollection.findOne(query)
     
      if (alreadyAlllied) {
        return res
          .status(400)
          .send('You already place a bid on this job')
      }
      const result = await bidsCollection.insertOne(bidData);

       // update bid count in jobs collection
       const updateDoc = {
        $inc: { bid_count: 1 },
      }
      const jobQuery = { _id: new ObjectId(bidData.jobId) }
      const updateBidCount = await jobCollection.updateOne(jobQuery, updateDoc)
      console.log(updateBidCount);
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

    app.get('/jobs/:email', verifyToken, async (req, res) => {
      const tokenEmail = req.user?.email;
      const email = req.params.email;

      if (tokenEmail !== email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

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

      // const tokenEmail =req.user.email
      const email = req.params.email


      const query = { email };
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    });

    // Bids request for a job
    app.get('/bids-requests/:email', async (req, res) => {
      // const tokenEmail =req.user.email
      const email = req.params.email

      // if(tokenEmail !== email){
      //   return res.status(403).send({ message: 'forbidden access' })
      // }
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

    // All job 
    app.get('/all-jobs', async (req, res) => {
      try {
        const size = parseInt(req.query.size) || 10; // Default size if not provided
        const page = parseInt(req.query.page) - 1 || 0; // Default page to 0 if not provided
        const filter = req.query.filter;
        const sort = req.query.sort;
        const search = req.query.search;
    
        let query = { job_title: { $regex: search, $options: 'i' } };
        if (filter) query.category = filter;
    
        let option = {};
        if (sort) option = { sort: { deadline: sort === "asc" ? 1 : -1 } };
    
        // Make sure jobCollection is available and connected
        const result = await jobCollection.find(query, option).skip(page * size).limit(size).toArray();
        
        res.status(200).send(result);
      } catch (err) {
        console.error("Error fetching jobs:", err);
        res.status(500).send({ error: 'An error occurred while fetching jobs.' });
      }
    });
    
    //Count all job
    app.get('/jobs-count', async (req, res) => {
      const filter = req.query.filter;

      const search = req.query.search;

      let query = { 
        job_title: { $regex: search, $options: 'i' }}

      if(filter) query.category = filter  

  const count = await jobCollection.countDocuments(
    query
  );
      
      res.send({count});
    });
    // Send a ping to confirm successful connection
    // await client.db("admin").command({ ping: 1 });
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
app.listen(port, () => console.log(`Server running on port: ${port}`))
