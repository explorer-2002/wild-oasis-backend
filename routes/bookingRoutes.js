import express from 'express';
import {BookingService} from '../bookingService/service.js';
import { AppError } from '../middleware/errorHandler.js';
import {validate} from '../middleware/validate.js';
import { createBookingSchema } from '../validators/bookingValidator.js';
import { Booking } from '../models/Bookings.js';
import { Room } from '../models/Room.js';

const router = express.Router();

const bookingService = new BookingService(Booking, Room);

router.post('/bookings', validate(createBookingSchema), async (req, res, next) => {
    try{
        const booking = await bookingService.createBooking(req.body);
        res.status(201).json({
            success: true,
            data: booking,
            message: "Booking created successfully"
        });
    }

    catch(error){
        next(new AppError(error.message, 400));
    }
});

router.get('/bookings/:id', async (req, res, next) => {
    try{
        const booking = await bookingService.getBookingById(req.params.id);
        res.status(200).json({
            success:true,
            data: booking
        });
    }

    catch(error){
        next(new AppError(error.message, 404));
    }
});

router.get('/bookings', async (req, res, next) => {
    try{
        const result = await bookingService.getAllBookings();

        res.status(200).json({
            success: true,
            data: result.bookings,
            pagination: result.pagination
        })
    }

    catch(error){
        next(new AppError(error.message, 400));
    }
});

router.patch('/bookings/:id', async (req,res,next) => {
    try{
        const booking = await bookingService.updateBooking(req.params.id, req.body);
        res.status(200).json({
            success: true,
            message: "Booking updated successfully",
            data: booking
        })
    }

    catch(err){
        next(new AppError(err.message, 400));
    }
});

router.delete('/bookings/:id', async (req,res,next) => {
    try{
        const booking = await bookingService.cancelBooking(req.params.id);
        res.status(200).json({
            success: true,
            message: "Booking deleted successfully",
            data: booking
        });
    }

    catch(error){
        next(new AppError(error.message, 400)); 
    }
});

export default router;


