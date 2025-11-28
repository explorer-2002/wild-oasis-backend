import express from 'express';
import { BookingService } from '../bookingService/service.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { createBookingSchema } from '../validators/bookingValidator.js';
import { Booking } from '../models/Bookings.js';
import { Room } from '../models/Room.js';
import sendSms from '../services/sendSms.js';
import { client } from '../services/redisClient.js';

const router = express.Router();

const bookingService = new BookingService(Booking, Room);

router.post('/bookings', validate(createBookingSchema), async (req, res, next) => {
    try {
        const booking = await bookingService.createBooking(req.body);

        sendSms(`Booking has been created for ${req.body.guestName} in Jain Hotel`);

        return res.status(201).json({
            success: true,
            data: booking,
            message: "Booking created successfully"
        });
    }

    catch (error) {
        // next(new AppError(error.message, 400));
        return res.status(400).json({
            success: false,
            message: error
        });
    }
});

router.get('/bookings/:id', async (req, res, next) => {
    try {
        const booking = await bookingService.getBookingById(req.params.id);
        return res.status(200).json({
            success: true,
            data: booking
        });
    }

    catch (error) {
        next(new AppError(error.message, 404));
    }
});

router.get('/bookings', async (req, res, next) => {
    try {
        const bookingsExists = await client.exists('bookings');
        if (bookingsExists) {
            const cachedBookings = await client.get('bookings');

            console.log('Bookings retrieved from Redis cache');
            return res.status(200).json(JSON.parse(cachedBookings));
        }

        const result = await bookingService.getAllBookings({ ...req.query });
        const response = {
            success: true,
            data: result.bookings,
            pagination: result.pagination
        }

        await client.set('bookings', JSON.stringify(response));
        console.log('Bookings cached in Redis');

        return res.status(200).json(response)
    }

    catch (error) {
        next(new AppError(error.message, 400));
    }
});

router.patch('/bookings/:id', async (req, res, next) => {
    try {
        const booking = await bookingService.updateBooking(req.params.id, req.body);
        return res.status(200).json({
            success: true,
            message: "Booking updated successfully",
            data: booking
        })
    }

    catch (err) {
        next(new AppError(err.message, 400));
    }
});

router.delete('/bookings/:id', async (req, res, next) => {
    try {
        const booking = await bookingService.cancelBooking(req.params.id);
        return res.status(200).json({
            success: true,
            message: "Booking deleted successfully",
            data: booking
        });
    }

    catch (error) {
        next(new AppError(error.message, 400));
    }
});

export default router;


