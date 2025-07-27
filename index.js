const express = require('express');
const cors = require('cors')
const app = express();
require('dotenv').config()
app.use(cors())
app.use(express.json());
const port = process.env.PORT || 5000



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { default: axios } = require('axios');
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

app.listen(port, () =>{
    console.log(`server is running on PORT: ${port}`);
})