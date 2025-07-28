const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// Middleware
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:5173', // Your React app's origin
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mrtaf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Database Collections
const artifactsCollection = client.db('ArtifactsDB').collection('Artifacts');
const likedArtifactsCollection = client.db('ArtifactsDB').collection('LikedArtifacts');

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}
run().catch(console.dir);

// Routes
app.get('/', (req, res) => {
  res.send('Artifacts Server is Running');
});

// Authentication Endpoints
app.post('/jwt', (req, res) => {
  try {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' });
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 5 * 60 * 60 * 1000 // 5 hours
    }).send({ success: true });
  } catch (error) {
    console.error('JWT generation error:', error);
    res.status(500).send({ error: 'Failed to generate token' });
  }
});

app.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }).send({ success: 'logout successfully' });
});



// Artifacts Endpoints
app.get('/all-artifacts', async (req, res) => {
  try {
    const cursor = artifactsCollection.find();
    const result = await cursor.toArray();
    res.send(result);
  } catch (error) {
    console.error('Error fetching artifacts:', error);
    res.status(500).send({ error: 'Failed to fetch artifacts' });
  }
});

app.get('/all-artifacts/:id', async (req, res) => {
  try {
    const artifactId = req.params.id;
    const result = await artifactsCollection.findOne(new ObjectId(artifactId));
    res.send(result);
  } catch (error) {
    console.error('Error fetching artifact:', error);
    res.status(500).send({ error: 'Failed to fetch artifact' });
  }
});

app.post('/add-artifacts', async (req, res) => {
  try {
    const newArtifact = req.body;
    const result = await artifactsCollection.insertOne(newArtifact);
    res.send(result);
  } catch (error) {
    console.error('Error adding artifact:', error);
    res.status(500).send({ error: 'Failed to add artifact' });
  }
});

// Like Endpoints
app.get('/artifacts/:id/like-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    
    const liked = await likedArtifactsCollection.findOne({
      artifactId: id,
      userId
    });
    
    res.json({ liked: !!liked });
  } catch (error) {
    console.error('Error checking like status:', error);
    res.status(500).json({ error: 'Failed to check like status' });
  }
});

app.patch('/artifacts/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const alreadyLiked = await likedArtifactsCollection.findOne({
      artifactId: id,
      userId
    });

    if (alreadyLiked) {
      await likedArtifactsCollection.deleteOne({ _id: alreadyLiked._id });
      await artifactsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { likeCount: -1 } }
      );
      res.json({ liked: false });
    } else {
      await likedArtifactsCollection.insertOne({
        artifactId: id,
        userId,
        createdAt: new Date()
      });
      await artifactsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { likeCount: 1 } }
      );
      res.json({ liked: true });
    }
  } catch (error) {
    console.error('Error updating like:', error);
    res.status(500).json({ error: 'Failed to update like status' });
  }
});

app.get('/users/:userId/liked-artifacts', async (req, res) => {
  try {
    const { userId } = req.params;
    const likedItems = await likedArtifactsCollection.find({ userId }).toArray();
    const artifactIds = likedItems.map(item => new ObjectId(item.artifactId));
    
    const artifacts = await artifactsCollection.find({
      _id: { $in: artifactIds }
    }).toArray();
    
    res.json(artifacts);
  } catch (error) {
    console.error('Error fetching liked artifacts:', error);
    res.status(500).json({ error: 'Failed to fetch liked artifacts' });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server is running on PORT: ${port}`);
    console.log('JWT Secret:', process.env.ACCESS_TOKEN_SECRET ? 'Configured' : 'MISSING!');
});