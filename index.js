const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 3000;
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId, GridFSBucket } = require('mongodb');
const nodemailer = require("nodemailer");
const multer = require('multer');
const path = require('path');
const bodyParser = require('body-parser');


//middleware
app.use(cors())
app.use(express.json());
app.use(bodyParser.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }
  // bearer token
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

// send email
const sendEmail = (emailAddress, emailData) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for port 465, false for other ports
    auth: {
      user: process.env.TRANSPORTER_EMAIL,
      pass: process.env.TRANSPORTER_PASS,
    },
  });

  const mailBody = {
    from: `"artsense" <${process.env.TRANSPORTER_EMAIL}>`, // sender address
    to: emailAddress, // list of receivers
    subject: emailData.subject, // Subject line
    html: emailData.message, // html body
  }
  transporter.sendMail(mailBody, (error, info) => {
    if (error) {
      console.log(error)
    }
    else {
      console.log('Email Sent: ' + info.response);
    }
  });

  // verify connection configuration
  transporter.verify(function (error, success) {
    if (error) {
      console.log(error);
    } else {
      console.log("Server is ready to take our messages");
    }
  });
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.m4vej.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();
    const db = client.db("artsenseDb");
    const bucket = new GridFSBucket(db, {
      bucketName: 'eventFiles', // name of the bucket (you can choose any name)
    });

    const userCollection = client.db("artsenseDb").collection("users");
    const photoCollection = client.db("artsenseDb").collection("photo");
    const photoNavbarCollection = client.db("artsenseDb").collection("addNavbar");
    const cartCollection = client.db("artsenseDb").collection("carts");
    const inquireCollection = client.db("artsenseDb").collection("inquire");
    const exhibitionCollection = client.db("artsenseDb").collection("exhibition");
    const bookedExhibitionCollection = client.db("artsenseDb").collection("bookedExhibition");
    const eventCollection = client.db("artsenseDb").collection("event");
    const auctionCollection = client.db("artsenseDb").collection("auction");
    const exhibitionNavbarCollection = client.db("artsenseDb").collection("exhibitionNavbar");
    const auctionNavbarCollection = client.db("artsenseDb").collection("auctionNavbar");
    const bidCollection = client.db("artsenseDb").collection("bid");
    const totalBidCollection = client.db("artsenseDb").collection("totalBid");
    const totalArtistsCollection = client.db("artsenseDb").collection("artists");
    const totalPhotoCollection = client.db("artsenseDb").collection("totalPhoto");


    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h'
      })
      res.send({ token })
    })

    //  Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ error: true, message: ' forbidden access' })
      }
      next();

    }

    //  users related api
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user?.email }
      const existingUser = await userCollection.findOne(query);
      console.log("existing user", existingUser);
      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await userCollection.insertOne(user);
      // welcome new user
      sendEmail(user?.email, {
        subject: "Welcome to artsense",
        message:`<p>Dear,</p>
            <p>Thank you for Signup artsense</p>
            <p>Visit our website & Collect your Picture</p>
            <p>Best regards,<br/>The Artsense Team</p>`,
      })
      res.send(result);

    })

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })



    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);

    })
    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    // photo related api

    app.get('/photo', async (req, res) => {
      const result = await photoCollection.find().toArray();
      res.send(result);
    })


    app.get('/photoCount', async (req, res) => {
      const count = await photoCollection.estimatedDocumentCount();
      res.send({ count });
    })

    app.post('/photo', verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await photoCollection.insertOne(newItem)
      res.send(result);
    })

    app.delete('/photo/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await photoCollection.deleteOne(query);
      res.send(result);
    })

    // load single data
    app.get('/photo/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await photoCollection.findOne(query);
      res.send(result);
    });

    // Photo Navbar
    app.get('/addNavbar', async (req, res) => {
      const result = await photoNavbarCollection.find().toArray();
      res.send(result);
    })

    app.post('/addNavbar', verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = {
        ...req.body,
        createdAt: new Date(), // Add a timestamp
      };
      const result = await photoNavbarCollection.insertOne(newItem);
      res.send(result);
    });

    app.delete('/addNavbar/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await photoNavbarCollection.deleteOne(query);
      res.send(result);
    })



    //  carts collection
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })


    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    })

    // inquire
    app.get('/inquire', async (req, res) => {
      const result = await inquireCollection.find().toArray();
      res.send(result);
    })

    app.post('/inquire', async (req, res) => {
      const inquire = req.body;
      const result = await inquireCollection.insertOne(inquire);
      res.send(result);
    })
    app.delete('/inquire/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await inquireCollection.deleteOne(query);
      res.send(result);
    })

    // Exhibition  related api
    app.get('/exhibition', async (req, res) => {
      const result = await exhibitionCollection.find().toArray();
      res.send(result);
    })

    // load single data
    app.get('/exhibition/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await exhibitionCollection.findOne(query);
      res.send(result);
    });

    app.post('/exhibition', verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body;

      // Extract numeric value from the formatted price string
      const priceInNumber = parseFloat(newItem.price.replace('BDT', '').replace(',', '').trim());

      // Format the price to store it as a string with "BDT" prefix and two decimals
      const formattedPrice = `BDT ${priceInNumber.toLocaleString('en-In', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      // Store the numeric price for calculations and the formatted price for display
      newItem.price = priceInNumber;  // Store the numeric price (e.g., 23000)
      newItem.formattedPrice = formattedPrice;  // Store the formatted price (e.g., "BDT 23,000.00")

      const result = await exhibitionCollection.insertOne(newItem);
      res.send(result);
    });



    app.delete('/exhibition/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await exhibitionCollection.deleteOne(query);
      res.send(result);
    })

    // Exhibition Navbar
    app.get('/exhibitionNavbar', async (req, res) => {
      const result = await exhibitionNavbarCollection.find().toArray();
      res.send(result);
    })

    app.post('/exhibitionNavbar', verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = {
        ...req.body,
        createdAt: new Date(), // Add a timestamp
      };
      const result = await exhibitionNavbarCollection.insertOne(newItem);
      res.send(result);
    });

    app.delete('/exhibitionNavbar/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await exhibitionNavbarCollection.deleteOne(query);
      res.send(result);
    })

    // booked exhibition
    app.get('/bookedExhibition', async (req, res) => {
      const result = await bookedExhibitionCollection.find().toArray();
      res.send(result);
    })


    app.post('/bookedExhibition', async (req, res) => {
      const { id, email } = req.body; // Extract 'email' from the request body
    
      // Check if the item is already booked
      const existingBooking = await bookedExhibitionCollection.findOne({ id });
    
      if (existingBooking) {
        return res.status(400).send({ error: 'This item is already booked.' });
      }
    
      const result = await bookedExhibitionCollection.insertOne(req.body);
      
      // send email to guest
      try {
        sendEmail(email, { // Use the email variable here
          subject: "Booking Confirmation for Artsense Exhibition",
          message: `
            <p>Dear,</p>
            <p>Thank you for booking an item at our exhibition!</p>
            <p>Your booking ID is <strong>${id}</strong>. Please retain this for your reference.</p>
            <p>We look forward to your visit!</p>
            <p>Best regards,<br/>The Artsense Team</p>
          `,
        });
      } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).send({ error: 'Failed to send email' });
      }
    
      res.send(result);
    });
    


    // New endpoint to check the booking status
    app.get('/bookedExhibition/:id', async (req, res) => {
      const { id } = req.params;

      // Find the booking status by ID
      const existingBooking = await bookedExhibitionCollection.findOne({ id });

      res.send({ booked: !!existingBooking });
    });


    app.delete('/bookedExhibition/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await bookedExhibitionCollection.deleteOne(query);
      res.send(result);
    })


    // Event related api

    app.get('/event', async (req, res) => {
      const result = await eventCollection.find().sort({ createdAt: -1 }).toArray(); // Sort by createdAt
      res.send(result);
    });


    // Configure Multer for file uploads
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Only PDF files are allowed'), false);
        }
      },
    });
    // Endpoint to handle event creation with PDF upload using GridFS
    app.post('/event', upload.single('file'), async (req, res) => {
      const { title, press, description, photoUrl } = req.body;

      // Ensure file is present
      if (!req.file) {
        return res.status(400).send({ message: 'PDF file is required' });
      }

      // Get the PDF file buffer
      const pdfBuffer = req.file.buffer;

      // Create the event object
      const newEvent = {
        title,
        press,
        description,
        photoUrl,
        createdAt: new Date(),
      };

      // Insert the event data into the database
      const result = await eventCollection.insertOne(newEvent);

      // Store the PDF file in GridFS
      const uploadStream = bucket.openUploadStream(`${result.insertedId}_file.pdf`, {
        metadata: { eventId: result.insertedId }, // Link PDF with the event
      });
      uploadStream.end(pdfBuffer);

      // Return a success response
      res.status(201).send({
        message: 'Event added successfully',
        insertedId: result.insertedId,
      });
    });

    // Endpoint to retrieve the event PDF
    app.get('/event/:id/file', async (req, res) => {
      const eventId = req.params.id;

      if (!ObjectId.isValid(eventId)) {
        return res.status(400).send({ message: 'Invalid eventId format' });
      }

      try {
        const objectId = new ObjectId(eventId);

        // Query the eventFiles.files collection to get the file metadata
        const file = await db.collection('eventFiles.files').findOne({
          'metadata.eventId': objectId
        });

        if (!file) {
          return res.status(404).send({ message: 'File not found' });
        }

        // Initialize GridFSBucket for file download
        const bucket = new GridFSBucket(db, { bucketName: 'eventFiles' });

        const downloadStream = bucket.openDownloadStream(file._id);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);

        downloadStream.pipe(res);

        downloadStream.on('error', (error) => {
          console.error('Error streaming the file:', error);
          res.status(500).send({ message: 'Error streaming the file' });
        });

        downloadStream.on('end', () => {
          res.end();
        });
      } catch (error) {
        console.error('Error fetching file:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });


    // Auction

    app.get('/auction', async (req, res) => {
      const result = await auctionCollection.find().toArray();
      res.send(result);
    })

    // load single data
    app.get('/auction/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await auctionCollection.findOne(query);
      res.send(result);
    });

    app.post('/auction', verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await auctionCollection.insertOne(newItem)
      res.send(result);
    });

    // Auction Navbar
    app.get('/auctionNavbar', async (req, res) => {
      const result = await auctionNavbarCollection.find().toArray();
      res.send(result);
    })

    app.post('/auctionNavbar', verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = {
        ...req.body,
        createdAt: new Date(), // Add a timestamp
      };
      const result = await auctionNavbarCollection.insertOne(newItem);
      res.send(result);
    });

    app.delete('/auctionNavbar/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await auctionNavbarCollection.deleteOne(query);
      res.send(result);
    })

    app.delete('/auction/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await auctionCollection.deleteOne(query);
      res.send(result);
    })

    // Bid

    app.get('/bid', async (req, res) => {
      const result = await bidCollection.find().toArray();
      res.send(result);
    })


    app.post('/bid', async (req, res) => {
      const { bidAmount, email, lotId } = req.body;

      // Validate the input
      if (!bidAmount || !email || !lotId) {
        return res.status(400).send({ message: "Invalid bid data" });
      }

      const bidData = {
        lotId,
        bidAmount,
        email,
        createdAt: new Date(),
      };

      try {
        // Increment the `placeBidCount` for the auction
        await totalBidCollection.updateOne(
          { lotId },
          { $inc: { placeBidCount: 1 } }, // Increment the count
          { upsert: true } // Ensure the document exists
        );

        // Check if the user has already bid on this lot (using lotId and email)
        const existingBid = await bidCollection.findOne({ lotId, email });

        if (!existingBid) {
          // Increment unique bidder count only if it's a new bidder
          await totalBidCollection.updateOne(
            { lotId }, // Use lotId to find the auction
            { $inc: { uniqueBidders: 1 } }, // Increment the count
            { upsert: true }
          );
        }

        // Insert bid details into bidCollection
        const insertResult = await bidCollection.insertOne(bidData);

        if (insertResult.insertedId) {
          res.send({
            message: "Bid placed successfully",
            insertedId: insertResult.insertedId,
          });
        } else {
          res.status(500).send({ message: "Failed to place bid" });
        }
      } catch (error) {
        console.error("Error placing bid:", error);
        res.status(500).send({ message: "Server error" });
      }
      // send email to guest
      sendEmail(email, {
        subject: "Bid Confirmation for Artsense Auction",
        message: `
            <p>Dear,</p>
            <p>Thank you for bidding an item at our Auction!</p>
            <p>Your booking ID is <strong>${lotId}</strong>. Please retain this for your reference.</p>
            <p>We look forward to your visit!</p>
            <p>Best regards,<br/>The Artsense Team</p>`,
      });

    });


    app.get('/bid/:lotId/bid-count', async (req, res) => {
      const { lotId } = req.params;  // The lotId passed in the URL

      try {
        const bidCount = await bidCollection.countDocuments({ lotId: lotId });  // Count the number of bids for the given lotId
        res.send({ bidCount });
      } catch (error) {
        console.error("Error fetching bid count:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    app.delete('/bid/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await bidCollection.deleteOne(query);
      res.send(result);
    })

    // all artists
    app.get('/artists', async (req, res) => {
      const result = await totalArtistsCollection.find().toArray();
      res.send(result);
    })

    app.post('/artists', async (req, res) => {
      const artistItem = req.body;
      const result = await totalArtistsCollection.insertOne(artistItem);
      res.send(result);
    })

    app.delete('/artists/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await totalArtistsCollection.deleteOne(query);
      res.send(result);
    })

    // total photo
    app.get('/totalPhoto', async (req, res) => {
      const result = await totalPhotoCollection.find().toArray();
      res.send(result);
    })

    app.get('/prices', async (req, res) => {
      try {
        const prices = await totalPhotoCollection.aggregate([
          { $group: { _id: "$formattedPrice" } }  // Group by formattedPrice to get distinct values
        ]).toArray();
        const priceList = prices.map(item => item._id);  // Extract distinct prices
        res.json(priceList);
      } catch (error) {
        console.error('Error fetching prices:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });


    // Route for fetching distinct years
    app.get('/years', async (req, res) => {
      try {
        const years = await totalPhotoCollection.aggregate([
          { $group: { _id: "$year" } }  // Group by year to get distinct values
        ]).toArray();
        const yearList = years.map(item => item._id);  // Extract distinct years
        res.json(yearList);
      } catch (error) {
        console.error('Error fetching years:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // Route for searching photos based on title, artist, price, and year
    
    app.get('/searchPhotos', async (req, res) => {
      let { search, artist, price, year } = req.query;
    
      search = search ? search.trim().replace(/[.*+?^=!:${}()|\[\]\/\\]/g, '\\$&') : '';  // Sanitize search query
    
      if (!search && !artist && !price && !year) {
        return res.status(400).json({ error: 'At least one search parameter (search, artist, price, or year) must be provided' });
      }
    
      let filters = {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { artist: { $regex: search, $options: 'i' } }
        ]
      };
    
      if (artist) {
        filters.artist = { $regex: artist, $options: 'i' }; // Filter by artist
      }
    
      if (price) {
        // Remove currency symbol and commas from price, then convert to a number
        const priceNumber = Number(price.replace(/[^\d.-]/g, ''));
        if (isNaN(priceNumber)) {
          return res.status(400).json({ error: 'Invalid price format' });
        }
        filters.price = priceNumber;  // Filter by exact price
      }
    
      if (year) {
        const yearNumber = Number(year);
        if (isNaN(yearNumber)) {
          return res.status(400).json({ error: 'Invalid year format' });
        }
        filters.year = yearNumber;  // Filter by year (ensure it's treated as a number)
      }
    
      try {
        const photos = await totalPhotoCollection.find(filters).toArray();
        if (photos.length === 0) {
          return res.status(404).json({ message: 'No photos found matching your search' });
        }
    
        res.json(photos);
      } catch (error) {
        console.error('Error during search:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });
    


    // single photo
    app.get('/totalPhoto/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await totalPhotoCollection.findOne(query);
      res.send(result);
    });
    // For specific artist
    app.get('/artists/:id', async (req, res) => {
      const id = req.params.id; // Get the artist ID from the request params

      try {
        if (id === '0') {
          // If ID is 0, return all artists
          const result = await totalPhotoCollection.find().toArray();
          res.send(result);
        } else {
          // For specific artist, use MongoDB query
          const result = await totalPhotoCollection.find({ artistId: id }).toArray();
          if (!result.length) {
            return res.status(404).send({ message: 'No photos found for this artist' });
          }
          res.send(result);
        }
      } catch (error) {
        res.status(500).send({ message: 'Server error', error });
      }
    });


    app.post('/totalPhoto', verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body;

      // Check if price exists and is a string before attempting to process it
      let priceInNumber = null;
      let formattedPrice = null;

      if (newItem.price) {
        // If price exists, process it
        priceInNumber = parseFloat(newItem.price.toString().replace('BDT', '').replace(',', '').trim());
        if (!isNaN(priceInNumber)) {
          // Format the price for display
          formattedPrice = `BDT ${priceInNumber.toLocaleString('en-In', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else {
          priceInNumber = null; // Handle invalid price gracefully
        }
      }

      // Store the numeric price and formatted price in the new item
      newItem.price = priceInNumber; // Store as a number (null if no valid price)
      newItem.formattedPrice = formattedPrice; // Store formatted price (null if no valid price)

      try {
        const result = await totalPhotoCollection.insertOne(newItem);
        res.send(result);
      } catch (error) {
        console.error('Error inserting new item:', error);
        res.status(500).send({ message: 'Failed to insert new item', error });
      }
    });

    app.delete('/totalPhoto/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await totalPhotoCollection.deleteOne(query);
      res.send(result);
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})