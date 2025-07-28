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

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  try {
    // 1. Get token from cookies
    const token = req.cookies.token;
    console.log('Token from cookies:', token); // Debug log
    
    if (!token) {
      console.log('No token found');
      return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }

    // 2. Verify token
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.log('Token verification failed:', err.message);
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized: Invalid token',
          error: err.message 
        });
      }
      
      // 3. Attach decoded user to request
      console.log('Token verified successfully. User:', decoded);
      req.user = decoded;
      next();
    });
    
  } catch (error) {
    console.error('Middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

// devbbuging endpoint

app.get('/debug-check-token', (req, res) => {
  console.log('Received cookies:', req.cookies);
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'No token found in cookies',
      receivedCookies: req.cookies 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    res.json({ 
      success: true, 
      user: decoded,
      tokenExists: !!token
    });
  } catch (err) {
    res.status(401).json({ 
      success: false, 
      error: 'Invalid token',
      details: err.message 
    });
  }
});

// devbbuging endpoint

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

// Get artifacts by logged-in user
app.get('/my-artifacts', verifyToken, async (req, res) => {
  try {
    const adderEmail = req.user.email; // From verified token
    const artifacts = await artifactsCollection.find({ 
      adderEmail: adderEmail 
    }).toArray();
    
    if (artifacts.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'No artifacts found for this user',
        artifacts: [] 
      });
    }
    
    res.status(200).json({ 
      success: true, 
      artifacts 
    });
    
  } catch (error) {
    console.error('Error fetching user artifacts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user artifacts' 
    });
  }
});


// Update artifact (only owner can update)
app.patch('/update-artifact/:id', verifyToken, async (req, res) => {
  try {
    const artifactId = req.params.id;
    const updates = req.body;
    const adderEmail = req.user.email;
    
    // First verify the artifact belongs to the user
    const artifact = await artifactsCollection.findOne({
      _id: new ObjectId(artifactId),
      adderEmail: adderEmail
    });
    
    if (!artifact) {
      return res.status(403).json({ 
        success: false, 
        error: 'You can only update your own artifacts' 
      });
    }
    
    const result = await artifactsCollection.updateOne(
      { _id: new ObjectId(artifactId) },
      { $set: updates }
    );
    
    res.status(200).json({ 
      success: true, 
      message: 'Artifact updated successfully',
      result 
    });
    
  } catch (error) {
    console.error('Error updating artifact:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update artifact' 
    });
  }
});


// Delete artifact (only owner can delete)
app.delete('/delete-artifact/:id', verifyToken, async (req, res) => {
  try {
    const artifactId = req.params.id;
    const adderEmail = req.user.email;
    
    // Verify ownership
    const artifact = await artifactsCollection.findOne({
      _id: new ObjectId(artifactId),
      adderEmail: adderEmail
    });
    
    if (!artifact) {
      return res.status(403).json({ 
        success: false, 
        error: 'You can only delete your own artifacts' 
      });
    }
    
    const result = await artifactsCollection.deleteOne({ 
      _id: new ObjectId(artifactId) 
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'Artifact deleted successfully',
      result 
    });
    
  } catch (error) {
    console.error('Error deleting artifact:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete artifact' 
    });
  }
});


app.post('/logout', (req, res) => {
  try {
    console.log('Attempting logout. Current cookies:', req.cookies);
    
    // Clear token cookie with EXACT same options used when setting it
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      domain: 'localhost' // Explicitly set domain
    });
    
    console.log('Cookie should be cleared. Response headers:', res.getHeaders());
    res.json({ 
      success: true,
      message: 'Logout successful',
      cookiesCleared: true
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Logout failed' 
    });
  }
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