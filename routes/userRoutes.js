import express from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { User } from '../models/Users.js';
import { upload } from '../upload.js';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
// import {validate} from '../middleware/validate.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

router.get('/user/:id', async (req, res, next) => {

    try {
        const { id } = req.params;
        const user = await User.findOne({ id });

        return res.status(201).json({
            success: true,
            data: user,
            message: "User fetched successfully"
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

router.patch('/user/:id', upload.single('avatar'), async (req, res, next) => {

    try {
        const { id } = req.params;

        let updateData = req.body;
        const avatarFile = req.file;

        const data = fs.readFileSync(path.join(__dirname, '..', 'uploads', req.file.filename));

        const avatarUrl = `data:${avatarFile.mimetype};base64,${data.toString('base64')}`;

        updateData = {...updateData, avatar: avatarUrl};

        const user = await User.findOne({id});

        if(!user){
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        let updatedUser;

        
        updatedUser = await User.findOneAndUpdate({id}, updateData, {new: true});

        return res.status(201).json({
            success: true,
            data: updatedUser,
            message: "User updated successfully"
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
// router.get('/bookings/:id', async (req, res, next) => {
//     try{
//         const booking = await bookingService.getBookingById(req.params.id);
//         return res.status(200).json({
//             success:true,
//             data: booking
//         });
//     }

//     catch(error){
//         next(new AppError(error.message, 404));
//     }
// });

// router.get('/bookings', async (req, res, next) => {
//     try{
//         console.log("Query params: ", req.query);

//         const result = await bookingService.getAllBookings({status: req.query.status});

//         console.log("Bookings fetched: ", result);
//         return res.status(200).json({
//             success: true,
//             data: result.bookings,
//             pagination: result.pagination
//         })
//     }

//     catch(error){
//         next(new AppError(error.message, 400));
//     }
// });

// router.patch('/bookings/:id', async (req,res,next) => {
//     try{
//         const booking = await bookingService.updateBooking(req.params.id, req.body);
//         return res.status(200).json({
//             success: true,
//             message: "Booking updated successfully",
//             data: booking
//         })
//     }

//     catch(err){
//         next(new AppError(err.message, 400));
//     }
// });

// router.delete('/bookings/:id', async (req,res,next) => {
//     try{
//         const booking = await bookingService.cancelBooking(req.params.id);
//         return res.status(200).json({
//             success: true,
//             message: "Booking deleted successfully",
//             data: booking
//         });
//     }

//     catch(error){
//         next(new AppError(error.message, 400)); 
//     }
// });

export default router;


