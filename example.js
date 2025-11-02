// ============================================
// 1. MONGODB SCHEMAS (models/Booking.js)
// ============================================
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  guestName: {
    type: String,
    required: true,
    trim: true
  },
  guestEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  guestPhone: {
    type: String,
    required: true,
    trim: true
  },
  checkInDate: {
    type: Date,
    required: true
  },
  checkOutDate: {
    type: Date,
    required: true
  },
  numberOfGuests: {
    type: Number,
    required: true,
    min: 1
  },
  numberOfNights: {
    type: Number,
    required: true
  },
  pricePerNight: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  specialRequests: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for efficient queries
bookingSchema.index({ roomId: 1, checkInDate: 1, checkOutDate: 1 });
bookingSchema.index({ guestEmail: 1 });
bookingSchema.index({ status: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

// Room Schema (models/Room.js)
const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true,
    unique: true
  },
  roomType: {
    type: String,
    required: true
  },
  pricePerNight: {
    type: Number,
    required: true
  },
  maxGuests: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Room = mongoose.model('Room', roomSchema);

// ============================================
// 2. VALIDATION SCHEMAS (validators/bookingValidator.js)
// ============================================
const Joi = require('joi');

const createBookingSchema = Joi.object({
  roomId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    .messages({
      'string.pattern.base': 'Invalid roomId format'
    }),
  guestName: Joi.string().min(2).max(100).required()
    .messages({
      'string.min': 'Guest name must be at least 2 characters',
      'string.max': 'Guest name cannot exceed 100 characters'
    }),
  guestEmail: Joi.string().email().required()
    .messages({
      'string.email': 'Invalid email format'
    }),
  guestPhone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required()
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    }),
  checkInDate: Joi.date().iso().min('now').required()
    .messages({
      'date.min': 'Check-in date must be in the future'
    }),
  checkOutDate: Joi.date().iso().greater(Joi.ref('checkInDate')).required()
    .messages({
      'date.greater': 'Check-out date must be after check-in date'
    }),
  numberOfGuests: Joi.number().integer().min(1).max(10).required()
    .messages({
      'number.min': 'At least 1 guest is required',
      'number.max': 'Maximum 10 guests allowed'
    }),
  specialRequests: Joi.string().max(500).allow('').optional()
});

const updateBookingSchema = Joi.object({
  checkInDate: Joi.date().iso().min('now').optional(),
  checkOutDate: Joi.date().iso().optional(),
  numberOfGuests: Joi.number().integer().min(1).max(10).optional(),
  specialRequests: Joi.string().max(500).allow('').optional(),
  status: Joi.string().valid('pending', 'confirmed', 'cancelled', 'completed').optional()
}).custom((value, helpers) => {
  if (value.checkInDate && value.checkOutDate) {
    if (new Date(value.checkOutDate) <= new Date(value.checkInDate)) {
      return helpers.error('any.invalid', { message: 'Check-out date must be after check-in date' });
    }
  }
  return value;
});

