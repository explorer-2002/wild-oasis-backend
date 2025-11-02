import mongoose from "mongoose";

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
        enum: ['pending', 'confirmed', 'completed', 'cancelled'],
        default: 'pending'
    },

    specialRequests: {
        type: String,
        default: ''
    }
});

bookingSchema.index({roomId:1, checkInDate:1, checkOutDate: 1});
bookingSchema.index({guestEmail: 1});
bookingSchema.index({status:1});

export const Booking = mongoose.model('Booking', bookingSchema);
