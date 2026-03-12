import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import loginRoute from './api/login.js';
import registerRoute from './api/register.js';
import bookingRoute from './api/Bookings.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from root (assets, components, etc.)
app.use(express.static('.'));

// Serve pages folder
app.use('/pages', express.static('pages'));

// Redirect root to login page
app.get('/', (req, res) => {
  res.redirect('/pages/login.html');
});

// API Routes
app.use('/api', loginRoute);
app.use('/api', registerRoute);
app.use('/api', bookingRoute);

app.listen(3000, () => console.log('🚀 Running on http://localhost:3000'));