const querySchema = Joi.object({
  status: Joi.string().valid('pending', 'confirmed', 'cancelled', 'completed').optional(),
  roomId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  guestEmail: Joi.string().email().optional(),
  checkInDate: Joi.date().iso().optional(),
  checkOutDate: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

// ============================================
// 3. BOOKING SERVICE CLASS (services/BookingService.js)
// ============================================
class BookingService {
  constructor(Booking, Room) {
    this.Booking = Booking;
    this.Room = Room;
  }

  // Calculate number of nights
  calculateNights(checkIn, checkOut) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffTime = new Date(checkOut) - new Date(checkIn);
    return Math.ceil(diffTime / msPerDay);
  }

  // Check if room is available for the given dates
  async isRoomAvailable(roomId, checkInDate, checkOutDate, excludeBookingId = null) {
    const query = {
      roomId,
      status: { $nin: ['cancelled'] },
      $or: [
        {
          checkInDate: { $lt: checkOutDate },
          checkOutDate: { $gt: checkInDate }
        }
      ]
    };

    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }

    const overlappingBooking = await this.Booking.findOne(query);
    return !overlappingBooking;
  }

  // Create a new booking
  async createBooking(bookingData) {
    const { roomId, checkInDate, checkOutDate, numberOfGuests } = bookingData;

    // Check if room exists
    const room = await this.Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (!room.isActive) {
      throw new Error('Room is not available for booking');
    }

    // Check if number of guests exceeds room capacity
    if (numberOfGuests > room.maxGuests) {
      throw new Error(`Room can accommodate maximum ${room.maxGuests} guests`);
    }

    // Check room availability
    const isAvailable = await this.isRoomAvailable(roomId, checkInDate, checkOutDate);
    if (!isAvailable) {
      throw new Error('Room is already booked for the selected dates');
    }

    // Calculate pricing
    const numberOfNights = this.calculateNights(checkInDate, checkOutDate);
    const totalPrice = numberOfNights * room.pricePerNight;

    // Create booking
    const booking = new this.Booking({
      ...bookingData,
      numberOfNights,
      pricePerNight: room.pricePerNight,
      totalPrice,
      status: 'pending'
    });

    await booking.save();
    return await booking.populate('roomId');
  }

  // Get booking by ID
  async getBookingById(bookingId) {
    const booking = await this.Booking.findById(bookingId).populate('roomId');
    if (!booking) {
      throw new Error('Booking not found');
    }
    return booking;
  }

  // Get all bookings with filters
  async getAllBookings(filters = {}) {
    const { status, roomId, guestEmail, checkInDate, checkOutDate, page = 1, limit = 10 } = filters;
    
    const query = {};
    
    if (status) query.status = status;
    if (roomId) query.roomId = roomId;
    if (guestEmail) query.guestEmail = guestEmail;
    if (checkInDate) query.checkInDate = { $gte: new Date(checkInDate) };
    if (checkOutDate) query.checkOutDate = { $lte: new Date(checkOutDate) };

    const skip = (page - 1) * limit;
    
    const [bookings, total] = await Promise.all([
      this.Booking.find(query)
        .populate('roomId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.Booking.countDocuments(query)
    ]);

    return {
      bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Update booking
  async updateBooking(bookingId, updateData) {
    const booking = await this.Booking.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Prevent updating cancelled bookings
    if (booking.status === 'cancelled') {
      throw new Error('Cannot update a cancelled booking');
    }

    // If dates are being updated, check availability
    const newCheckIn = updateData.checkInDate || booking.checkInDate;
    const newCheckOut = updateData.checkOutDate || booking.checkOutDate;

    if (updateData.checkInDate || updateData.checkOutDate) {
      const isAvailable = await this.isRoomAvailable(
        booking.roomId,
        newCheckIn,
        newCheckOut,
        bookingId
      );
      
      if (!isAvailable) {
        throw new Error('Room is not available for the updated dates');
      }

      // Recalculate pricing
      const numberOfNights = this.calculateNights(newCheckIn, newCheckOut);
      updateData.numberOfNights = numberOfNights;
      updateData.totalPrice = numberOfNights * booking.pricePerNight;
    }

    Object.assign(booking, updateData);
    await booking.save();
    return await booking.populate('roomId');
  }

  // Cancel booking
  async cancelBooking(bookingId) {
    const booking = await this.Booking.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.status === 'cancelled') {
      throw new Error('Booking is already cancelled');
    }

    if (booking.status === 'completed') {
      throw new Error('Cannot cancel a completed booking');
    }

    booking.status = 'cancelled';
    await booking.save();
    return await booking.populate('roomId');
  }
}

// ============================================
// 4. ERROR HANDLING MIDDLEWARE (middleware/errorHandler.js)
// ============================================
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Invalid resource ID';
    error = new AppError(message, 400);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new AppError(message, 400);
  }

  // Joi validation error
  if (err.isJoi) {
    const message = err.details.map(detail => detail.message).join(', ');
    return res.status(400).json({
      success: false,
      error: message
    });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error'
  });
};

// ============================================
// 5. VALIDATION MIDDLEWARE (middleware/validate.js)
// ============================================
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return next(error);
    }
    next();
  };
};

const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    if (error) {
      return next(error);
    }
    req.query = value;
    next();
  };
};

// ============================================
// 6. ROUTES (routes/bookingRoutes.js)
// ============================================
const express = require('express');
const router = express.Router();
const bookingService = new BookingService(Booking, Room);

// Create a new booking
router.post('/bookings', validate(createBookingSchema), async (req, res, next) => {
  try {
    const booking = await bookingService.createBooking(req.body);
    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
});

// Get booking by ID
router.get('/bookings/:id', async (req, res, next) => {
  try {
    const booking = await bookingService.getBookingById(req.params.id);
    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(new AppError(error.message, 404));
  }
});

// Get all bookings with filters
router.get('/bookings', validateQuery(querySchema), async (req, res, next) => {
  try {
    const result = await bookingService.getAllBookings(req.query);
    res.status(200).json({
      success: true,
      data: result.bookings,
      pagination: result.pagination
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
});

// Update booking
router.patch('/bookings/:id', validate(updateBookingSchema), async (req, res, next) => {
  try {
    const booking = await bookingService.updateBooking(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Booking updated successfully',
      data: booking
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
});

// Cancel booking
router.delete('/bookings/:id', async (req, res, next) => {
  try {
    const booking = await bookingService.cancelBooking(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
});

module.exports = router;

// ============================================
// 7. MAIN APP (app.js)
// ============================================
const express = require('express');
const mongoose = require('mongoose');
const bookingRoutes = require('./routes/bookingRoutes');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', bookingRoutes);

// 404 Handler
app.use((req, res, next) => {
  next(new AppError('Route not found', 404));
});

// Error Handler
app.use(errorHandler);

// Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Start Server
const PORT = process.env.PORT || 3000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

module.exports = app;