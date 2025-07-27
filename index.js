const express = require('express');
const cors = require('cors')
const app = express();
require('dotenv').config()
app.use(cors())
app.use(express.json());
const port = process.env.PORT || 5000



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const axios = require('axios');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mrtaf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const artifactsCollection = client.db('ArtifactsDB').collection('Artifacts')
const likedArtifactsCollection = client.db('ArtifactsDB').collection('LikedArtifacts');
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res)=>{
    res.send('server is running')
})

app.get('/all-artifacts', async(req, res) =>{
  const cursor = artifactsCollection.find()
        const result = await cursor.toArray()
        res.send(result)
})

app.get('/all-artifacts/:id', async(req, res)=>{
  const artifactId = req.params.id
  const result =await artifactsCollection.findOne(new ObjectId(artifactId))
  res.send(result)
})

app.post('/add-artifacts', async(req, res)=>{
  const newArtifact = req.body
  const result = await artifactsCollection.insertOne(newArtifact)
  res.send(result)
})

// Check like status, wheter is liked or not
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

// Like/Unlike an artifact
app.patch('/artifacts/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body; // You'll need to implement user authentication

    // Check if already liked
    const alreadyLiked = await likedArtifactsCollection.findOne({
      artifactId: id,
      userId
    });

    if (alreadyLiked) {
      // Unlike
      await likedArtifactsCollection.deleteOne({ _id: alreadyLiked._id });
      await artifactsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { likeCount: -1 } }
      );
      return res.json({ liked: false });
    } else {
      // Like
      await likedArtifactsCollection.insertOne({
        artifactId: id,
        userId,
        createdAt: new Date()
      });
      await artifactsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { likeCount: 1 } }
      );
      return res.json({ liked: true });
    }
  } catch (error) {
    console.error('Error updating like:', error);
    res.status(500).json({ error: 'Failed to update like status' });
  }
});

// Get liked artifacts for a user
app.get('/users/:userId/liked-artifacts', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get liked artifact IDs
    const likedItems = await likedArtifactsCollection.find({ userId }).toArray();
    const artifactIds = likedItems.map(item => new ObjectId(item.artifactId));
    
    // Get full artifact details
    const artifacts = await artifactsCollection.find({
      _id: { $in: artifactIds }
    }).toArray();
    
    res.json(artifacts);
  } catch (error) {
    console.error('Error fetching liked artifacts:', error);
    res.status(500).json({ error: 'Failed to fetch liked artifacts' });
  }
});

// Check like status
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

app.listen(port, () =>{
    console.log(`server is running on PORT: ${port}`);
})